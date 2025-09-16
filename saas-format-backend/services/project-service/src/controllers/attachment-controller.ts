import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"
import axios from "axios"
import { v4 as uuidv4 } from "uuid"
import multer from "multer"
import path from "path"
import fs from "fs"
import { Storage } from "@google-cloud/storage"

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads")
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  },
})

export const upload = multer({ storage })

// Initialize Google Cloud Storage if configured
let cloudStorage: Storage | null = null
if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
  cloudStorage = new Storage({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  })
}

// Validation schemas
const createAttachmentSchema = z.object({
  taskId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  fileType: z.string().max(100),
  fileSize: z.number().int().positive(),
  url: z.string().url().optional(),
})

const updateAttachmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
})

export class AttachmentController {
  // Upload file and create attachment
  async uploadAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      if (!req.file) {
        throw new ApiError(400, "File is required")
      }

      const { taskId } = req.params
      const { name, description } = req.body

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

      // Get file details
      const file = req.file
      const fileSize = file.size
      const fileType = file.mimetype
      const fileName = name || file.originalname

      let fileUrl = ""

      // Upload to cloud storage if configured
      if (cloudStorage && process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
        const bucket = cloudStorage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET)
        const blob = bucket.file(`${req.tenant.id}/attachments/${uuidv4()}-${path.basename(file.path)}`)

        // Upload file
        await blob.save(fs.readFileSync(file.path))

        // Make file publicly accessible
        await blob.makePublic()

        // Get public URL
        fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`

        // Delete local file
        fs.unlinkSync(file.path)
      } else {
        // Use local file path (for development)
        fileUrl = `${req.protocol}://${req.get("host")}/uploads/${path.basename(file.path)}`
      }

      // Create attachment in database
      const attachment = await prisma.attachment.create({
        data: {
          taskId,
          name: fileName,
          description,
          fileType,
          fileSize,
          url: fileUrl,
          uploadedById: req.user.id,
        },
      })

      // Publish attachment created event
      await sendMessage("project-events", {
        type: "ATTACHMENT_CREATED",
        data: {
          id: attachment.id,
          taskId: attachment.taskId,
          name: attachment.name,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          uploadedById: attachment.uploadedById,
          createdAt: attachment.createdAt,
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Attachment uploaded: ${attachment.id} for task ${taskId}`)

      res.status(201).json({
        status: "success",
        data: attachment,
      })
    } catch (error) {
      // Clean up file if upload failed
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      next(error)
    }
  }

  // Create attachment from URL
  async createAttachmentFromUrl(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      // Validate request body
      const validatedData = createAttachmentSchema.parse(req.body)

      if (!validatedData.url) {
        throw new ApiError(400, "URL is required")
      }

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

      // Create attachment in database
      const attachment = await prisma.attachment.create({
        data: {
          taskId: validatedData.taskId,
          name: validatedData.name,
          description: validatedData.description,
          fileType: validatedData.fileType,
          fileSize: validatedData.fileSize,
          url: validatedData.url,
          uploadedById: req.user.id,
        },
      })

      // Publish attachment created event
      await sendMessage("project-events", {
        type: "ATTACHMENT_CREATED",
        data: {
          id: attachment.id,
          taskId: attachment.taskId,
          name: attachment.name,
          fileType: attachment.fileType,
          fileSize: attachment.fileSize,
          uploadedById: attachment.uploadedById,
          createdAt: attachment.createdAt,
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Attachment created from URL: ${attachment.id} for task ${validatedData.taskId}`)

      res.status(201).json({
        status: "success",
        data: attachment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get attachments for a task
  async getTaskAttachments(req: Request, res: Response, next: NextFunction) {
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

      // Get attachments with pagination
      const [attachments, total] = await Promise.all([
        prisma.attachment.findMany({
          where: {
            taskId,
          },
          include: {
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.attachment.count({
          where: {
            taskId,
          },
        }),
      ])

      res.status(200).json({
        status: "success",
        results: attachments.length,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        data: attachments,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get attachment by ID
  async getAttachmentById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { id } = req.params

      // Get attachment
      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      })

      if (!attachment) {
        throw new ApiError(404, "Attachment not found")
      }

      res.status(200).json({
        status: "success",
        data: attachment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update attachment
  async updateAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Validate request body
      const validatedData = updateAttachmentSchema.parse(req.body)

      // Check if attachment exists and belongs to tenant
      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
      })

      if (!attachment) {
        throw new ApiError(404, "Attachment not found")
      }

      // Check if user is the uploader or has admin/manager role
      if (attachment.uploadedById !== req.user.id && !["admin", "manager"].includes(req.user.role)) {
        throw new ApiError(403, "You don't have permission to update this attachment")
      }

      // Update attachment
      const updatedAttachment = await prisma.attachment.update({
        where: { id },
        data: {
          name: validatedData.name,
          description: validatedData.description,
          updatedAt: new Date(),
        },
        include: {
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      })

      // Publish attachment updated event
      await sendMessage("project-events", {
        type: "ATTACHMENT_UPDATED",
        data: {
          id: updatedAttachment.id,
          taskId: updatedAttachment.taskId,
          name: updatedAttachment.name,
          updatedAt: updatedAttachment.updatedAt,
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Attachment updated: ${updatedAttachment.id}`)

      res.status(200).json({
        status: "success",
        data: updatedAttachment,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete attachment
  async deleteAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      if (!req.user) {
        throw new ApiError(401, "User is required")
      }

      const { id } = req.params

      // Check if attachment exists and belongs to tenant
      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
      })

      if (!attachment) {
        throw new ApiError(404, "Attachment not found")
      }

      // Check if user is the uploader or has admin/manager role
      if (attachment.uploadedById !== req.user.id && !["admin", "manager"].includes(req.user.role)) {
        throw new ApiError(403, "You don't have permission to delete this attachment")
      }

      // Delete attachment with transaction to handle comment attachments
      await prisma.$transaction(async (tx) => {
        // Delete comment attachments
        await tx.commentAttachment.deleteMany({
          where: {
            attachmentId: id,
          },
        })

        // Delete the attachment
        await tx.attachment.delete({
          where: { id },
        })
      })

      // Delete file from storage if it's a local file
      if (attachment.url.includes(req.get("host") as string)) {
        const filePath = path.join(__dirname, "../uploads", attachment.url.split("/uploads/")[1])
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      }
      // Delete from cloud storage if configured
      else if (
        cloudStorage &&
        process.env.GOOGLE_CLOUD_STORAGE_BUCKET &&
        attachment.url.includes("storage.googleapis.com")
      ) {
        try {
          const bucket = cloudStorage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET)
          const fileName = attachment.url.split(`${process.env.GOOGLE_CLOUD_STORAGE_BUCKET}/`)[1]
          await bucket.file(fileName).delete()
        } catch (error) {
          logger.error(
            `Failed to delete file from cloud storage: ${error instanceof Error ? error.message : String(error)}`,
          )
          // Continue with the deletion even if cloud storage deletion fails
        }
      }

      // Publish attachment deleted event
      await sendMessage("project-events", {
        type: "ATTACHMENT_DELETED",
        data: {
          id,
          taskId: attachment.taskId,
          deletedAt: new Date().toISOString(),
          tenantId: req.tenant.id,
        },
      })

      logger.info(`Attachment deleted: ${id}`)

      res.status(204).send()
    } catch (error) {
      next(error)
    }
  }

  // Download attachment
  async downloadAttachment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { id } = req.params

      // Get attachment
      const attachment = await prisma.attachment.findFirst({
        where: {
          id,
          task: {
            project: {
              tenantId: req.tenant.id,
            },
          },
        },
      })

      if (!attachment) {
        throw new ApiError(404, "Attachment not found")
      }

      // If it's a local file
      if (attachment.url.includes(req.get("host") as string)) {
        const filePath = path.join(__dirname, "../uploads", attachment.url.split("/uploads/")[1])
        if (!fs.existsSync(filePath)) {
          throw new ApiError(404, "File not found")
        }

        res.download(filePath, attachment.name)
      }
      // If it's an external URL
      else {
        try {
          const response = await axios({
            method: "GET",
            url: attachment.url,
            responseType: "stream",
          })

          // Set headers
          res.setHeader("Content-Disposition", `attachment; filename="${attachment.name}"`)
          res.setHeader("Content-Type", attachment.fileType)

          // Pipe the file stream to the response
          response.data.pipe(res)
        } catch (error) {
          throw new ApiError(500, "Failed to download file from external source")
        }
      }

      // Log download
      logger.info(`Attachment downloaded: ${id}`)
    } catch (error) {
      next(error)
    }
  }
}
