import { TenantModel, type ITenant, TenantPlan, TenantStatus, TenantUserRole } from "../db/models/tenant.model"
import { UserModel } from "../db/models/user.model"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"
import mongoose from "mongoose"

export class TenantService {
  /**
   * Create a new tenant
   */
  public async createTenant(
    data: {
      name: string
      slug?: string
      description?: string
      plan?: TenantPlan
      ownerId: string
    },
    options: {
      skipOwnerCheck?: boolean
    } = {},
  ): Promise<ITenant> {
    try {
      const { name, slug, description, plan, ownerId } = data
      const { skipOwnerCheck = false } = options

      // Validate owner exists
      const owner = await UserModel.findById(ownerId)
      if (!owner && !skipOwnerCheck) {
        throw ApiError.badRequest("Owner user does not exist")
      }

      // Check if slug is already taken
      if (slug) {
        const existingTenant = await TenantModel.findOne({ slug })
        if (existingTenant) {
          throw ApiError.conflict("Tenant slug is already taken")
        }
      }

      // Set default plan limits based on plan
      const usageLimits = this.getPlanLimits(plan || TenantPlan.FREE)

      // Create new tenant
      const tenant = new TenantModel({
        name,
        slug,
        description,
        plan: plan || TenantPlan.FREE,
        status: TenantStatus.ACTIVE,
        users: [
          {
            userId: ownerId,
            role: TenantUserRole.OWNER,
            addedAt: new Date(),
            status: "active",
          },
        ],
        usageLimits,
      })

      await tenant.save()

      logger.info(`Tenant created: ${tenant.name} (${tenant._id})`)

      return tenant
    } catch (error) {
      logger.error("Error creating tenant:", error)
      throw error
    }
  }

  /**
   * Get tenant by ID
   */
  public async getTenantById(id: string): Promise<ITenant> {
    try {
      const tenant = await TenantModel.findById(id)

      if (!tenant) {
        throw ApiError.notFound("Tenant not found")
      }

      return tenant
    } catch (error) {
      logger.error(`Error getting tenant by ID ${id}:`, error)
      throw error
    }
  }

  /**
   * Get tenant by slug
   */
  public async getTenantBySlug(slug: string): Promise<ITenant> {
    try {
      const tenant = await TenantModel.findOne({ slug })

      if (!tenant) {
        throw ApiError.notFound("Tenant not found")
      }

      return tenant
    } catch (error) {
      logger.error(`Error getting tenant by slug ${slug}:`, error)
      throw error
    }
  }

  /**
   * Update tenant
   */
  public async updateTenant(id: string, data: Partial<ITenant>): Promise<ITenant> {
    try {
      // Ensure certain fields cannot be updated directly
      const safeData = { ...data }
      delete safeData.users
      delete safeData.currentUsage
      delete safeData.createdAt
      delete safeData.updatedAt

      const tenant = await TenantModel.findByIdAndUpdate(id, safeData, { new: true })

      if (!tenant) {
        throw ApiError.notFound("Tenant not found")
      }

      logger.info(`Tenant updated: ${tenant.name} (${tenant._id})`)

      return tenant
    } catch (error) {
      logger.error(`Error updating tenant ${id}:`, error)
      throw error
    }
  }

  /**
   * Delete tenant
   */
  public async deleteTenant(id: string): Promise<void> {
    try {
      const tenant = await TenantModel.findById(id)

      if (!tenant) {
        throw ApiError.notFound("Tenant not found")
      }

      // Archive tenant instead of deleting
      tenant.status = TenantStatus.ARCHIVED
      await tenant.save()

      logger.info(`Tenant archived: ${tenant.name} (${tenant._id})`)
    } catch (error) {
      logger.error(`Error deleting tenant ${id}:`, error)
      throw error
    }
  }

  /**
   * List tenants with pagination and filtering
   */
  public async listTenants(options: {
    page?: number
    limit?: number
    status?: TenantStatus
    search?: string
    plan?: TenantPlan
  }): Promise<{
    tenants: ITenant[]
    total: number
    page: number
    limit: number
    totalPages: number
  }> {
    try {
      const { page = 1, limit = 10, status, search, plan } = options

      // Build query
      const query: any = {}

      if (status) {
        query.status = status
      }

      if (plan) {
        query.plan = plan
      }

      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { slug: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ]
      }

      // Count total
      const total = await TenantModel.countDocuments(query)

      // Get tenants
      const tenants = await TenantModel.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)

      return {
        tenants,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    } catch (error) {
      logger.error("Error listing tenants:", error)
      throw error
    }
  }

  /**
   * Add user to tenant
   */
  public async addUserToTenant(
    tenantId: string,
    data: {
      userId: string
      role: TenantUserRole
      invitedBy?: string
    },
  ): Promise<ITenant> {
    try {
      const { userId, role, invitedBy } = data

      // Validate user exists
      const user = await UserModel.findById(userId)
      if (!user) {
        throw ApiError.badRequest("User does not exist")
      }

      // Get tenant
      const tenant = await this.getTenantById(tenantId)

      // Check if user is already in tenant
      const existingUser = tenant.users.find((u) => u.userId.toString() === userId)
      if (existingUser) {
        throw ApiError.conflict("User is already a member of this tenant")
      }

      // Check if tenant has reached user limit
      if (tenant.currentUsage.users >= tenant.usageLimits.maxUsers) {
        throw ApiError.badRequest("Tenant has reached the maximum number of users")
      }

      // Add user to tenant
      tenant.users.push({
        userId: new mongoose.Types.ObjectId(userId),
        role,
        addedAt: new Date(),
        invitedBy: invitedBy ? new mongoose.Types.ObjectId(invitedBy) : undefined,
        status: "invited",
      })

      // Update usage
      tenant.currentUsage.users += 1
      tenant.currentUsage.lastUpdated = new Date()

      await tenant.save()

      logger.info(`User ${userId} added to tenant ${tenantId} with role ${role}`)

      return tenant
    } catch (error) {
      logger.error(`Error adding user to tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Update user role in tenant
   */
  public async updateUserRole(tenantId: string, userId: string, role: TenantUserRole): Promise<ITenant> {
    try {
      const tenant = await this.getTenantById(tenantId)

      // Find user in tenant
      const userIndex = tenant.users.findIndex((u) => u.userId.toString() === userId)
      if (userIndex === -1) {
        throw ApiError.notFound("User is not a member of this tenant")
      }

      // Check if user is the owner
      if (tenant.users[userIndex].role === TenantUserRole.OWNER) {
        throw ApiError.badRequest("Cannot change the role of the tenant owner")
      }

      // Update role
      tenant.users[userIndex].role = role

      await tenant.save()

      logger.info(`User ${userId} role updated to ${role} in tenant ${tenantId}`)

      return tenant
    } catch (error) {
      logger.error(`Error updating user role in tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Remove user from tenant
   */
  public async removeUserFromTenant(tenantId: string, userId: string): Promise<ITenant> {
    try {
      const tenant = await this.getTenantById(tenantId)

      // Find user in tenant
      const userIndex = tenant.users.findIndex((u) => u.userId.toString() === userId)
      if (userIndex === -1) {
        throw ApiError.notFound("User is not a member of this tenant")
      }

      // Check if user is the owner
      if (tenant.users[userIndex].role === TenantUserRole.OWNER) {
        throw ApiError.badRequest("Cannot remove the tenant owner")
      }

      // Remove user
      tenant.users.splice(userIndex, 1)

      // Update usage
      tenant.currentUsage.users -= 1
      tenant.currentUsage.lastUpdated = new Date()

      await tenant.save()

      logger.info(`User ${userId} removed from tenant ${tenantId}`)

      return tenant
    } catch (error) {
      logger.error(`Error removing user from tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Get tenants for user
   */
  public async getUserTenants(userId: string): Promise<ITenant[]> {
    try {
      const tenants = await TenantModel.find({
        "users.userId": userId,
        status: { $ne: TenantStatus.ARCHIVED },
      })

      return tenants
    } catch (error) {
      logger.error(`Error getting tenants for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Check if user is member of tenant
   */
  public async isUserMemberOfTenant(tenantId: string, userId: string): Promise<boolean> {
    try {
      const tenant = await TenantModel.findOne({
        _id: tenantId,
        "users.userId": userId,
        status: { $ne: TenantStatus.ARCHIVED },
      })

      return !!tenant
    } catch (error) {
      logger.error(`Error checking if user ${userId} is member of tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Get user role in tenant
   */
  public async getUserRoleInTenant(tenantId: string, userId: string): Promise<TenantUserRole | null> {
    try {
      const tenant = await TenantModel.findOne({
        _id: tenantId,
        "users.userId": userId,
        status: { $ne: TenantStatus.ARCHIVED },
      })

      if (!tenant) {
        return null
      }

      const user = tenant.users.find((u) => u.userId.toString() === userId)
      return user ? user.role : null
    } catch (error) {
      logger.error(`Error getting user ${userId} role in tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Update tenant usage
   */
  public async updateTenantUsage(
    tenantId: string,
    usage: Partial<{
      storage: number
      contentTypes: number
      contents: number
      apiRequests: number
      webhooks: number
      workflows: number
    }>,
  ): Promise<ITenant> {
    try {
      const tenant = await this.getTenantById(tenantId)

      // Update usage
      if (usage.storage !== undefined) {
        tenant.currentUsage.storage = usage.storage
      }
      if (usage.contentTypes !== undefined) {
        tenant.currentUsage.contentTypes = usage.contentTypes
      }
      if (usage.contents !== undefined) {
        tenant.currentUsage.contents = usage.contents
      }
      if (usage.apiRequests !== undefined) {
        tenant.currentUsage.apiRequests = usage.apiRequests
      }
      if (usage.webhooks !== undefined) {
        tenant.currentUsage.webhooks = usage.webhooks
      }
      if (usage.workflows !== undefined) {
        tenant.currentUsage.workflows = usage.workflows
      }

      tenant.currentUsage.lastUpdated = new Date()

      await tenant.save()

      logger.info(`Tenant ${tenantId} usage updated`)

      return tenant
    } catch (error) {
      logger.error(`Error updating tenant ${tenantId} usage:`, error)
      throw error
    }
  }

  /**
   * Increment tenant API request count
   */
  public async incrementApiRequestCount(tenantId: string): Promise<void> {
    try {
      await TenantModel.updateOne(
        { _id: tenantId },
        {
          $inc: { "currentUsage.apiRequests": 1 },
          $set: { "currentUsage.lastUpdated": new Date() },
        },
      )
    } catch (error) {
      logger.error(`Error incrementing API request count for tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Reset tenant API request count (e.g., at the beginning of a new billing cycle)
   */
  public async resetApiRequestCount(tenantId: string): Promise<void> {
    try {
      await TenantModel.updateOne(
        { _id: tenantId },
        {
          $set: {
            "currentUsage.apiRequests": 0,
            "currentUsage.lastUpdated": new Date(),
          },
        },
      )

      logger.info(`API request count reset for tenant ${tenantId}`)
    } catch (error) {
      logger.error(`Error resetting API request count for tenant ${tenantId}:`, error)
      throw error
    }
  }

  /**
   * Update tenant plan
   */
  public async updateTenantPlan(tenantId: string, plan: TenantPlan): Promise<ITenant> {
    try {
      const tenant = await this.getTenantById(tenantId)

      // Update plan
      tenant.plan = plan

      // Update usage limits based on new plan
      tenant.usageLimits = this.getPlanLimits(plan)

      await tenant.save()

      logger.info(`Tenant ${tenantId} plan updated to ${plan}`)

      return tenant
    } catch (error) {
      logger.error(`Error updating tenant ${tenantId} plan:`, error)
      throw error
    }
  }

  /**
   * Update tenant status
   */
  public async updateTenantStatus(tenantId: string, status: TenantStatus): Promise<ITenant> {
    try {
      const tenant = await this.getTenantById(tenantId)

      // Update status
      tenant.status = status

      await tenant.save()

      logger.info(`Tenant ${tenantId} status updated to ${status}`)

      return tenant
    } catch (error) {
      logger.error(`Error updating tenant ${tenantId} status:`, error)
      throw error
    }
  }

  /**
   * Check if tenant has reached usage limit
   */
  public async checkTenantLimit(
    tenantId: string,
    limitType: keyof ITenant["usageLimits"],
  ): Promise<{
    hasReachedLimit: boolean
    currentUsage: number
    limit: number
  }> {
    try {
      const tenant = await this.getTenantById(tenantId)

      const currentUsage = tenant.currentUsage[limitType as keyof ITenant["currentUsage"]] as number
      const limit = tenant.usageLimits[limitType]

      return {
        hasReachedLimit: currentUsage >= limit,
        currentUsage,
        limit,
      }
    } catch (error) {
      logger.error(`Error checking tenant ${tenantId} limit for ${limitType}:`, error)
      throw error
    }
  }

  /**
   * Get plan limits based on plan type
   */
  private getPlanLimits(plan: TenantPlan): ITenant["usageLimits"] {
    switch (plan) {
      case TenantPlan.FREE:
        return {
          maxUsers: 3,
          maxStorage: 100, // 100 MB
          maxContentTypes: 5,
          maxContents: 100,
          maxApiRequests: 1000,
          maxWebhooks: 2,
          maxWorkflows: 1,
        }
      case TenantPlan.BASIC:
        return {
          maxUsers: 10,
          maxStorage: 1024, // 1 GB
          maxContentTypes: 20,
          maxContents: 1000,
          maxApiRequests: 10000,
          maxWebhooks: 10,
          maxWorkflows: 5,
        }
      case TenantPlan.PROFESSIONAL:
        return {
          maxUsers: 25,
          maxStorage: 10240, // 10 GB
          maxContentTypes: 50,
          maxContents: 10000,
          maxApiRequests: 100000,
          maxWebhooks: 25,
          maxWorkflows: 15,
        }
      case TenantPlan.ENTERPRISE:
        return {
          maxUsers: 100,
          maxStorage: 102400, // 100 GB
          maxContentTypes: 200,
          maxContents: 100000,
          maxApiRequests: 1000000,
          maxWebhooks: 100,
          maxWorkflows: 50,
        }
      default:
        return {
          maxUsers: 3,
          maxStorage: 100,
          maxContentTypes: 5,
          maxContents: 100,
          maxApiRequests: 1000,
          maxWebhooks: 2,
          maxWorkflows: 1,
        }
    }
  }
}
