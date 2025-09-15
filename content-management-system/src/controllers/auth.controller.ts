import type { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { UserModel, UserRole } from "../db/models/user.model"
import { ApiError } from "../utils/errors"
import { config } from "../config"
import { logger } from "../utils/logger"

export class AuthController {
  /**
   * Register a new user
   */
  public register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, firstName, lastName, role } = req.body

      // Check if user already exists
      const existingUser = await UserModel.findOne({ email })
      if (existingUser) {
        throw ApiError.conflict("User with this email already exists")
      }

      // Create new user
      const user = new UserModel({
        email,
        password,
        firstName,
        lastName,
        role: role || UserRole.VIEWER, // Default to VIEWER role
      })

      await user.save()

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user)

      // Return user data and tokens
      res.status(201).json({
        status: "success",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Login user
   */
  public login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body

      // Find user by email
      const user = await UserModel.findOne({ email })
      if (!user) {
        throw ApiError.unauthorized("Invalid email or password")
      }

      // Check if user is active
      if (!user.isActive) {
        throw ApiError.unauthorized("Your account has been deactivated")
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password)
      if (!isPasswordValid) {
        throw ApiError.unauthorized("Invalid email or password")
      }

      // Update last login
      user.lastLogin = new Date()
      await user.save()

      // Generate tokens
      const { accessToken, refreshToken } = this.generateTokens(user)

      // Return user data and tokens
      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
          },
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Refresh access token
   */
  public refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body

      // Verify refresh token
      let decoded
      try {
        decoded = jwt.verify(refreshToken, config.jwt.secret) as {
          id: string
          type: string
        }
      } catch (error) {
        throw ApiError.unauthorized("Invalid refresh token")
      }

      // Check if token is a refresh token
      if (decoded.type !== "refresh") {
        throw ApiError.unauthorized("Invalid token type")
      }

      // Find user
      const user = await UserModel.findById(decoded.id)
      if (!user) {
        throw ApiError.unauthorized("User not found")
      }

      // Check if user is active
      if (!user.isActive) {
        throw ApiError.unauthorized("Your account has been deactivated")
      }

      // Generate new tokens
      const tokens = this.generateTokens(user)

      // Return new tokens
      res.status(200).json({
        status: "success",
        data: {
          tokens,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get current user
   */
  public getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user

      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: user._id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            lastLogin: user.lastLogin,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Logout user
   */
  public logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // In a stateless JWT system, we don't need to do anything server-side
      // The client should discard the tokens

      res.status(200).json({
        status: "success",
        message: "Successfully logged out",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Change password
   */
  public changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body
      const user = (req as any).user

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword)
      if (!isPasswordValid) {
        throw ApiError.unauthorized("Current password is incorrect")
      }

      // Update password
      user.password = newPassword
      await user.save()

      res.status(200).json({
        status: "success",
        message: "Password changed successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Request password reset
   */
  public forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body

      // Find user by email
      const user = await UserModel.findOne({ email })

      // Don't reveal if user exists or not
      if (!user) {
        return res.status(200).json({
          status: "success",
          message: "If your email is registered, you will receive a password reset link",
        })
      }

      // Generate reset token
      const resetToken = jwt.sign({ id: user._id, type: "reset" }, config.jwt.secret, { expiresIn: "1h" })

      // In a real application, send an email with the reset link
      // For this example, we'll just log it
      logger.info(`Reset token for ${email}: ${resetToken}`)

      res.status(200).json({
        status: "success",
        message: "If your email is registered, you will receive a password reset link",
        // Include token in response for testing purposes
        ...(config.isDevelopment && { resetToken }),
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Reset password
   */
  public resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token, newPassword } = req.body

      // Verify token
      let decoded
      try {
        decoded = jwt.verify(token, config.jwt.secret) as {
          id: string
          type: string
        }
      } catch (error) {
        throw ApiError.unauthorized("Invalid or expired token")
      }

      // Check if token is a reset token
      if (decoded.type !== "reset") {
        throw ApiError.unauthorized("Invalid token type")
      }

      // Find user
      const user = await UserModel.findById(decoded.id)
      if (!user) {
        throw ApiError.unauthorized("User not found")
      }

      // Update password
      user.password = newPassword
      await user.save()

      res.status(200).json({
        status: "success",
        message: "Password reset successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(user: any) {
    // Generate access token
    const accessToken = jwt.sign({ id: user._id, role: user.role, type: "access" }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    })

    // Generate refresh token
    const refreshToken = jwt.sign({ id: user._id, type: "refresh" }, config.jwt.secret, {
      expiresIn: config.jwt.refreshExpiresIn,
    })

    return { accessToken, refreshToken }
  }
}
