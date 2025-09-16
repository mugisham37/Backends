import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  attachments: z.array(z.string().uuid()).optional(),
})

const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000).optional(),
  attachments: z.array(z.string().uuid()).optional(),
})

export class CommentController {
  // Create a new comment
  async createComment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      // Validate request body
      const validatedData = createCommentSchema.parse(req.body)

      // Check if task exists and belongs to tenant
      const task = await prisma.task.findFirst({
        where: {
          id: validatedData.taskId,
          project: {
            tenantId: req.tenant.id,
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Create comment with transaction to handle attachments
      const comment = await prisma.$transaction(async (tx) => {
        // Create the comment
        const newComment = await tx.comment.create({
          data: {
            taskId: validatedData.taskId,
            content: validatedData.content,
            authorId: req.user!.id,
          },
        })

        // If attachments provided, link them to the comment
        if (validatedData.attachments && validatedData.attachments.length > 0) {
          // Verify all attachments exist and belong to the tenant
          const attachments = await tx.attachment.findMany({
            where: {
              id: {
                in: validatedData.attachments,
              },
              task: {
                project: {
                  tenantId: req.tenant!.id,
                },
              },
            },
          })

          if (attachments.length !== validatedData.attachments.length) {
            throw new ApiError(400, "One or more attachments not found or not accessible")
          }

          // Link attachments to comment
          await Promise.all(
            validatedData.attachments.map((attachmentId) =>
              tx.commentAttachment.create({
                data: {
                  commentId: newComment.id,
                  attachmentId,
                },
              }),
            ),
          )
        }

        return newComment
      })

      // Get comment with author and attachments
      const commentWithDetails = await prisma.comment.findUnique({
        where: { id: comment.id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          attachments: {
            include: {
              attachment: true,
            },
          },
        },
      })

      // Publish comment created event
      await sendMessage("project-events", {
        type: "COMMENT_CREATED",
        data: {
          id: comment.id,
          taskId: comment.taskId,
          content: comment.content,
          authorId: comment.authorId,
          createdAt: comment.createdAt,
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Comment created: ${comment.id} for task ${comment.taskId}`)

      res.status(201).json({
        status: "success",
        data: commentWithDetails,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get comments for a task
  async getTaskComments(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { taskId } = req.params
      const page = Number.parseInt(req.query.page as string) || 1
      const limit = Number.parseInt(req.query.limit as string) || 20
      const skip = (page - 1) * limit

      // Check if task exists and belongs to tenant
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          project: {
            tenantId: req.tenant.id,
          },
        },
      })

      if (!task) {
        throw new ApiError(404, "Task not found")
      }

      // Get comments with pagination
      const [comments, total] = await Promise.all([
        prisma.comment.findMany({
          where: {
            taskId,
          },
          include: {
            author: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            attachments: {
              include: {
                attachment: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.comment.count({
          where: {
            taskId,
          },
        }),
      ])

      res.status(200).json({
        status: "success",
        results: comments.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: comments,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get comment by ID
  async getCommentById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { id } = req.params

      // Get comment with author and attachments
      const comment = await prisma.comment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          attachments: {
            include: {
              attachment: true,
            },
          },
        },
      })

      if (!comment) {
        throw new ApiError(404, "Comment not found")
      }

      res.status(200).json({
        status: "success",
        data: comment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update comment
  async updateComment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Validate request body
      const validatedData = updateCommentSchema.parse(req.body)

      // Check if comment exists and belongs to tenant and user
      const comment = await prisma.comment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
      })

      if (!comment) {
        throw new ApiError(404, "Comment not found")
      }

      // Check if user is the author or has admin/manager role
      if (comment.authorId !== req.user.id && !["admin", "manager"].includes(req.user.role)) {
        throw new ApiError(403, "You don't have permission to update this comment")
      }

      // Update comment with transaction to handle attachments
      const updatedComment = await prisma.$transaction(async (tx) => {
        // Update the comment
        const updated = await tx.comment.update({
          where: { id },
          data: {
            content: validatedData.content,
            updatedAt: new Date(),
          },
        })

        // If attachments provided, update them
        if (validatedData.attachments) {
          // Remove existing attachments
          await tx.commentAttachment.deleteMany({
            where: {
              commentId: id,
            },
          })

          // Verify all attachments exist and belong to the tenant
          const attachments = await tx.attachment.findMany({
            where: {
              id: {
                in: validatedData.attachments,
              },
              task: {
                project: {
                  tenantId: req.tenant!.id,
                },
              },
            },
          })

          if (attachments.length !== validatedData.attachments.length) {
            throw new ApiError(400, "One or more attachments not found or not accessible")
          }

          // Link attachments to comment
          await Promise.all(
            validatedData.attachments.map((attachmentId) =>
              tx.commentAttachment.create({
                data: {
                  commentId: id,
                  attachmentId,
                },
              }),
            ),
          )
        }

        return updated
      })

      // Get updated comment with author and attachments
      const commentWithDetails = await prisma.comment.findUnique({
        where: { id },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
          attachments: {
            include: {
              attachment: true,
            },
          },
        },
      })

      // Publish comment updated event
      await sendMessage("project-events", {
        type: "COMMENT_UPDATED",
        data: {
          id: updatedComment.id,
          taskId: updatedComment.taskId,
          content: updatedComment.content,
          authorId: updatedComment.authorId,
          updatedAt: updatedComment.updatedAt,
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Comment updated: ${updatedComment.id}`)

      res.status(200).json({
        status: "success",
        data: commentWithDetails,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete comment
  async deleteComment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Check if comment exists and belongs to tenant and user
      const comment = await prisma.comment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
      })

      if (!comment) {
        throw new ApiError(404, "Comment not found")
      }

      // Check if user is the author or has admin/manager role
      if (comment.authorId !== req.user.id && !["admin", "manager"].includes(req.user.role)) {
        throw new ApiError(403, "You don't have permission to delete this comment")
      }

      // Delete comment with transaction to handle attachments
      await prisma.$transaction(async (tx) => {
        // Delete comment attachments
        await tx.commentAttachment.deleteMany({
          where: {
            commentId: id,
          },
        })

        // Delete the comment
        await tx.comment.delete({
          where: { id },
        })
      })

      // Publish comment deleted event
      await sendMessage("project-events", {
        type: "COMMENT_DELETED",
        data: {
          id,
          taskId: comment.taskId,
          authorId: comment.authorId,
          deletedAt: new Date().toISOString(),
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Comment deleted: ${id}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }
}
