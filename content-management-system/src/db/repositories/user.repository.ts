import { BaseRepository } from "./base.repository"
import { UserModel, type IUser } from "../models/user.model"

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(UserModel)
  }

  /**
   * Find a user by email
   */
  async findByEmail(email: string): Promise<IUser | null> {
    return this.findOne({ email })
  }

  /**
   * Find a user by email or throw an error if not found
   */
  async findByEmailOrThrow(email: string): Promise<IUser> {
    const user = await this.findByEmail(email)
    if (!user) {
      throw new Error(`User not found with email: ${email}`)
    }
    return user
  }

  /**
   * Check if a user exists with the given email
   */
  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.count({ email })
    return count > 0
  }

  /**
   * Update a user's last login date
   */
  async updateLastLogin(userId: string): Promise<void> {
    await this.updateById(userId, { lastLogin: new Date() })
  }

  /**
   * Find users by role
   */
  async findByRole(role: string): Promise<IUser[]> {
    return this.find({ role })
  }

  /**
   * Find active users
   */
  async findActive(): Promise<IUser[]> {
    return this.find({ isActive: true })
  }

  /**
   * Find inactive users
   */
  async findInactive(): Promise<IUser[]> {
    return this.find({ isActive: false })
  }

  /**
   * Activate a user
   */
  async activate(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { isActive: true })
  }

  /**
   * Deactivate a user
   */
  async deactivate(userId: string): Promise<IUser | null> {
    return this.updateById(userId, { isActive: false })
  }

  /**
   * Change a user's role
   */
  async changeRole(userId: string, role: string): Promise<IUser | null> {
    return this.updateById(userId, { role })
  }

  /**
   * Search users by name or email
   */
  async search(query: string): Promise<IUser[]> {
    const regex = new RegExp(query, "i")
    return this.find({
      $or: [{ email: regex }, { firstName: regex }, { lastName: regex }],
    })
  }
}
