import type { Request, Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import redisClient from "../utils/redis-client"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: z.string().default("user"),
  tenantId: z.string(),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
})

export class AuthController {
  // Register a new user
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = registerSchema.parse({
        ...req.body,
        tenantId: req.tenant?.id || req.body.tenantId,
      })

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          tenantId: validatedData.tenantId,
        },
      })

      if (existingUser) {
        throw new ApiError(400, "User with this email already exists")
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12)

      // Create user
      const user = await prisma.user.create({
        data: {
          email: validatedData.email,
          password: hashedPassword,
          firstName: validatedData.firstName,
          lastName: validatedData.lastName,
          role: validatedData.role,
          tenantId: validatedData.tenantId,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          createdAt: true,
        },
      })

      // Log the event
      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          event: "register",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          status: "success",
        },
      })

      // Publish user created event
      await sendMessage("user-events", {
        type: "USER_CREATED",
        data: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          createdAt: user.createdAt,
        },
      })

      logger.info(`User registered: ${user.id} (${user.email}) for tenant ${user.tenantId}`)

      res.status(201).json({
        status: "success",
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  // Login user
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = loginSchema.parse(req.body)

      // Check if tenant exists and is active
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Find user
      const user = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          tenantId: req.tenant.id,
          isActive: true,
        },
      })

      if (!user) {
        // Log failed login attempt
        await prisma.authAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            event: "login",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            status: "failure",
            details: "Invalid credentials",
          },
        })

        throw new ApiError(401, "Invalid credentials")
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password)

      if (!isPasswordValid) {
        // Log failed login attempt
        await prisma.authAuditLog.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            event: "login",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            status: "failure",
            details: "Invalid password",
          },
        })

        throw new ApiError(401, "Invalid credentials")
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        process.env.JWT_SECRET || "default-secret",
        {
          expiresIn: process.env.JWT_EXPIRATION || "1d",
        },
      )

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() },
      })

      // Log successful login
      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          event: "login",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          status: "success",
        },
      })

      // Publish login event
      await sendMessage("auth-events", {
        type: "USER_LOGGED_IN",
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          timestamp: new Date().toISOString(),
        },
      })

      logger.info(`User logged in: ${user.id} (${user.email})`)

      res.status(200).json({
        status: "success",
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Get current user
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          tenantId: true,
          lastLogin: true,
          createdAt: true,
        },
      })

      if (!user) {
        throw new ApiError(404, "User not found")
      }

      res.status(200).json({
        status: "success",
        data: user,
      })
    } catch (error) {
      next(error)
    }
  }

  // Logout user
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, "Authentication required")
      }

      const token = authHeader.split(" ")[1]

      // Add token to blacklist with expiry
      // Get token expiry from JWT
      const decoded = jwt.decode(token) as { exp?: number }
      const expiryTime = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400 // Default to 24h if exp not found

      // Add to blacklist
      await redisClient.set(`blacklist:${token}`, "1", "EX", expiryTime)

      // Log logout
      if (req.user) {
        await prisma.authAuditLog.create({
          data: {
            userId: req.user.id,
            tenantId: req.user.tenantId,
            event: "logout",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            status: "success",
          },
        })

        // Publish logout event
        await sendMessage("auth-events", {
          type: "USER_LOGGED_OUT",
          data: {
            userId: req.user.id,
            tenantId: req.user.tenantId,
            timestamp: new Date().toISOString(),
          },
        })

        logger.info(`User logged out: ${req.user.id}`)
      }

      res.status(200).json({
        status: "success",
        message: "Logged out successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  // Change password
  async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      // Validate request body
      const validatedData = changePasswordSchema.parse(req.body)

      // Get user with password
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      })

      if (!user) {
        throw new ApiError(404, "User not found")
      }

      // Check current password
      const isPasswordValid = await bcrypt.compare(validatedData.currentPassword, user.password)

      if (!isPasswordValid) {
        // Log failed password change
        await prisma.authAuditLog.create({
          data: {
            userId: user.id,
            tenantId: user.tenantId,
            event: "change_password",
            ipAddress: req.ip,
            userAgent: req.headers["user-agent"],
            status: "failure",
            details: "Current password is incorrect",
          },
        })

        throw new ApiError(401, "Current password is incorrect")
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(validatedData.newPassword, 12)

      // Update password
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
      })

      // Log successful password change
      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          event: "change_password",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          status: "success",
        },
      })

      // Publish password changed event
      await sendMessage("auth-events", {
        type: "PASSWORD_CHANGED",
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          timestamp: new Date().toISOString(),
        },
      })

      logger.info(`Password changed for user: ${req.user.id}`)

      res.status(200).json({
        status: "success",
        message: "Password changed successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  // Forgot password
  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = forgotPasswordSchema.parse(req.body)

      // Check if tenant exists and is active
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Find user
      const user = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          tenantId: req.tenant.id,
          isActive: true,
        },
      })

      // Don't reveal if user exists or not
      if (!user) {
        return res.status(200).json({
          status: "success",
          message: "If your email is registered, you will receive a password reset link",
        })
      }

      // Generate reset token
      const resetToken = uuidv4()
      const expiresAt = new Date(Date.now() + 3600000) // 1 hour from now

      // Store reset token
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          token: resetToken,
          expiresAt,
        },
      })

      // Log password reset request
      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          event: "forgot_password",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          status: "success",
        },
      })

      // Publish password reset requested event
      await sendMessage("auth-events", {
        type: "PASSWORD_RESET_REQUESTED",
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          email: user.email,
          resetToken,
          expiresAt: expiresAt.toISOString(),
        },
      })

      logger.info(`Password reset requested for user: ${user.id} (${user.email})`)

      res.status(200).json({
        status: "success",
        message: "If your email is registered, you will receive a password reset link",
        // Include token in response for demo purposes only
        resetToken,
      })
    } catch (error) {
      next(error)
    }
  }

  // Reset password
  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = resetPasswordSchema.parse(req.body)

      // Find password reset token
      const passwordReset = await prisma.passwordReset.findFirst({
        where: {
          token: validatedData.token,
          isUsed: false,
          expiresAt: {
            gt: new Date(),
          },
        },
      })

      if (!passwordReset) {
        throw new ApiError(400, "Invalid or expired token")
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: {
          id: passwordReset.userId,
          isActive: true,
        },
      })

      if (!user) {
        throw new ApiError(404, "User not found")
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(validatedData.password, 12)

      // Update password
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      })

      // Mark token as used
      await prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { isUsed: true },
      })

      // Log password reset
      await prisma.authAuditLog.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          event: "reset_password",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          status: "success",
        },
      })

      // Publish password reset event
      await sendMessage("auth-events", {
        type: "PASSWORD_RESET_COMPLETED",
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          timestamp: new Date().toISOString(),
        },
      })

      logger.info(`Password reset for user: ${user.id} (${user.email})`)

      res.status(200).json({
        status: "success",
        message: "Password reset successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  // Validate token
  async validateToken(req: Request, res: Response, next: NextFunction) {
    try {
      // If we got here, the token is valid (authMiddleware already verified it)
      if (!req.user) {
        throw new ApiError(401, "Not authenticated")
      }

      res.status(200).json({
        status: "success",
        data: req.user,
      })
    } catch (error) {
      next(error)
    }
  }
}
