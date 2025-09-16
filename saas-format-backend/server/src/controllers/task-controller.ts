import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
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

export class TaskController {
  // Get tasks by project
  async getTasksByProject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
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
          projectId: id,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // Get tasks
      const tasks = await prisma.task.findMany({
        where: {
          projectId: id,
        },
        include: {
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
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
      const { id } = req.params

      // Validate request body
      const validatedData = createTaskSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
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
          projectId: id,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // If assignee is provided, check if they are a member of the project
      if (validatedData.assigneeId) {
        const assigneeIsMember = await prisma.projectMember.findFirst({
          where: {
            projectId: id,
            userId: validatedData.assigneeId,
          },
        })

        if (!assigneeIsMember) {
          throw new ApiError(400, "Assignee is not a member of this project")
        }
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
          projectId: id,
        },
        include: {
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      logger.info(`Task created: ${task.id} (${task.title}) for project ${id}`)

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
      const { id, taskId } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
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
          projectId: id,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // Get task
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          projectId: id,
        },
        include: {
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
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
      const { id, taskId } = req.params

      // Validate request body
      const validatedData = updateTaskSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if task exists
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          projectId: id,
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: id,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // Regular members can only update tasks assigned to them
      if (userMembership?.role === "member" && task.assigneeId !== req.user.id && !isAdmin) {
        throw new ApiError(403, "You can only update tasks assigned to you")
      }

      // If assignee is provided, check if they are a member of the project
      if (validatedData.assigneeId) {
        const assigneeIsMember = await prisma.projectMember.findFirst({
          where: {
            projectId: id,
            userId: validatedData.assigneeId,
          },
        })

        if (!assigneeIsMember) {
          throw new ApiError(400, "Assignee is not a member of this project")
        }
      }

      // Update task
      const updatedTask = await prisma.task.update({
        where: {
          id: taskId,
        },
        data: validatedData,
        include: {
          assignee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
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
      const { id, taskId } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if task exists
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          projectId: id,
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const userMembership = await prisma.projectMember.findFirst({
        where: {
          projectId: id,
          userId: req.user.id,
        },
      })

      if (!isAdmin && !userMembership) {
        throw new ApiError(403, "You do not have access to this project")
      }

      // Regular members can only delete tasks they created or are assigned to them
      if (userMembership?.role === "member" && task.assigneeId !== req.user.id && !isAdmin) {
        throw new ApiError(403, "You can only delete tasks assigned to you")
      }

      // Delete task
      await prisma.task.delete({
        where: {
          id: taskId,
        },
      })

      logger.info(`Task deleted: ${taskId}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
