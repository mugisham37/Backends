import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { z } from "zod"

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
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

      // Check tenant project limits
      const tenantSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: req.tenant.id },
      })

      const projectCount = await prisma.project.count({
        where: { tenantId: req.tenant.id },
      })

      if (tenantSettings && projectCount >= tenantSettings.maxProjects) {
        throw new ApiError(403, "Maximum project limit reached for this tenant")
      }

      // Create project and add current user as owner
      const project = await prisma.project.create({
        data: {
          name: validatedData.name,
          description: validatedData.description,
          tenantId: req.tenant.id,
          members: {
            create: {
              userId: req.user.id,
              role: "owner",
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
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
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
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

      // Check if user has permission to update project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwner = project.members.some((member) => member.userId === req.user?.id && member.role === "owner")

      if (!isAdmin && !isOwner) {
        throw new ApiError(403, "Insufficient permissions to update this project")
      }

      // Update project
      const updatedProject = await prisma.project.update({
        where: { id },
        data: validatedData,
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
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

      // Check if user has permission to delete project
      const isAdmin = ["tenant_admin", "super_admin"].includes(req.user.role)
      const isOwner = project.members.some((member) => member.userId === req.user?.id && member.role === "owner")

      if (!isAdmin && !isOwner) {
        throw new ApiError(403, "Insufficient permissions to delete this project")
      }

      // Delete project (cascade will delete members and tasks)
      await prisma.project.delete({
        where: { id },
      })

      logger.info(`Project deleted: ${id} (${project.name})`)

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
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
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

      // Check if user to be added exists and belongs to tenant
      const userToAdd = await prisma.user.findFirst({
        where: {
          id: validatedData.userId,
          tenantId: req.tenant.id,
          isActive: true,
        },
      })

      if (!userToAdd) {
        throw new ApiError(404, "User not found or inactive")
      }

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
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
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
}
