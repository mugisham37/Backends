import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const createTaskSchema = z.object({
  title: z.string().min(2).max(100),
  description: z.string().optional(),
  status: z.string().default("todo"),
  priority: z.string().default("medium"),
  dueDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  assigneeId: z.string().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  assigneeId: z.string().optional().nullable(),
})

const assignTaskSchema = z.object({
  assigneeId: z.string(),
})

const updateTaskStatusSchema = z.object({
  status: z.string(),
})

const bulkCreateTasksSchema = z.array(
  z.object({
    title: z.string().min(2).max(100),
    description: z.string().optional(),
    status: z.string().default("todo"),
    priority: z.string().default("medium"),
    dueDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    assigneeId: z.string().optional(),
    projectId: z.string(),
  }),
)

const bulkUpdateTasksSchema = z.array(
  z.object({
    id: z.string(),
    title: z.string().min(2).max(100).optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    dueDate: z
      .string()
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    assigneeId: z.string().optional().nullable(),
  }),
)

const bulkDeleteTasksSchema = z.object({
  ids: z.array(z.string()),
})

export class TaskController {
  // Get tasks by project
  async getTasksByProject(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          tenantId: req.tenant.id,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isMember = await prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // Get tasks
      const tasks = await prisma.task.findMany({
        where: {
          projectId,
        },
        include: {
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: tasks.length,
        data: tasks,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create task
  async createTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId } = req.params

      // Validate request body
      const validatedData = createTaskSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id: projectId,
          tenantId: req.tenant.id,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isMember = await prisma.projectMember.findFirst({
        where: {
          projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // Create task
      const task = await prisma.task.create({
        data: {
          title: validatedData.title,
          description: validatedData.description,
          status: validatedData.status,
          priority: validatedData.priority,
          dueDate: validatedData.dueDate,
          assigneeId: validatedData.assigneeId,
          projectId,
        },
      })

      // Log task creation
      await prisma.projectAuditLog.create({
        data: {
          projectId,
          tenantId: req.tenant.id,
          action: "task_created",
          performedBy: req.user.id,
          details: JSON.stringify({
            taskId: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
          }),
        },
      })

      // Publish task created event
      await sendMessage("project-events", {
        type: "TASK_CREATED",
        data: {
          id: task.id,
          title: task.title,
          projectId: task.projectId,
          status: task.status,
          priority: task.priority,
          assigneeId: task.assigneeId,
          createdBy: req.user.id,
          createdAt: task.createdAt,
        },
      })

      logger.info(`Task created: ${task.id} (${task.title}) for project ${projectId}`)

      res.status(201).json({
        status: "success",
        data: task,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get task by ID
  async getTaskById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task with project
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              tenantId: true,
            },
          },
          comments: {
            orderBy: {
              createdAt: "asc",
            },
          },
          attachments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if project belongs to tenant
      if (task.project.tenantId !== req.tenant.id) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isMember = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this task")
      }

      res.status(200).json({
        status: "success",
        data: task,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update task
  async updateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updateTaskSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task with project
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if project belongs to tenant
      if (task.project.tenantId !== req.tenant.id) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this task")
      }

      // Regular members can only update tasks assigned to them
      if (userMembership?.role === "member" && task.assigneeId !== req.user.id && !isAdmin) {
        throw new ApiError(403, "You can only update tasks assigned to you")
      }

      // Update task
      const updatedTask = await prisma.task.update({
        where: { id },
        data: validatedData,
      })

      // Log task update
      await prisma.projectAuditLog.create({
        data: {
          projectId: task.projectId,
          tenantId: req.tenant.id,
          action: "task_updated",
          performedBy: req.user.id,
          details: JSON.stringify({
            taskId: task.id,
            before: {
              title: task.title,
              description: task.description,
              status: task.status,
              priority: task.priority,
              dueDate: task.dueDate,
              assigneeId: task.assigneeId,
            },
            after: {
              title: updatedTask.title,
              description: updatedTask.description,
              status: updatedTask.status,
              priority: updatedTask.priority,
              dueDate: updatedTask.dueDate,
              assigneeId: updatedTask.assigneeId,
            },
          }),
        },
      })

      // Publish task updated event
      await sendMessage("project-events", {
        type: "TASK_UPDATED",
        data: {
          id: updatedTask.id,
          title: updatedTask.title,
          projectId: updatedTask.projectId,
          status: updatedTask.status,
          priority: updatedTask.priority,
          assigneeId: updatedTask.assigneeId,
          updatedBy: req.user.id,
          updatedAt: updatedTask.updatedAt,
        },
      })

      logger.info(`Task updated: ${updatedTask.id} (${updatedTask.title})`)

      res.status(200).json({
        status: "success",
        data: updatedTask,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete task
  async deleteTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task with project
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if project belongs to tenant
      if (task.project.tenantId !== req.tenant.id) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this task")
      }

      // Regular members can only delete tasks they created or are assigned to them
      if (userMembership?.role === "member" && task.assigneeId !== req.user.id && !isAdmin) {
        throw new ApiError(403, "You can only delete tasks assigned to you")
      }

      // Log task deletion before actual deletion
      await prisma.projectAuditLog.create({
        data: {
          projectId: task.projectId,
          tenantId: req.tenant.id,
          action: "task_deleted",
          performedBy: req.user.id,
          details: JSON.stringify({
            taskId: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
          }),
        },
      })

      // Publish task deleted event
      await sendMessage("project-events", {
        type: "TASK_DELETED",
        data: {
          id: task.id,
          title: task.title,
          projectId: task.projectId,
          deletedBy: req.user.id,
          deletedAt: new Date().toISOString(),
        },
      })

      // Delete task
      await prisma.task.delete({
        where: { id },
      })

      logger.info(`Task deleted: ${id} (${task.title})`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Assign task
  async assignTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = assignTaskSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task with project
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if project belongs to tenant
      if (task.project.tenantId !== req.tenant.id) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this task")
      }

      // Check if assignee is a member of the project
      const assigneeMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: validatedData.assigneeId,
        },
      })

      if (!assigneeMembership) {
        throw new ApiError(400, "Assignee is not a member of this project")
      }

      // Update task
      const updatedTask = await prisma.task.update({
        where: { id },
        data: {
          assigneeId: validatedData.assigneeId,
        },
      })

      // Log task assignment
      await prisma.projectAuditLog.create({
        data: {
          projectId: task.projectId,
          tenantId: req.tenant.id,
          action: "task_assigned",
          performedBy: req.user.id,
          details: JSON.stringify({
            taskId: task.id,
            title: task.title,
            previousAssigneeId: task.assigneeId,
            newAssigneeId: validatedData.assigneeId,
          }),
        },
      })

      // Publish task assigned event
      await sendMessage("project-events", {
        type: "TASK_ASSIGNED",
        data: {
          id: updatedTask.id,
          title: updatedTask.title,
          projectId: updatedTask.projectId,
          assigneeId: updatedTask.assigneeId,
          assignedBy: req.user.id,
          assignedAt: updatedTask.updatedAt,
        },
      })

      logger.info(`Task ${id} assigned to user ${validatedData.assigneeId}`)

      res.status(200).json({
        status: "success",
        data: updatedTask,
      })
    } catch (error) {
      next(error)
    }
  }

  // Unassign task
  async unassignTask(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task with project
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if project belongs to tenant
      if (task.project.tenantId !== req.tenant.id) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this task")
      }

      // Check if task is assigned
      if (!task.assigneeId) {
        throw new ApiError(400, "Task is not assigned")
      }

      // Update task
      const updatedTask = await prisma.task.update({
        where: { id },
        data: {
          assigneeId: null,
        },
      })

      // Log task unassignment
      await prisma.projectAuditLog.create({
        data: {
          projectId: task.projectId,
          tenantId: req.tenant.id,
          action: "task_unassigned",
          performedBy: req.user.id,
          details: JSON.stringify({
            taskId: task.id,
            title: task.title,
            previousAssigneeId: task.assigneeId,
          }),
        },
      })

      // Publish task unassigned event
      await sendMessage("project-events", {
        type: "TASK_UNASSIGNED",
        data: {
          id: updatedTask.id,
          title: updatedTask.title,
          projectId: updatedTask.projectId,
          previousAssigneeId: task.assigneeId,
          unassignedBy: req.user.id,
          unassignedAt: updatedTask.updatedAt,
        },
      })

      logger.info(`Task ${id} unassigned`)

      res.status(200).json({
        status: "success",
        data: updatedTask,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update task status
  async updateTaskStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updateTaskStatusSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task with project
      const task = await prisma.task.findUnique({
        where: { id },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if project belongs to tenant
      if (task.project.tenantId !== req.tenant.id) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: task.projectId,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this task")
      }

      // Update task
      const updatedTask = await prisma.task.update({
        where: { id },
        data: {
          status: validatedData.status,
        },
      })

      // Log task status update
      await prisma.projectAuditLog.create({
        data: {
          projectId: task.projectId,
          tenantId: req.tenant.id,
          action: "task_status_updated",
          performedBy: req.user.id,
          details: JSON.stringify({
            taskId: task.id,
            title: task.title,
            previousStatus: task.status,
            newStatus: validatedData.status,
          }),
        },
      })

      // Publish task status updated event
      await sendMessage("project-events", {
        type: "TASK_STATUS_UPDATED",
        data: {
          id: updatedTask.id,
          title: updatedTask.title,
          projectId: updatedTask.projectId,
          previousStatus: task.status,
          newStatus: updatedTask.status,
          updatedBy: req.user.id,
          updatedAt: updatedTask.updatedAt,
        },
      })

      logger.info(`Task ${id} status updated from ${task.status} to ${validatedData.status}`)

      res.status(200).json({
        status: "success",
        data: updatedTask,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk create tasks
  async bulkCreateTasks(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkCreateTasksSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get project IDs
      const projectIds = [...new Set(validatedData.map((task) => task.projectId))]

      // Check if projects exist and belong to tenant
      const projects = await prisma.project.findMany({
        where: {
          id: { in: projectIds },
          tenantId: req.tenant.id,
        },
      })

      if (projects.length !== projectIds.length) {
        const foundIds = projects.map((project) => project.id)
        const missingIds = projectIds.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some projects not found: ${missingIds.join(", ")}`)
      }

      // Check if user has access to all projects
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      if (!isAdmin) {
        const memberships = await prisma.projectMember.findMany({
          where: {
            projectId: { in: projectIds },
            userId: req.user.id,
          },
        })

        if (memberships.length !== projectIds.length) {
          const memberProjectIds = memberships.map((membership) => membership.projectId)
          const inaccessibleProjectIds = projectIds.filter((id) => !memberProjectIds.includes(id))
          throw new ApiError(403, `You do not have access to some projects: ${inaccessibleProjectIds.join(", ")}`)
        }
      }

      // Create tasks in a transaction
      const createdTasks = await prisma.$transaction(
        validatedData.map((taskData) =>
          prisma.task.create({
            data: taskData,
          }),
        ),
      )

      // Log task creations
      await prisma.$transaction(
        createdTasks.map((task) =>
          prisma.projectAuditLog.create({
            data: {
              projectId: task.projectId,
              tenantId: req.tenant!.id,
              action: "task_created",
              performedBy: req.user!.id,
              details: JSON.stringify({
                taskId: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                assigneeId: task.assigneeId,
              }),
            },
          }),
        ),
      )

      // Publish task created events
      for (const task of createdTasks) {
        await sendMessage("project-events", {
          type: "TASK_CREATED",
          data: {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            createdBy: req.user.id,
            createdAt: task.createdAt,
          },
        })
      }

      logger.info(`Bulk created ${createdTasks.length} tasks`)

      res.status(201).json({
        status: "success",
        results: createdTasks.length,
        data: createdTasks,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk update tasks
  async bulkUpdateTasks(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkUpdateTasksSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get task IDs
      const taskIds = validatedData.map((task) => task.id)

      // Get tasks with projects
      const tasks = await prisma.task.findMany({
        where: {
          id: { in: taskIds },
        },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (tasks.length !== taskIds.length) {
        const foundIds = tasks.map((task) => task.id)
        const missingIds = taskIds.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some tasks not found: ${missingIds.join(", ")}`)
      }

      // Check if all tasks belong to tenant
      const nonTenantTasks = tasks.filter((task) => task.project.tenantId !== req.tenant!.id)
      if (nonTenantTasks.length > 0) {
        throw new ApiError(404, "Some tasks not found")
      }

      // Get project IDs
      const projectIds = [...new Set(tasks.map((task) => task.projectId))]

      // Check if user has access to all projects
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      if (!isAdmin) {
        const memberships = await prisma.projectMember.findMany({
          where: {
            projectId: { in: projectIds },
            userId: req.user.id,
          },
        })

        // For regular members, check if they can update all tasks
        if (memberships.some((membership) => membership.role === "member")) {
          const memberProjects = memberships
            .filter((membership) => membership.role === "member")
            .map((membership) => membership.projectId)

          const memberTasks = tasks.filter((task) => memberProjects.includes(task.projectId))
          const nonAssignedTasks = memberTasks.filter((task) => task.assigneeId !== req.user.id)

          if (nonAssignedTasks.length > 0) {
            throw new ApiError(403, "You can only update tasks assigned to you")
          }
        }
      }

      // Update tasks in a transaction
      const updatedTasks = await prisma.$transaction(
        validatedData.map((taskData) => {
          const { id, ...data } = taskData
          return prisma.task.update({
            where: { id },
            data,
          })
        }),
      )

      // Log task updates
      await prisma.$transaction(
        updatedTasks.map((updatedTask) => {
          const originalTask = tasks.find((task) => task.id === updatedTask.id)!
          return prisma.projectAuditLog.create({
            data: {
              projectId: updatedTask.projectId,
              tenantId: req.tenant!.id,
              action: "task_updated",
              performedBy: req.user!.id,
              details: JSON.stringify({
                taskId: updatedTask.id,
                before: {
                  title: originalTask.title,
                  description: originalTask.description,
                  status: originalTask.status,
                  priority: originalTask.priority,
                  dueDate: originalTask.dueDate,
                  assigneeId: originalTask.assigneeId,
                },
                after: {
                  title: updatedTask.title,
                  description: updatedTask.description,
                  status: updatedTask.status,
                  priority: updatedTask.priority,
                  dueDate: updatedTask.dueDate,
                  assigneeId: updatedTask.assigneeId,
                },
              }),
            },
          })
        }),
      )

      // Publish task updated events
      for (const task of updatedTasks) {
        await sendMessage("project-events", {
          type: "TASK_UPDATED",
          data: {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            updatedBy: req.user.id,
            updatedAt: task.updatedAt,
          },
        })
      }

      logger.info(`Bulk updated ${updatedTasks.length} tasks`)

      res.status(200).json({
        status: "success",
        results: updatedTasks.length,
        data: updatedTasks,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk delete tasks
  async bulkDeleteTasks(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkDeleteTasksSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get tasks with projects
      const tasks = await prisma.task.findMany({
        where: {
          id: { in: validatedData.ids },
        },
        include: {
          project: {
            select: {
              id: true,
              tenantId: true,
            },
          },
        },
      })

      if (tasks.length !== validatedData.ids.length) {
        const foundIds = tasks.map((task) => task.id)
        const missingIds = validatedData.ids.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some tasks not found: ${missingIds.join(", ")}`)
      }

      // Check if all tasks belong to tenant
      const nonTenantTasks = tasks.filter((task) => task.project.tenantId !== req.tenant!.id)
      if (nonTenantTasks.length > 0) {
        throw new ApiError(404, "Some tasks not found")
      }

      // Get project IDs
      const projectIds = [...new Set(tasks.map((task) => task.projectId))]

      // Check if user has access to all projects
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      if (!isAdmin) {
        const memberships = await prisma.projectMember.findMany({
          where: {
            projectId: { in: projectIds },
            userId: req.user.id,
          },
        })

        // For regular members, check if they can delete all tasks
        if (memberships.some((membership) => membership.role === "member")) {
          const memberProjects = memberships
            .filter((membership) => membership.role === "member")
            .map((membership) => membership.projectId)

          const memberTasks = tasks.filter((task) => memberProjects.includes(task.projectId))
          const nonAssignedTasks = memberTasks.filter((task) => task.assigneeId !== req.user.id)

          if (nonAssignedTasks.length > 0) {
            throw new ApiError(403, "You can only delete tasks assigned to you")
          }
        }
      }

      // Log task deletions before actual deletion
      await prisma.$transaction(
        tasks.map((task) =>
          prisma.projectAuditLog.create({
            data: {
              projectId: task.projectId,
              tenantId: req.tenant!.id,
              action: "task_deleted",
              performedBy: req.user!.id,
              details: JSON.stringify({
                taskId: task.id,
                title: task.title,
                status: task.status,
                priority: task.priority,
                assigneeId: task.assigneeId,
              }),
            },
          }),
        ),
      )

      // Publish task deleted events
      for (const task of tasks) {
        await sendMessage("project-events", {
          type: "TASK_DELETED",
          data: {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            deletedBy: req.user.id,
            deletedAt: new Date().toISOString(),
          },
        })
      }

      // Delete tasks
      await prisma.task.deleteMany({
        where: {
          id: { in: validatedData.ids },
        },
      })

      logger.info(`Bulk deleted ${tasks.length} tasks`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
