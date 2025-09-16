import type { Request, Response, NextFunction } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import { z } from "zod"

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  role: z.string().default("user"),
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
      const validatedData = registerSchema.parse(req.body)

      // Check if tenant exists and is active
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if tenant allows signup
      const tenantSettings = await prisma.tenantSettings.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (tenantSettings && !tenantSettings.allowSignup) {
        throw new ApiError(403, "Signup is disabled for this tenant")
      }

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          email: validatedData.email,
          tenantId: req.tenant.id,
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
          tenantId: req.tenant.id,
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

      logger.info(`User registered: ${user.id} (${user.email}) for tenant ${req.tenant.id}`)

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
        throw new ApiError(401, "Invalid credentials")
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(validatedData.password, user.password)

      if (!isPasswordValid) {
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
  async logout(_req: Request, res: Response, _next: NextFunction) {
    // JWT is stateless, so we don't need to do anything server-side
    // Client should remove the token

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    })
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
        throw new ApiError(401, "Current password is incorrect")
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(validatedData.newPassword, 12)

      // Update password
      await prisma.user.update({
        where: { id: req.user.id },
        data: { password: hashedPassword },
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

      // Generate reset token (in a real app, you would store this securely)
      const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || "default-secret", { expiresIn: "1h" })

      // In a real app, you would send an email with the reset link
      logger.info(`Password reset requested for user: ${user.id} (${user.email})`)

      res.status(200).json({
        status: "success",
        message: "If your email is registered, you will receive a password reset link",
        // Include token in response for demo purposes only
        // In production, this would be sent via email
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

      // Verify token
      let decoded
      try {
        decoded = jwt.verify(validatedData.token, process.env.JWT_SECRET || "default-secret") as { id: string }
      } catch (error) {
        throw new ApiError(400, "Invalid or expired token")
      }

      // Find user
      const user = await prisma.user.findUnique({
        where: {
          id: decoded.id,
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

      logger.info(`Password reset for user: ${user.id} (${user.email})`)

      res.status(200).json({
        status: "success",
        message: "Password reset successfully",
      })
    } catch (error) {
      next(error)
    }
  }
}
