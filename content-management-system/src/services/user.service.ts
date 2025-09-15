import { UserRepository } from "../db/repositories/user.repository"
import { ApiError } from "../utils/errors"
import { UserRole } from "../db/models/user.model"

export class UserService {
  private userRepository: UserRepository

  constructor() {
    this.userRepository = new UserRepository()
  }

  /**
   * Get all users
   */
  async getAllUsers(
    filter: {
      search?: string
      role?: UserRole
      isActive?: boolean
    } = {},
    sort: {
      field?: string
      direction?: "asc" | "desc"
    } = {},
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    users: any[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.search) {
      const regex = new RegExp(filter.search, "i")
      filterQuery.$or = [{ email: regex }, { firstName: regex }, { lastName: regex }]
    }

    if (filter.role) {
      filterQuery.role = filter.role
    }

    if (filter.isActive !== undefined) {
      filterQuery.isActive = filter.isActive
    }

    // Build sort
    const sortQuery: any = {}
    if (sort.field) {
      sortQuery[sort.field] = sort.direction === "desc" ? -1 : 1
    } else {
      sortQuery.createdAt = -1 // Default sort by creation date descending
    }

    // Get paginated results
    const result = await this.userRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: sortQuery,
      projection: { password: 0 }, // Exclude password
    })

    return {
      users: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<any> {
    const user = await this.userRepository.findById(id, { password: 0 })
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }
    return user
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any> {
    const user = await this.userRepository.findByEmail(email)
    if (!user) {
      throw ApiError.notFound(`User not found with email: ${email}`)
    }
    return user
  }

  /**
   * Create user
   */
  async createUser(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    role?: UserRole
    isActive?: boolean
  }): Promise<any> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email)
    if (existingUser) {
      throw ApiError.conflict("User with this email already exists")
    }

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role || UserRole.VIEWER, // Default to VIEWER role
      isActive: data.isActive !== undefined ? data.isActive : true, // Default to active
    })

    // Return user without password
    const userWithoutPassword = user.toObject()
    delete userWithoutPassword.password
    return userWithoutPassword
  }

  /**
   * Update user
   */
  async updateUser(
    id: string,
    data: {
      email?: string
      firstName?: string
      lastName?: string
      role?: UserRole
      isActive?: boolean
    },
  ): Promise<any> {
    // Check if user exists
    const user = await this.userRepository.findById(id)
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }

    // Check if email is being changed and if it's already in use
    if (data.email && data.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(data.email)
      if (existingUser) {
        throw ApiError.conflict("User with this email already exists")
      }
    }

    // Update user
    const updatedUser = await this.userRepository.updateById(id, data)
    if (!updatedUser) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }

    // Return user without password
    const userWithoutPassword = updatedUser.toObject()
    delete userWithoutPassword.password
    return userWithoutPassword
  }

  /**
   * Delete user
   */
  async deleteUser(id: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findById(id)
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }

    // Delete user
    await this.userRepository.deleteById(id)
  }

  /**
   * Change password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    // Check if user exists
    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${userId}`)
    }

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
   * Activate user
   */
  async activateUser(id: string): Promise<any> {
    const user = await this.userRepository.activate(id)
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }

    // Return user without password
    const userWithoutPassword = user.toObject()
    delete userWithoutPassword.password
    return userWithoutPassword
  }

  /**
   * Deactivate user
   */
  async deactivateUser(id: string): Promise<any> {
    const user = await this.userRepository.deactivate(id)
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }

    // Return user without password
    const userWithoutPassword = user.toObject()
    delete userWithoutPassword.password
    return userWithoutPassword
  }

  /**
   * Change user role
   */
  async changeRole(id: string, role: UserRole): Promise<any> {
    const user = await this.userRepository.changeRole(id, role)
    if (!user) {
      throw ApiError.notFound(`User not found with ID: ${id}`)
    }

    // Return user without password
    const userWithoutPassword = user.toObject()
    delete userWithoutPassword.password
    return userWithoutPassword
  }

  /**
   * Search users
   */
  async searchUsers(query: string): Promise<any[]> {
    const users = await this.userRepository.search(query)

    // Return users without passwords
    return users.map((user) => {
      const userWithoutPassword = user.toObject()
      delete userWithoutPassword.password
      return userWithoutPassword
    })
  }
}
