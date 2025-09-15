import jwt from "jsonwebtoken"
import { UserRepository } from "../db/repositories/user.repository"
import { ApiError } from "../utils/errors"
import { config } from "../config"
import { UserRole } from "../db/models/user.model"
import { logger } from "../utils/logger"

export class AuthService {
  private userRepository: UserRepository

  constructor() {
    this.userRepository = new UserRepository()
  }

  /**
   * Register a new user
   */
  async register(userData: {
    email: string
    password: string
    firstName: string
    lastName: string
    role?: UserRole
  }): Promise<any> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(userData.email)
    if (existingUser) {
      throw ApiError.conflict("User with this email already exists")
    }

    // Create new user
    const user = await this.userRepository.create({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role || UserRole.VIEWER, // Default to VIEWER role
    })

    // Generate tokens
    const tokens = this.generateTokens(user)

    // Return user data and tokens
    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tokens,
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<any> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email)
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
    const tokens = this.generateTokens(user)

    // Return user data and tokens
    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tokens,
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<any> {
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
    const user = await this.userRepository.findById(decoded.id)
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
    return { tokens }
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Find user
    const user = await this.userRepository.findByIdOrThrow(userId)

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword)
    if (!isPasswordValid) {
      throw ApiError.unauthorized("Current password is incorrect")
    }

    // Update password
    user.password = newPassword
    await user.save()
  }

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<string | null> {
    // Find user by email
    const user = await this.userRepository.findByEmail(email)

    // Don't reveal if user exists or not
    if (!user) {
      return null
    }

    // Generate reset token
    const resetToken = jwt.sign({ id: user._id, type: "reset" }, config.jwt.secret, { expiresIn: "1h" })

    // In a real application, send an email with the reset link
    // For this example, we'll just return the token
    logger.info(`Reset token for ${email}: ${resetToken}`)

    return resetToken
  }

  /**
   * Reset password
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
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
    const user = await this.userRepository.findByIdOrThrow(decoded.id)

    // Update password
    user.password = newPassword
    await user.save()
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

  /**
   * Verify token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, config.jwt.secret)
    } catch (error) {
      throw ApiError.unauthorized("Invalid token")
    }
  }
}
