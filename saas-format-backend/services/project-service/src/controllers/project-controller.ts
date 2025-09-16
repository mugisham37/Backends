import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  status: z.string().default("active"),
})

const updateProjectSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
})

const addProjectMemberSchema = z.object({
  userId: z.string(),
  role: z.string().default("member"),
})

const updateMemberRoleSchema = z.object({
  role: z.string(),
})

const bulkCreateProjectsSchema = z.array(
  z.object({
    name: z.string().min(2).max(100),
    description: z.string().optional(),
    status: z.string().default("active"),
  }),
)

const bulkUpdateProjectsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string().min(2).max(100).optional(),
    description: z.string().optional(),
    status: z.string().optional(),
  }),
)

const bulkDeleteProjectsSchema = z.object({
  ids: z.array(z.string()),
})

export class ProjectController {
  // Get all projects for current tenant
  async getAllProjects(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // For admin users, return all projects
      // For regular users, return only projects they are members of
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)

      const whereClause = isAdmin
        ? { tenantId: req.tenant.id }
        : {
            tenantId: req.tenant.id,
            members: {
              some: {
                userId: req.user.id,
              },
            },
          }

      const projects = await prisma.project.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              members: true,
              tasks: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: projects.length,
        data: projects,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create a new project
  async createProject(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = createProjectSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Create project and add current user as owner
      const project = await prisma.project.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          status: validatedData.status,
          tenantId: req.tenant.id,
          members: {
            create: {
              userId: req.user.id,
              role: "owner",
            },
          },
        },
        include: {
          members: true,
        },
      })

      // Log project creation
      await prisma.projectAuditLog.create({
        data: {
          projectId: project.id,
          tenantId: req.tenant.id,
          action: "created",
          performedBy: req.user.id,
          details: JSON.stringify({
            name: project.name,
            description: project.description,
            status: project.status,
          }),
        },
      })

      // Publish project created event
      await sendMessage("project-events", {
        type: "PROJECT_CREATED",
        data: {
          id: project.id,
          name: project.name,
          tenantId: project.tenantId,
          createdBy: req.user.id,
          createdAt: project.createdAt,
        },
      })

      logger.info(`Project created: ${project.id} (${project.name}) for tenant ${req.tenant.id}`)

      res.status(201).json({
        status: "success",
        data: project,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get project by ID
  async getProjectById(req: Request, res: Response, next: NextFunction) {
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
        include: {
          members: {
            select: {
              id: true,
              userId: true,
              role: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              tasks: true,
            },
          },
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has access to project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isMember = project.members.some((member) => member.userId === req.user?.id)

      if (!isAdmin && !isMember) {
        throw new ApiError(403, "You do not have access to this project")
      }

      res.status(200).json({
        status: "success",
        data: project,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update project
  async updateProject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updateProjectSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const existingProject = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (!existingProject) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has permission to update project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwnerOrManager = existingProject.members.some(
        (member) => member.userId === req.user?.id && ["owner", "manager"].includes(member.role),
      )

      if (!isAdmin && !isOwnerOrManager) {
        throw new ApiError(403, "Insufficient permissions to update this project")
      }

      // Update project
      const updatedProject = await prisma.project.update({
        where: { id },
        data: validatedData,
        include: {
          members: true,
        },
      })

      // Log project update
      await prisma.projectAuditLog.create({
        data: {
          projectId: updatedProject.id,
          tenantId: req.tenant.id,
          action: "updated",
          performedBy: req.user.id,
          details: JSON.stringify({
            before: {
              name: existingProject.name,
              description: existingProject.description,
              status: existingProject.status,
            },
            after: {
              name: updatedProject.name,
              description: updatedProject.description,
              status: updatedProject.status,
            },
          }),
        },
      })

      // Publish project updated event
      await sendMessage("project-events", {
        type: "PROJECT_UPDATED",
        data: {
          id: updatedProject.id,
          name: updatedProject.name,
          tenantId: updatedProject.tenantId,
          updatedBy: req.user.id,
          updatedAt: updatedProject.updatedAt,
        },
      })

      logger.info(`Project updated: ${updatedProject.id} (${updatedProject.name})`)

      res.status(200).json({
        status: "success",
        data: updatedProject,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete project
  async deleteProject(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const existingProject = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (!existingProject) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has permission to delete project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwner = existingProject.members.some(
        (member) => member.userId === req.user?.id && member.role === "owner",
      )

      if (!isAdmin && !isOwner) {
        throw new ApiError(403, "Insufficient permissions to delete this project")
      }

      // Log project deletion before actual deletion
      await prisma.projectAuditLog.create({
        data: {
          projectId: id,
          tenantId: req.tenant.id,
          action: "deleted",
          performedBy: req.user.id,
          details: JSON.stringify({
            name: existingProject.name,
            description: existingProject.description,
            status: existingProject.status,
          }),
        },
      })

      // Publish project deleted event
      await sendMessage("project-events", {
        type: "PROJECT_DELETED",
        data: {
          id: existingProject.id,
          name: existingProject.name,
          tenantId: existingProject.tenantId,
          deletedBy: req.user.id,
          deletedAt: new Date().toISOString(),
        },
      })

      // Delete project (cascade will delete members and tasks)
      await prisma.project.delete({
        where: { id },
      })

      logger.info(`Project deleted: ${id} (${existingProject.name})`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Get project members
  async getProjectMembers(req: Request, res: Response, next: NextFunction) {
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

      // Get project members
      const members = await prisma.projectMember.findMany({
        where: {
          projectId: id,
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      res.status(200).json({
        status: "success",
        results: members.length,
        data: members,
      })
    } catch (error) {
      next(error)
    }
  }

  // Add project member
  async addProjectMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = addProjectMemberSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has permission to add members
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwnerOrManager = project.members.some(
        (member) => member.userId === req.user?.id && ["owner", "manager"].includes(member.role),
      )

      if (!isAdmin && !isOwnerOrManager) {
        throw new ApiError(403, "Insufficient permissions to add members to this project")
      }

      // Check if user to be added exists
      // This would typically involve a call to the user service
      // For now, we'll just check if the user is already a member

      // Check if user is already a member
      const existingMember = await prisma.projectMember.findFirst({
        where: {
          projectId: id,
          userId: validatedData.userId,
        },
      })

      if (existingMember) {
        throw new ApiError(400, "User is already a member of this project")
      }

      // Add user to project
      const member = await prisma.projectMember.create({
        data: {
          projectId: id,
          userId: validatedData.userId,
          role: validatedData.role,
        },
      })

      // Log member addition
      await prisma.projectAuditLog.create({
        data: {
          projectId: id,
          tenantId: req.tenant.id,
          action: "member_added",
          performedBy: req.user.id,
          details: JSON.stringify({
            userId: validatedData.userId,
            role: validatedData.role,
          }),
        },
      })

      // Publish member added event
      await sendMessage("project-events", {
        type: "PROJECT_MEMBER_ADDED",
        data: {
          projectId: id,
          userId: validatedData.userId,
          role: validatedData.role,
          addedBy: req.user.id,
          addedAt: member.createdAt,
        },
      })

      logger.info(`User ${validatedData.userId} added to project ${id} with role ${validatedData.role}`)

      res.status(201).json({
        status: "success",
        data: member,
      })
    } catch (error) {
      next(error)
    }
  }

  // Remove project member
  async removeProjectMember(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has permission to remove members
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwnerOrManager = project.members.some(
        (member) => member.userId === req.user?.id && ["owner", "manager"].includes(member.role),
      )

      if (!isAdmin && !isOwnerOrManager) {
        throw new ApiError(403, "Insufficient permissions to remove members from this project")
      }

      // Check if member exists
      const member = await prisma.projectMember.findFirst({
        where: {
          projectId: id,
          userId,
        },
      })

      if (!member) {
        throw new ApiError(404, "Member not found in this project")
      }

      // Prevent removing the last owner
      if (member.role === "owner") {
        const ownerCount = project.members.filter((m) => m.role === "owner").length

        if (ownerCount <= 1) {
          throw new ApiError(400, "Cannot remove the last owner of the project")
        }
      }

      // Log member removal before actual deletion
      await prisma.projectAuditLog.create({
        data: {
          projectId: id,
          tenantId: req.tenant.id,
          action: "member_removed",
          performedBy: req.user.id,
          details: JSON.stringify({
            userId,
            role: member.role,
          }),
        },
      })

      // Publish member removed event
      await sendMessage("project-events", {
        type: "PROJECT_MEMBER_REMOVED",
        data: {
          projectId: id,
          userId,
          removedBy: req.user.id,
          removedAt: new Date().toISOString(),
        },
      })

      // Remove member
      await prisma.projectMember.delete({
        where: {
          id: member.id,
        },
      })

      logger.info(`User ${userId} removed from project ${id}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Update member role
  async updateMemberRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, userId } = req.params

      // Validate request body
      const validatedData = updateMemberRoleSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if project exists and belongs to tenant
      const project = await prisma.project.findFirst({
        where: {
          id,
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (!project) {
        throw new ApiError(404, "Project not found")
      }

      // Check if user has permission to update member roles
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwner = project.members.some((member) => member.userId === req.user?.id && member.role === "owner")

      if (!isAdmin && !isOwner) {
        throw new ApiError(403, "Insufficient permissions to update member roles")
      }

      // Check if member exists
      const member = await prisma.projectMember.findFirst({
        where: {
          projectId: id,
          userId,
        },
      })

      if (!member) {
        throw new ApiError(404, "Member not found in this project")
      }

      // Prevent removing the last owner if changing role from owner
      if (member.role === "owner" && validatedData.role !== "owner") {
        const ownerCount = project.members.filter((m) => m.role === "owner").length

        if (ownerCount <= 1) {
          throw new ApiError(400, "Cannot change role of the last owner of the project")
        }
      }

      // Update member role
      const updatedMember = await prisma.projectMember.update({
        where: {
          id: member.id,
        },
        data: {
          role: validatedData.role,
        },
      })

      // Log member role update
      await prisma.projectAuditLog.create({
        data: {
          projectId: id,
          tenantId: req.tenant.id,
          action: "member_role_updated",
          performedBy: req.user.id,
          details: JSON.stringify({
            userId,
            oldRole: member.role,
            newRole: validatedData.role,
          }),
        },
      })

      // Publish member role updated event
      await sendMessage("project-events", {
        type: "PROJECT_MEMBER_ROLE_UPDATED",
        data: {
          projectId: id,
          userId,
          oldRole: member.role,
          newRole: validatedData.role,
          updatedBy: req.user.id,
          updatedAt: updatedMember.updatedAt,
        },
      })

      logger.info(`User ${userId} role updated from ${member.role} to ${validatedData.role} in project ${id}`)

      res.status(200).json({
        status: "success",
        data: updatedMember,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get project statistics
  async getProjectStatistics(req: Request, res: Response, next: NextFunction) {
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

      // Get project statistics
      const [memberCount, taskCount, tasksByStatus, tasksByPriority] = await Promise.all([
        prisma.projectMember.count({
          where: {
            projectId: id,
          },
        }),
        prisma.task.count({
          where: {
            projectId: id,
          },
        }),
        prisma.task.groupBy({
          by: ["status"],
          where: {
            projectId: id,
          },
          _count: true,
        }),
        prisma.task.groupBy({
          by: ["priority"],
          where: {
            projectId: id,
          },
          _count: true,
        }),
      ])

      // Format task status counts
      const statusCounts: Record<string, number> = {}
      tasksByStatus.forEach((item) => {
        statusCounts[item.status] = item._count
      })

      // Format task priority counts
      const priorityCounts: Record<string, number> = {}
      tasksByPriority.forEach((item) => {
        priorityCounts[item.priority] = item._count
      })

      res.status(200).json({
        status: "success",
        data: {
          memberCount,
          taskCount,
          tasksByStatus: statusCounts,
          tasksByPriority: priorityCounts,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk create projects
  async bulkCreateProjects(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkCreateProjectsSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Create projects in a transaction
      const createdProjects = await prisma.$transaction(
        validatedData.map((projectData) =>
          prisma.project.create({
            data: {
              ...projectData,
              tenantId: req.tenant!.id,
              members: {
                create: {
                  userId: req.user!.id,
                  role: "owner",
                },
              },
            },
          }),
        ),
      )

      // Log project creations
      await prisma.$transaction(
        createdProjects.map((project) =>
          prisma.projectAuditLog.create({
            data: {
              projectId: project.id,
              tenantId: req.tenant!.id,
              action: "created",
              performedBy: req.user!.id,
              details: JSON.stringify({
                name: project.name,
                description: project.description,
                status: project.status,
              }),
            },
          }),
        ),
      )

      // Publish project created events
      for (const project of createdProjects) {
        await sendMessage("project-events", {
          type: "PROJECT_CREATED",
          data: {
            id: project.id,
            name: project.name,
            tenantId: project.tenantId,
            createdBy: req.user.id,
            createdAt: project.createdAt,
          },
        })
      }

      logger.info(`Bulk created ${createdProjects.length} projects for tenant ${req.tenant.id}`)

      res.status(201).json({
        status: "success",
        results: createdProjects.length,
        data: createdProjects,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk update projects
  async bulkUpdateProjects(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkUpdateProjectsSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Get project IDs
      const projectIds = validatedData.map((project) => project.id)

      // Check if projects exist and belong to tenant
      const existingProjects = await prisma.project.findMany({
        where: {
          id: { in: projectIds },
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (existingProjects.length !== projectIds.length) {
        const foundIds = existingProjects.map((project) => project.id)
        const missingIds = projectIds.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some projects not found: ${missingIds.join(", ")}`)
      }

      // Check if user has permission to update all projects
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      if (!isAdmin) {
        for (const project of existingProjects) {
          const isOwnerOrManager = project.members.some(
            (member) => member.userId === req.user?.id && ["owner", "manager"].includes(member.role),
          )
          if (!isOwnerOrManager) {
            throw new ApiError(403, `Insufficient permissions to update project ${project.id}`)
          }
        }
      }

      // Update projects in a transaction
      const updatedProjects = await prisma.$transaction(
        validatedData.map((projectData) => {
          const { id, ...data } = projectData
          return prisma.project.update({
            where: { id },
            data,
          })
        }),
      )

      // Log project updates
      await prisma.$transaction(
        updatedProjects.map((updatedProject) => {
          const existingProject = existingProjects.find((project) => project.id === updatedProject.id)!
          return prisma.projectAuditLog.create({
            data: {
              projectId: updatedProject.id,
              tenantId: req.tenant!.id,
              action: "updated",
              performedBy: req.user!.id,
              details: JSON.stringify({
                before: {
                  name: existingProject.name,
                  description: existingProject.description,
                  status: existingProject.status,
                },
                after: {
                  name: updatedProject.name,
                  description: updatedProject.description,
                  status: updatedProject.status,
                },
              }),
            },
          })
        }),
      )

      // Publish project updated events
      for (const project of updatedProjects) {
        await sendMessage("project-events", {
          type: "PROJECT_UPDATED",
          data: {
            id: project.id,
            name: project.name,
            tenantId: project.tenantId,
            updatedBy: req.user.id,
            updatedAt: project.updatedAt,
          },
        })
      }

      logger.info(`Bulk updated ${updatedProjects.length} projects for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        results: updatedProjects.length,
        data: updatedProjects,
      })
    } catch (error) {
      next(error)
    }
  }

  // Bulk delete projects
  async bulkDeleteProjects(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = bulkDeleteProjectsSchema.parse(req.body)

      if (!req.tenant || !req.user) {
        throw new ApiError(400, "Tenant and user are required")
      }

      // Check if projects exist and belong to tenant
      const existingProjects = await prisma.project.findMany({
        where: {
          id: { in: validatedData.ids },
          tenantId: req.tenant.id,
        },
        include: {
          members: true,
        },
      })

      if (existingProjects.length !== validatedData.ids.length) {
        const foundIds = existingProjects.map((project) => project.id)
        const missingIds = validatedData.ids.filter((id) => !foundIds.includes(id))
        throw new ApiError(404, `Some projects not found: ${missingIds.join(", ")}`)
      }

      // Check if user has permission to delete all projects
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      if (!isAdmin) {
        for (const project of existingProjects) {
          const isOwner = project.members.some((member) => member.userId === req.user?.id && member.role === "owner")
          if (!isOwner) {
            throw new ApiError(403, `Insufficient permissions to delete project ${project.id}`)
          }
        }
      }

      // Log project deletions before actual deletion
      await prisma.$transaction(
        existingProjects.map((project) =>
          prisma.projectAuditLog.create({
            data: {
              projectId: project.id,
              tenantId: req.tenant!.id,
              action: "deleted",
              performedBy: req.user!.id,
              details: JSON.stringify({
                name: project.name,
                description: project.description,
                status: project.status,
              }),
            },
          }),
        ),
      )

      // Publish project deleted events
      for (const project of existingProjects) {
        await sendMessage("project-events", {
          type: "PROJECT_DELETED",
          data: {
            id: project.id,
            name: project.name,
            tenantId: project.tenantId,
            deletedBy: req.user.id,
            deletedAt: new Date().toISOString(),
          },
        })
      }

      // Delete projects
      await prisma.project.deleteMany({
        where: {
          id: { in: validatedData.ids },
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Bulk deleted ${existingProjects.length} projects for tenant ${req.tenant.id}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
