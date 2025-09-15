import mongoose, { Schema, type Document, type Types } from "mongoose"
import { EventEmitter } from "events"
import { logger } from "../utils/logger"
import { WorkflowRepository, WorkflowEntryRepository } from "../db/repositories/workflow.repository"
import { ContentRepository } from "../db/repositories/content.repository"
import { UserRepository } from "../db/repositories/user.repository"
import { ApiError } from "../utils/errors"
import { WorkflowEntryStatus } from "../db/models/workflow.model"
import { schedulerService } from "./scheduler.service"
import { notificationService } from "./notification.service"
import { auditService } from "./audit.service"
import { withCache, invalidateCache } from "../db/redis"

// Define workflow step types
export enum WorkflowStepType {
  APPROVAL = "approval",
  NOTIFICATION = "notification",
  CONDITION = "condition",
  ACTION = "action",
  DELAY = "delay",
  FORK = "fork",
  JOIN = "join",
}

// Define workflow step status
export enum WorkflowStepStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  REJECTED = "rejected",
  SKIPPED = "skipped",
  FAILED = "failed",
}

// Define workflow status
export enum WorkflowStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

// Define workflow instance status
export enum WorkflowInstanceStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  SUSPENDED = "suspended",
}

// Define workflow trigger types
export enum WorkflowTriggerType {
  CONTENT_CREATED = "content_created",
  CONTENT_UPDATED = "content_updated",
  CONTENT_PUBLISHED = "content_published",
  CONTENT_UNPUBLISHED = "content_unpublished",
  CONTENT_DELETED = "content_deleted",
  CONTENT_STATUS_CHANGED = "content_status_changed",
  USER_CREATED = "user_created",
  USER_UPDATED = "user_updated",
  USER_DELETED = "user_deleted",
  MEDIA_UPLOADED = "media_uploaded",
  MEDIA_UPDATED = "media_updated",
  MEDIA_DELETED = "media_deleted",
  SCHEDULED = "scheduled",
  MANUAL = "manual",
  API = "api",
}

// Define workflow step interface
export interface IWorkflowStep {
  id: string
  name: string
  type: WorkflowStepType
  description?: string
  config: Record<string, any>
  nextSteps: string[]
  position: {
    x: number
    y: number
  }
}

// Define workflow interface
export interface IWorkflow extends Document {
  name: string
  description?: string
  status: WorkflowStatus
  contentTypeId?: Types.ObjectId
  steps: IWorkflowStep[]
  triggers: {
    type: WorkflowTriggerType
    config: Record<string, any>
  }[]
  startStepId: string
  createdBy: Types.ObjectId
  updatedBy?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
  version: number
  isDefault?: boolean
  tenantId?: Types.ObjectId
}

// Define workflow instance step interface
export interface IWorkflowInstanceStep {
  stepId: string
  status: WorkflowStepStatus
  startedAt?: Date
  completedAt?: Date
  assignedTo?: Types.ObjectId
  result?: any
  notes?: string
}

// Define workflow instance interface
export interface IWorkflowInstance extends Document {
  workflowId: Types.ObjectId
  contentId?: Types.ObjectId
  contentTypeId?: Types.ObjectId
  userId?: Types.ObjectId
  mediaId?: Types.ObjectId
  status: WorkflowInstanceStatus
  currentStepId?: string
  steps: IWorkflowInstanceStep[]
  data: Record<string, any>
  result?: any
  startedAt: Date
  completedAt?: Date
  cancelledAt?: Date
  cancelledBy?: Types.ObjectId
  createdBy: Types.ObjectId
  tenantId?: Types.ObjectId
}

// Define workflow step schema
const workflowStepSchema = new Schema<IWorkflowStep>(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(WorkflowStepType),
      required: true,
    },
    description: String,
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    nextSteps: {
      type: [String],
      default: [],
    },
    position: {
      x: {
        type: Number,
        default: 0,
      },
      y: {
        type: Number,
        default: 0,
      },
    },
  },
  { _id: false },
)

// Define workflow schema
const workflowSchema = new Schema<IWorkflow>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    status: {
      type: String,
      enum: Object.values(WorkflowStatus),
      default: WorkflowStatus.DRAFT,
    },
    contentTypeId: {
      type: Schema.Types.ObjectId,
      ref: "ContentType",
    },
    steps: {
      type: [workflowStepSchema],
      default: [],
    },
    triggers: [
      {
        type: {
          type: String,
          enum: Object.values(WorkflowTriggerType),
          required: true,
        },
        config: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    startStepId: {
      type: String,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    version: {
      type: Number,
      default: 1,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
    },
  },
  {
    timestamps: true,
  },
)

// Define workflow instance step schema
const workflowInstanceStepSchema = new Schema<IWorkflowInstanceStep>(
  {
    stepId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(WorkflowStepStatus),
      default: WorkflowStepStatus.PENDING,
    },
    startedAt: Date,
    completedAt: Date,
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    result: Schema.Types.Mixed,
    notes: String,
  },
  { _id: false },
)

// Define workflow instance schema
const workflowInstanceSchema = new Schema<IWorkflowInstance>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "Workflow",
      required: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      ref: "Content",
    },
    contentTypeId: {
      type: Schema.Types.ObjectId,
      ref: "ContentType",
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    mediaId: {
      type: Schema.Types.ObjectId,
      ref: "Media",
    },
    status: {
      type: String,
      enum: Object.values(WorkflowInstanceStatus),
      default: WorkflowInstanceStatus.PENDING,
    },
    currentStepId: String,
    steps: {
      type: [workflowInstanceStepSchema],
      default: [],
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    result: Schema.Types.Mixed,
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
    },
  },
  {
    timestamps: true,
  },
)

// Create indexes
workflowSchema.index({ name: 1, tenantId: 1 }, { unique: true })
workflowSchema.index({ contentTypeId: 1, status: 1 })
workflowSchema.index({ "triggers.type": 1 })
workflowSchema.index({ isDefault: 1, contentTypeId: 1, tenantId: 1 })

workflowInstanceSchema.index({ workflowId: 1 })
workflowInstanceSchema.index({ contentId: 1 })
workflowInstanceSchema.index({ contentTypeId: 1 })
workflowInstanceSchema.index({ userId: 1 })
workflowInstanceSchema.index({ mediaId: 1 })
workflowInstanceSchema.index({ status: 1 })
workflowInstanceSchema.index({ createdBy: 1 })
workflowInstanceSchema.index({ tenantId: 1 })

// Create models
export const WorkflowModel = mongoose.model<IWorkflow>("Workflow", workflowSchema)
export const WorkflowInstanceModel = mongoose.model<IWorkflowInstance>("WorkflowInstance", workflowInstanceSchema)

// Workflow service
export class WorkflowService extends EventEmitter {
  private workflowRepository: WorkflowRepository
  private workflowEntryRepository: WorkflowEntryRepository
  private contentRepository: ContentRepository
  private userRepository: UserRepository

  constructor() {
    super()
    this.setMaxListeners(100) // Allow more listeners
    this.workflowRepository = new WorkflowRepository()
    this.workflowEntryRepository = new WorkflowEntryRepository()
    this.contentRepository = new ContentRepository()
    this.userRepository = new UserRepository()
  }

  /**
   * Get all workflows
   */
  async getAllWorkflows(
    filter: {
      search?: string
      contentTypeId?: string
      isDefault?: boolean
    } = {},
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    workflows: any[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.search) {
      const regex = new RegExp(filter.search, "i")
      filterQuery.$or = [{ name: regex }, { description: regex }]
    }

    if (filter.contentTypeId) {
      filterQuery.contentTypes = filter.contentTypeId
    }

    if (filter.isDefault !== undefined) {
      filterQuery.isDefault = filter.isDefault
    }

    // Get paginated results
    const result = await this.workflowRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: { createdAt: -1 },
    })

    return {
      workflows: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get workflow by ID
   */
  async getWorkflowById(id: string): Promise<any> {
    return this.workflowRepository.findByIdOrThrow(id)
  }

  /**
   * Create workflow
   */
  async createWorkflow(data: {
    name: string
    description?: string
    contentTypeIds: string[]
    steps: any[]
    isDefault?: boolean
  }): Promise<any> {
    // Validate steps
    this.validateWorkflowSteps(data.steps)

    // Create workflow
    const workflow = await this.workflowRepository.create({
      name: data.name,
      description: data.description,
      contentTypes: data.contentTypeIds,
      steps: data.steps,
      isDefault: data.isDefault || false,
    })

    // If this is a default workflow, unset default flag for other workflows with the same content types
    if (data.isDefault) {
      await this.workflowRepository.setAsDefault(workflow._id.toString())
    }

    return workflow
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    id: string,
    data: {
      name?: string
      description?: string
      contentTypeIds?: string[]
      steps?: any[]
      isDefault?: boolean
    },
  ): Promise<any> {
    // Validate steps if provided
    if (data.steps) {
      this.validateWorkflowSteps(data.steps)
    }

    // Update workflow
    const workflow = await this.workflowRepository.updateByIdOrThrow(id, data)

    // If this is a default workflow, unset default flag for other workflows with the same content types
    if (data.isDefault) {
      await this.workflowRepository.setAsDefault(id)
    }

    return workflow
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(id: string): Promise<void> {
    // Check if there are active workflow entries using this workflow
    const activeEntries = await this.workflowEntryRepository.find({
      workflow: id,
      status: WorkflowEntryStatus.IN_PROGRESS,
    })

    if (activeEntries.length > 0) {
      throw ApiError.conflict("Cannot delete workflow with active entries")
    }

    await this.workflowRepository.deleteByIdOrThrow(id)
  }

  /**
   * Get workflow entries
   */
  async getWorkflowEntries(
    filter: {
      workflowId?: string
      contentId?: string
      status?: WorkflowEntryStatus
      assignedTo?: string
    } = {},
    pagination: {
      page?: number
      limit?: number
    } = {},
  ): Promise<{
    entries: any[]
    totalCount: number
    page: number
    totalPages: number
  }> {
    // Build filter
    const filterQuery: any = {}

    if (filter.workflowId) {
      filterQuery.workflow = filter.workflowId
    }

    if (filter.contentId) {
      filterQuery.content = filter.contentId
    }

    if (filter.status) {
      filterQuery.status = filter.status
    }

    if (filter.assignedTo) {
      filterQuery["steps.assignedTo"] = filter.assignedTo
    }

    // Get paginated results with populated references
    const result = await this.workflowEntryRepository.paginate(filterQuery, {
      page: pagination.page,
      limit: pagination.limit,
      sort: { updatedAt: -1 },
      populate: [
        { path: "workflow" },
        { path: "content" },
        { path: "currentStep" },
        { path: "steps.step" },
        { path: "steps.assignedTo", select: "-password" },
        { path: "steps.completedBy", select: "-password" },
      ],
    })

    return {
      entries: result.docs,
      totalCount: result.totalDocs,
      page: result.page,
      totalPages: result.totalPages,
    }
  }

  /**
   * Get workflow entry by ID
   */
  async getWorkflowEntryById(id: string): Promise<any> {
    const entry = await this.workflowEntryRepository.findByIdOrThrow(id)

    // Populate references
    await entry.populate([
      { path: "workflow" },
      { path: "content" },
      { path: "currentStep" },
      { path: "steps.step" },
      { path: "steps.assignedTo", select: "-password" },
      { path: "steps.completedBy", select: "-password" },
    ])

    return entry
  }

  /**
   * Start workflow
   */
  async startWorkflow(contentId: string, workflowId?: string): Promise<any> {
    // Get content
    const content = await this.contentRepository.findByIdOrThrow(contentId)

    // Get workflow
    let workflow
    if (workflowId) {
      workflow = await this.workflowRepository.findByIdOrThrow(workflowId)
    } else {
      // Find default workflow for content type
      workflow = await this.workflowRepository.findDefaultForContentType(content.contentType.toString())
      if (!workflow) {
        throw ApiError.notFound("No default workflow found for this content type")
      }
    }

    // Check if content type is supported by workflow
    const contentTypeId = content.contentType.toString()
    const isContentTypeSupported = workflow.contentTypes.some((ct: any) => ct.toString() === contentTypeId)
    if (!isContentTypeSupported) {
      throw ApiError.badRequest("Content type not supported by this workflow")
    }

    // Check if there's already an active workflow for this content
    const existingEntry = await this.workflowEntryRepository.findActiveForContent(contentId)
    if (existingEntry) {
      throw ApiError.conflict("Content already has an active workflow")
    }

    // Get first step
    const firstStep = workflow.steps.sort((a: any, b: any) => a.order - b.order)[0]
    if (!firstStep) {
      throw ApiError.badRequest("Workflow has no steps")
    }

    // Create workflow entry
    const entry = await this.workflowEntryRepository.create({
      workflow: workflow._id,
      content: contentId,
      status: WorkflowEntryStatus.IN_PROGRESS,
      currentStep: firstStep._id,
      steps: [
        {
          step: firstStep._id,
          status: WorkflowEntryStatus.IN_PROGRESS,
          createdAt: new Date(),
        },
      ],
    })

    // Populate references
    await entry.populate([{ path: "workflow" }, { path: "content" }, { path: "currentStep" }, { path: "steps.step" }])

    return entry
  }

  /**
   * Complete workflow step
   */
  async completeWorkflowStep(
    entryId: string,
    stepId: string,
    userId: string,
    approve: boolean,
    comments?: string,
  ): Promise<any> {
    // Complete step
    const entry = await this.workflowEntryRepository.completeStep(entryId, stepId, userId, approve, comments)

    // Populate references
    await entry.populate([
      { path: "workflow" },
      { path: "content" },
      { path: "currentStep" },
      { path: "steps.step" },
      { path: "steps.assignedTo", select: "-password" },
      { path: "steps.completedBy", select: "-password" },
    ])

    return entry
  }

  /**
   * Assign users to workflow step
   */
  async assignWorkflowStep(entryId: string, stepId: string, userIds: string[]): Promise<any> {
    // Validate users
    for (const userId of userIds) {
      await this.userRepository.findByIdOrThrow(userId)
    }

    // Assign users
    const entry = await this.workflowEntryRepository.assignUsers(entryId, stepId, userIds)

    // Populate references
    await entry.populate([
      { path: "workflow" },
      { path: "content" },
      { path: "currentStep" },
      { path: "steps.step" },
      { path: "steps.assignedTo", select: "-password" },
      { path: "steps.completedBy", select: "-password" },
    ])

    return entry
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(entryId: string): Promise<any> {
    // Cancel workflow
    const entry = await this.workflowEntryRepository.cancel(entryId)

    // Populate references
    await entry.populate([
      { path: "workflow" },
      { path: "content" },
      { path: "steps.step" },
      { path: "steps.assignedTo", select: "-password" },
      { path: "steps.completedBy", select: "-password" },
    ])

    return entry
  }

  /**
   * Validate workflow steps
   */
  private validateWorkflowSteps(steps: any[]): void {
    if (!steps || steps.length === 0) {
      throw ApiError.badRequest("Workflow must have at least one step")
    }

    // Check for duplicate orders
    const orders = steps.map((step) => step.order)
    const uniqueOrders = new Set(orders)
    if (uniqueOrders.size !== orders.length) {
      throw ApiError.badRequest("Workflow steps must have unique order values")
    }

    // Validate each step
    steps.forEach((step) => {
      if (!step.name) {
        throw ApiError.badRequest("Step name is required")
      }

      if (!step.type) {
        throw ApiError.badRequest("Step type is required")
      }

      if (!step.roles || step.roles.length === 0) {
        throw ApiError.badRequest("Step must have at least one role")
      }

      if (step.order === undefined || step.order === null) {
        throw ApiError.badRequest("Step order is required")
      }
    })
  }
}

// Workflow service
export class WorkflowService extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100) // Allow more listeners
  }

  /**
   * Create a new workflow
   */
  public async createWorkflow(data: {
    name: string
    description?: string
    contentTypeId?: string
    steps: IWorkflowStep[]
    triggers: {
      type: WorkflowTriggerType
      config: Record<string, any>
    }[]
    startStepId: string
    createdBy: string
    isDefault?: boolean
    tenantId?: string
  }): Promise<IWorkflow> {
    try {
      // Validate workflow
      this.validateWorkflow(data)

      // Check if default workflow already exists for content type
      if (data.isDefault && data.contentTypeId) {
        const existingDefault = await WorkflowModel.findOne({
          contentTypeId: data.contentTypeId,
          isDefault: true,
          ...(data.tenantId ? { tenantId: data.tenantId } : {}),
        })

        if (existingDefault) {
          throw ApiError.conflict(`A default workflow already exists for this content type: ${existingDefault.name}`)
        }
      }

      // Create workflow
      const workflow = new WorkflowModel({
        name: data.name,
        description: data.description,
        contentTypeId: data.contentTypeId,
        steps: data.steps,
        triggers: data.triggers,
        startStepId: data.startStepId,
        createdBy: data.createdBy,
        isDefault: data.isDefault || false,
        tenantId: data.tenantId,
      })

      await workflow.save()

      // Emit event
      this.emit("workflow:created", workflow)

      // Invalidate cache
      await invalidateCache(`workflows:*`)

      return workflow
    } catch (error) {
      logger.error("Error creating workflow:", error)
      throw error
    }
  }

  /**
   * Update a workflow
   */
  public async updateWorkflow(
    id: string,
    data: {
      name?: string
      description?: string
      status?: WorkflowStatus
      contentTypeId?: string
      steps?: IWorkflowStep[]
      triggers?: {
        type: WorkflowTriggerType
        config: Record<string, any>
      }[]
      startStepId?: string
      updatedBy: string
      isDefault?: boolean
    },
  ): Promise<IWorkflow> {
    try {
      const workflow = await WorkflowModel.findById(id)
      if (!workflow) {
        throw ApiError.notFound("Workflow not found")
      }

      // Check if workflow is being set as default
      if (data.isDefault && data.isDefault !== workflow.isDefault && workflow.contentTypeId) {
        const existingDefault = await WorkflowModel.findOne({
          _id: { $ne: id },
          contentTypeId: workflow.contentTypeId,
          isDefault: true,
          ...(workflow.tenantId ? { tenantId: workflow.tenantId } : {}),
        })

        if (existingDefault) {
          throw ApiError.conflict(`A default workflow already exists for this content type: ${existingDefault.name}`)
        }
      }

      // Update fields
      if (data.name !== undefined) workflow.name = data.name
      if (data.description !== undefined) workflow.description = data.description
      if (data.status !== undefined) workflow.status = data.status
      if (data.contentTypeId !== undefined) workflow.contentTypeId = new mongoose.Types.ObjectId(data.contentTypeId)
      if (data.steps !== undefined) {
        // Validate steps
        this.validateWorkflowSteps(data.steps, data.startStepId || workflow.startStepId)
        workflow.steps = data.steps
      }
      if (data.triggers !== undefined) workflow.triggers = data.triggers
      if (data.startStepId !== undefined) workflow.startStepId = data.startStepId
      if (data.isDefault !== undefined) workflow.isDefault = data.isDefault

      workflow.updatedBy = new mongoose.Types.ObjectId(data.updatedBy)
      workflow.version += 1

      await workflow.save()

      // Emit event
      this.emit("workflow:updated", workflow)

      // Invalidate cache
      await invalidateCache(`workflows:*`)
      await invalidateCache(`workflow:${id}`)

      return workflow
    } catch (error) {
      logger.error(`Error updating workflow ${id}:`, error)
      throw error
    }
  }

  /**
   * Get a workflow by ID
   */
  public async getWorkflow(id: string): Promise<IWorkflow> {
    try {
      const cacheKey = `workflow:${id}`
      return await withCache(
        cacheKey,
        async () => {
          const workflow = await WorkflowModel.findById(id)
          if (!workflow) {
            throw ApiError.notFound("Workflow not found")
          }
          return workflow
        },
        { ttl: 3600 }, // Cache for 1 hour
      )
    } catch (error) {
      logger.error(`Error getting workflow ${id}:`, error)
      throw error
    }
  }

  /**
   * Get workflows with filtering and pagination
   */
  public async getWorkflows(params: {
    contentTypeId?: string
    status?: WorkflowStatus | WorkflowStatus[]
    triggerType?: WorkflowTriggerType
    isDefault?: boolean
    search?: string
    page?: number
    limit?: number
    sort?: string
    order?: "asc" | "desc"
    tenantId?: string
  }): Promise<{
    workflows: IWorkflow[]
    total: number
    page: number
    limit: number
    pages: number
  }> {
    try {
      const {
        contentTypeId,
        status,
        triggerType,
        isDefault,
        search,
        page = 1,
        limit = 20,
        sort = "createdAt",
        order = "desc",
        tenantId,
      } = params

      // Build query
      const query: any = {}

      if (contentTypeId) {
        query.contentTypeId = contentTypeId
      }

      if (status) {
        query.status = Array.isArray(status) ? { $in: status } : status
      }

      if (triggerType) {
        query["triggers.type"] = triggerType
      }

      if (isDefault !== undefined) {
        query.isDefault = isDefault
      }

      if (search) {
        query.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]
      }

      if (tenantId) {
        query.tenantId = tenantId
      }

      // Cache key
      const cacheKey = `workflows:${JSON.stringify({
        query,
        page,
        limit,
        sort,
        order,
      })}`

      return await withCache(
        cacheKey,
        async () => {
          // Count total
          const total = await WorkflowModel.countDocuments(query)

          // Get workflows
          const workflows = await WorkflowModel.find(query)
            .sort({ [sort]: order === "asc" ? 1 : -1 })
            .skip((page - 1) * limit)
            .limit(limit)

          return {
            workflows,
            total,
            page,
            limit,
            pages: Math.ceil(total / limit),
          }
        },
        { ttl: 300 }, // Cache for 5 minutes
      )
    } catch (error) {
      logger.error("Error getting workflows:", error)
      throw error
    }
  }

  /**
   * Delete a workflow
   */
  public async deleteWorkflow(id: string): Promise<void> {
    try {
      const workflow = await WorkflowModel.findById(id)
      if (!workflow) {
        throw ApiError.notFound("Workflow not found")
      }

      // Check if workflow has active instances
      const activeInstances = await WorkflowInstanceModel.countDocuments({
        workflowId: id,
        status: { $in: [WorkflowInstanceStatus.PENDING, WorkflowInstanceStatus.RUNNING] },
      })

      if (activeInstances > 0) {
        throw ApiError.conflict(`Cannot delete workflow with ${activeInstances} active instances`)
      }

      await workflow.deleteOne()

      // Emit event
      this.emit("workflow:deleted", workflow)

      // Invalidate cache
      await invalidateCache(`workflows:*`)
      await invalidateCache(`workflow:${id}`)
    } catch (error) {
      logger.error(`Error deleting workflow ${id}:`, error)
      throw error
    }
  }

  /**
   * Get default workflow for content type
   */
  public async getDefaultWorkflow(contentTypeId: string, tenantId?: string): Promise<IWorkflow | null> {
    try {
      const cacheKey = `workflow:default:${contentTypeId}:${tenantId || "global"}`
      return await withCache(
        cacheKey,
        async () => {
          return await WorkflowModel.findOne({
            contentTypeId,
            isDefault: true,
            status: WorkflowStatus.ACTIVE,
            ...(tenantId ? { tenantId } : {}),
          })
        },
        { ttl: 3600 }, // Cache for 1 hour
      )
    } catch (error) {
      logger.error(`Error getting default workflow for content type ${contentTypeId}:`, error)
      throw error
    }
  }

  /**
   * Trigger workflow
   */
  public async triggerWorkflow(params: {
    triggerType: WorkflowTriggerType
    contentId?: string
    contentTypeId?: string
    userId?: string
    mediaId?: string
    data?: Record<string, any>
    createdBy: string
    tenantId?: string
  }): Promise<IWorkflowInstance | null> {
    try {
      const { triggerType, contentId, contentTypeId, userId, mediaId, data = {}, createdBy, tenantId } = params

      // Find matching workflows
      const query: any = {
        "triggers.type": triggerType,
        status: WorkflowStatus.ACTIVE,
      }

      if (contentTypeId) {
        query.contentTypeId = contentTypeId
      }

      if (tenantId) {
        query.tenantId = tenantId
      }

      const workflows = await WorkflowModel.find(query)

      if (workflows.length === 0) {
        logger.debug(`No workflows found for trigger ${triggerType}`)
        return null
      }

      // Use default workflow if available, otherwise use the first one
      const workflow = workflows.find((w) => w.isDefault) || workflows[0]

      // Create workflow instance
      const instance = await this.createWorkflowInstance({
        workflowId: workflow._id.toString(),
        contentId,
        contentTypeId,
        userId,
        mediaId,
        data,
        createdBy,
        tenantId,
      })

      return instance
    } catch (error) {
      logger.error(`Error triggering workflow for ${params.triggerType}:`, error)
      throw error
    }
  }

  /**
   * Create workflow instance
   */
  public async createWorkflowInstance(params: {
    workflowId: string
    contentId?: string
    contentTypeId?: string
    userId?: string
    mediaId?: string
    data?: Record<string, any>
    createdBy: string
    tenantId?: string
  }): Promise<IWorkflowInstance> {
    try {
      const { workflowId, contentId, contentTypeId, userId, mediaId, data = {}, createdBy, tenantId } = params

      // Get workflow
      const workflow = await this.getWorkflow(workflowId)

      // Create instance
      const instance = new WorkflowInstanceModel({
        workflowId,
        contentId,
        contentTypeId: contentTypeId || workflow.contentTypeId,
        userId,
        mediaId,
        status: WorkflowInstanceStatus.PENDING,
        currentStepId: workflow.startStepId,
        data,
        createdBy,
        tenantId,
      })

      await instance.save()

      // Emit event
      this.emit("workflow:instance:created", instance)

      // Start workflow execution
      setImmediate(() => {
        this.executeWorkflowInstance(instance._id.toString()).catch((error) => {
          logger.error(`Error executing workflow instance ${instance._id}:`, error)
        })
      })

      return instance
    } catch (error) {
      logger.error("Error creating workflow instance:", error)
      throw error
    }
  }

  /**
   * Get workflow instance
   */
  public async getWorkflowInstance(id: string): Promise<IWorkflowInstance> {
    try {
      const instance = await WorkflowInstanceModel.findById(id)
      if (!instance) {
        throw ApiError.notFound("Workflow instance not found")
      }
      return instance
    } catch (error) {
      logger.error(`Error getting workflow instance ${id}:`, error)
      throw error
    }
  }

  /**
   * Get workflow instances with filtering and pagination
   */
  public async getWorkflowInstances(params: {
    workflowId?: string
    contentId?: string
    contentTypeId?: string
    userId?: string
    mediaId?: string
    status?: WorkflowInstanceStatus | WorkflowInstanceStatus[]
    createdBy?: string
    page?: number
    limit?: number
    sort?: string
    order?: "asc" | "desc"
    tenantId?: string
  }): Promise<{
    instances: IWorkflowInstance[]
    total: number
    page: number
    limit: number
    pages: number
  }> {
    try {
      const {
        workflowId,
        contentId,
        contentTypeId,
        userId,
        mediaId,
        status,
        createdBy,
        page = 1,
        limit = 20,
        sort = "createdAt",
        order = "desc",
        tenantId,
      } = params

      // Build query
      const query: any = {}

      if (workflowId) {
        query.workflowId = workflowId
      }

      if (contentId) {
        query.contentId = contentId
      }

      if (contentTypeId) {
        query.contentTypeId = contentTypeId
      }

      if (userId) {
        query.userId = userId
      }

      if (mediaId) {
        query.mediaId = mediaId
      }

      if (status) {
        query.status = Array.isArray(status) ? { $in: status } : status
      }

      if (createdBy) {
        query.createdBy = createdBy
      }

      if (tenantId) {
        query.tenantId = tenantId
      }

      // Count total
      const total = await WorkflowInstanceModel.countDocuments(query)

      // Get instances
      const instances = await WorkflowInstanceModel.find(query)
        .sort({ [sort]: order === "asc" ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)

      return {
        instances,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      }
    } catch (error) {
      logger.error("Error getting workflow instances:", error)
      throw error
    }
  }

  /**
   * Cancel workflow instance
   */
  public async cancelWorkflowInstance(id: string, userId: string): Promise<IWorkflowInstance> {
    try {
      const instance = await WorkflowInstanceModel.findById(id)
      if (!instance) {
        throw ApiError.notFound("Workflow instance not found")
      }

      // Check if instance can be cancelled
      if (
        instance.status !== WorkflowInstanceStatus.PENDING &&
        instance.status !== WorkflowInstanceStatus.RUNNING &&
        instance.status !== WorkflowInstanceStatus.SUSPENDED
      ) {
        throw ApiError.badRequest(`Cannot cancel workflow instance with status ${instance.status}`)
      }

      // Update instance
      instance.status = WorkflowInstanceStatus.CANCELLED
      instance.cancelledAt = new Date()
      instance.cancelledBy = new mongoose.Types.ObjectId(userId)
      await instance.save()

      // Emit event
      this.emit("workflow:instance:cancelled", instance)

      // Log audit
      await auditService.createAuditLog({
        action: "workflow_instance_cancelled",
        entityType: "workflow_instance",
        entityId: instance._id.toString(),
        userId,
        metadata: {
          workflowId: instance.workflowId.toString(),
          contentId: instance.contentId?.toString(),
          contentTypeId: instance.contentTypeId?.toString(),
        },
      })

      return instance
    } catch (error) {
      logger.error(`Error cancelling workflow instance ${id}:`, error)
      throw error
    }
  }

  /**
   * Complete workflow step
   */
  public async completeWorkflowStep(params: {
    instanceId: string
    stepId: string
    userId: string
    result?: any
    notes?: string
    nextStepId?: string
  }): Promise<IWorkflowInstance> {
    try {
      const { instanceId, stepId, userId, result, notes, nextStepId } = params

      const instance = await WorkflowInstanceModel.findById(instanceId)
      if (!instance) {
        throw ApiError.notFound("Workflow instance not found")
      }

      // Check if instance is active
      if (instance.status !== WorkflowInstanceStatus.RUNNING && instance.status !== WorkflowInstanceStatus.PENDING) {
        throw ApiError.badRequest(`Cannot complete step in workflow instance with status ${instance.status}`)
      }

      // Check if step exists and is current
      if (instance.currentStepId !== stepId) {
        throw ApiError.badRequest(`Step ${stepId} is not the current step of the workflow instance`)
      }

      // Get workflow
      const workflow = await this.getWorkflow(instance.workflowId.toString())

      // Find step
      const step = workflow.steps.find((s) => s.id === stepId)
      if (!step) {
        throw ApiError.badRequest(`Step ${stepId} not found in workflow`)
      }

      // Update step status
      const stepIndex = instance.steps.findIndex((s) => s.stepId === stepId)
      if (stepIndex >= 0) {
        instance.steps[stepIndex].status = WorkflowStepStatus.COMPLETED
        instance.steps[stepIndex].completedAt = new Date()
        instance.steps[stepIndex].result = result
        instance.steps[stepIndex].notes = notes
      } else {
        instance.steps.push({
          stepId,
          status: WorkflowStepStatus.COMPLETED,
          startedAt: new Date(),
          completedAt: new Date(),
          assignedTo: new mongoose.Types.ObjectId(userId),
          result,
          notes,
        })
      }

      // Determine next step
      let nextStep: string | undefined
      if (nextStepId) {
        // Use provided next step if valid
        if (step.nextSteps.includes(nextStepId)) {
          nextStep = nextStepId
        } else {
          throw ApiError.badRequest(`Invalid next step ${nextStepId} for step ${stepId}`)
        }
      } else if (step.nextSteps.length === 1) {
        // Use the only next step
        nextStep = step.nextSteps[0]
      } else if (step.nextSteps.length === 0) {
        // No next steps, workflow is complete
        instance.status = WorkflowInstanceStatus.COMPLETED
        instance.completedAt = new Date()
        instance.currentStepId = undefined
      } else {
        // Multiple next steps, need to determine which one to use
        // This would typically be based on the step result or workflow logic
        // For now, we'll just use the first one
        nextStep = step.nextSteps[0]
      }

      // If we have a next step, update instance
      if (nextStep) {
        instance.currentStepId = nextStep
        instance.status = WorkflowInstanceStatus.RUNNING

        // Add next step to steps array
        const nextStepObj = workflow.steps.find((s) => s.id === nextStep)
        if (nextStepObj) {
          instance.steps.push({
            stepId: nextStep,
            status: WorkflowStepStatus.PENDING,
          })
        }
      }

      await instance.save()

      // Emit event
      this.emit("workflow:step:completed", {
        instance,
        stepId,
        userId,
        result,
        notes,
        nextStepId: nextStep,
      })

      // Log audit
      await auditService.createAuditLog({
        action: "workflow_step_completed",
        entityType: "workflow_instance",
        entityId: instance._id.toString(),
        userId,
        metadata: {
          workflowId: instance.workflowId.toString(),
          stepId,
          result,
          notes,
          nextStepId: nextStep,
        },
      })

      // If we have a next step, continue workflow execution
      if (nextStep) {
        setImmediate(() => {
          this.executeWorkflowInstance(instance._id.toString()).catch((error) => {
            logger.error(`Error executing workflow instance ${instance._id}:`, error)
          })
        })
      }

      return instance
    } catch (error) {
      logger.error(`Error completing workflow step ${params.stepId} in instance ${params.instanceId}:`, error)
      throw error
    }
  }

  /**
   * Reject workflow step
   */
  public async rejectWorkflowStep(params: {
    instanceId: string
    stepId: string
    userId: string
    reason: string
  }): Promise<IWorkflowInstance> {
    try {
      const { instanceId, stepId, userId, reason } = params

      const instance = await WorkflowInstanceModel.findById(instanceId)
      if (!instance) {
        throw ApiError.notFound("Workflow instance not found")
      }

      // Check if instance is active
      if (instance.status !== WorkflowInstanceStatus.RUNNING && instance.status !== WorkflowInstanceStatus.PENDING) {
        throw ApiError.badRequest(`Cannot reject step in workflow instance with status ${instance.status}`)
      }

      // Check if step exists and is current
      if (instance.currentStepId !== stepId) {
        throw ApiError.badRequest(`Step ${stepId} is not the current step of the workflow instance`)
      }

      // Update step status
      const stepIndex = instance.steps.findIndex((s) => s.stepId === stepId)
      if (stepIndex >= 0) {
        instance.steps[stepIndex].status = WorkflowStepStatus.REJECTED
        instance.steps[stepIndex].completedAt = new Date()
        instance.steps[stepIndex].notes = reason
      } else {
        instance.steps.push({
          stepId,
          status: WorkflowStepStatus.REJECTED,
          startedAt: new Date(),
          completedAt: new Date(),
          assignedTo: new mongoose.Types.ObjectId(userId),
          notes: reason,
        })
      }

      // Update instance status
      instance.status = WorkflowInstanceStatus.FAILED
      instance.completedAt = new Date()
      instance.currentStepId = undefined
      instance.result = {
        status: "rejected",
        stepId,
        reason,
      }

      await instance.save()

      // Emit event
      this.emit("workflow:step:rejected", {
        instance,
        stepId,
        userId,
        reason,
      })

      // Log audit
      await auditService.createAuditLog({
        action: "workflow_step_rejected",
        entityType: "workflow_instance",
        entityId: instance._id.toString(),
        userId,
        metadata: {
          workflowId: instance.workflowId.toString(),
          stepId,
          reason,
        },
      })

      return instance
    } catch (error) {
      logger.error(`Error rejecting workflow step ${params.stepId} in instance ${params.instanceId}:`, error)
      throw error
    }
  }

  /**
   * Assign workflow step
   */
  public async assignWorkflowStep(params: {
    instanceId: string
    stepId: string
    assigneeId: string
    assignerId: string
  }): Promise<IWorkflowInstance> {
    try {
      const { instanceId, stepId, assigneeId, assignerId } = params

      const instance = await WorkflowInstanceModel.findById(instanceId)
      if (!instance) {
        throw ApiError.notFound("Workflow instance not found")
      }

      // Check if instance is active
      if (instance.status !== WorkflowInstanceStatus.RUNNING && instance.status !== WorkflowInstanceStatus.PENDING) {
        throw ApiError.badRequest(`Cannot assign step in workflow instance with status ${instance.status}`)
      }

      // Check if step exists and is current
      if (instance.currentStepId !== stepId) {
        throw ApiError.badRequest(`Step ${stepId} is not the current step of the workflow instance`)
      }

      // Update step assignment
      const stepIndex = instance.steps.findIndex((s) => s.stepId === stepId)
      if (stepIndex >= 0) {
        instance.steps[stepIndex].assignedTo = new mongoose.Types.ObjectId(assigneeId)
      } else {
        instance.steps.push({
          stepId,
          status: WorkflowStepStatus.PENDING,
          assignedTo: new mongoose.Types.ObjectId(assigneeId),
        })
      }

      await instance.save()

      // Emit event
      this.emit("workflow:step:assigned", {
        instance,
        stepId,
        assigneeId,
        assignerId,
      })

      // Log audit
      await auditService.createAuditLog({
        action: "workflow_step_assigned",
        entityType: "workflow_instance",
        entityId: instance._id.toString(),
        userId: assignerId,
        metadata: {
          workflowId: instance.workflowId.toString(),
          stepId,
          assigneeId,
        },
      })

      // Send notification to assignee
      await notificationService.sendNotification({
        userId: assigneeId,
        type: "workflow_assignment",
        title: "Workflow Step Assigned",
        message: `You have been assigned to a workflow step`,
        data: {
          instanceId: instance._id.toString(),
          stepId,
          workflowId: instance.workflowId.toString(),
        },
      })

      return instance
    } catch (error) {
      logger.error(`Error assigning workflow step ${params.stepId} in instance ${params.instanceId}:`, error)
      throw error
    }
  }

  /**
   * Execute workflow instance
   */
  private async executeWorkflowInstance(instanceId: string): Promise<void> {
    try {
      const instance = await WorkflowInstanceModel.findById(instanceId)
      if (!instance) {
        logger.error(`Workflow instance ${instanceId} not found`)
        return
      }

      // Check if instance is active
      if (instance.status !== WorkflowInstanceStatus.PENDING && instance.status !== WorkflowInstanceStatus.RUNNING) {
        logger.debug(`Workflow instance ${instanceId} is not active (status: ${instance.status})`)
        return
      }

      // Get current step
      if (!instance.currentStepId) {
        logger.error(`Workflow instance ${instanceId} has no current step`)
        return
      }

      // Get workflow
      const workflow = await this.getWorkflow(instance.workflowId.toString())

      // Find step
      const step = workflow.steps.find((s) => s.id === instance.currentStepId)
      if (!step) {
        logger.error(`Step ${instance.currentStepId} not found in workflow ${workflow._id}`)
        return
      }

      // Update instance status to running
      if (instance.status === WorkflowInstanceStatus.PENDING) {
        instance.status = WorkflowInstanceStatus.RUNNING
        await instance.save()
      }

      // Update step status
      const stepIndex = instance.steps.findIndex((s) => s.stepId === instance.currentStepId)
      if (stepIndex >= 0) {
        if (!instance.steps[stepIndex].startedAt) {
          instance.steps[stepIndex].startedAt = new Date()
          instance.steps[stepIndex].status = WorkflowStepStatus.IN_PROGRESS
          await instance.save()
        }
      } else {
        instance.steps.push({
          stepId: instance.currentStepId,
          status: WorkflowStepStatus.IN_PROGRESS,
          startedAt: new Date(),
        })
        await instance.save()
      }

      // Execute step based on type
      switch (step.type) {
        case WorkflowStepType.APPROVAL:
          // Approval steps require user interaction
          // We'll just wait for the user to complete the step
          await this.handleApprovalStep(instance, step)
          break

        case WorkflowStepType.NOTIFICATION:
          // Send notification and auto-complete step
          await this.handleNotificationStep(instance, step)
          break

        case WorkflowStepType.CONDITION:
          // Evaluate condition and determine next step
          await this.handleConditionStep(instance, step)
          break

        case WorkflowStepType.ACTION:
          // Execute action and auto-complete step
          await this.handleActionStep(instance, step)
          break

        case WorkflowStepType.DELAY:
          // Wait for specified time and auto-complete step
          await this.handleDelayStep(instance, step)
          break

        case WorkflowStepType.FORK:
          // Create parallel branches
          await this.handleForkStep(instance, step)
          break

        case WorkflowStepType.JOIN:
          // Wait for all incoming branches to complete
          await this.handleJoinStep(instance, step)
          break

        default:
          logger.error(`Unknown step type: ${step.type}`)
          break
      }
    } catch (error) {
      logger.error(`Error executing workflow instance ${instanceId}:`, error)
    }
  }

  /**
   * Handle approval step
   */
  private async handleApprovalStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      // Get approvers from step config
      const { approvers, autoAssign } = step.config

      // If auto-assign is enabled, assign to first approver
      if (autoAssign && approvers && approvers.length > 0) {
        const assigneeId = approvers[0]
        const stepIndex = instance.steps.findIndex((s) => s.stepId === step.id)

        if (stepIndex >= 0 && !instance.steps[stepIndex].assignedTo) {
          instance.steps[stepIndex].assignedTo = new mongoose.Types.ObjectId(assigneeId)
          await instance.save()

          // Send notification to assignee
          await notificationService.sendNotification({
            userId: assigneeId,
            type: "workflow_assignment",
            title: "Workflow Approval Required",
            message: `You have been assigned to approve a workflow step`,
            data: {
              instanceId: instance._id.toString(),
              stepId: step.id,
              workflowId: instance.workflowId.toString(),
            },
          })
        }
      }

      // For approvers, send notifications
      if (approvers && approvers.length > 0) {
        for (const approver of approvers) {
          await notificationService.sendNotification({
            userId: approver,
            type: "workflow_approval",
            title: "Workflow Approval Required",
            message: `Your approval is required for a workflow step`,
            data: {
              instanceId: instance._id.toString(),
              stepId: step.id,
              workflowId: instance.workflowId.toString(),
            },
          })
        }
      }
    } catch (error) {
      logger.error(`Error handling approval step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Handle notification step
   */
  private async handleNotificationStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      const { recipients, title, message, data } = step.config

      // Send notifications
      if (recipients && recipients.length > 0) {
        for (const recipient of recipients) {
          await notificationService.sendNotification({
            userId: recipient,
            type: "workflow_notification",
            title: title || "Workflow Notification",
            message: message || "Notification from workflow",
            data: {
              ...data,
              instanceId: instance._id.toString(),
              stepId: step.id,
              workflowId: instance.workflowId.toString(),
            },
          })
        }
      }

      // Auto-complete step
      await this.completeWorkflowStep({
        instanceId: instance._id.toString(),
        stepId: step.id,
        userId: instance.createdBy.toString(),
        result: {
          notificationSent: true,
          recipients,
        },
      })
    } catch (error) {
      logger.error(`Error handling notification step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Handle condition step
   */
  private async handleConditionStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      const { condition, trueStepId, falseStepId } = step.config

      // Evaluate condition
      let result = false
      try {
        // Simple condition evaluation for now
        // In a real implementation, this would be more sophisticated
        if (typeof condition === "string") {
          // eslint-disable-next-line no-new-func
          const evalFn = new Function("data", `return ${condition}`)
          result = evalFn(instance.data)
        } else if (typeof condition === "object") {
          // Object-based condition
          const { field, operator, value } = condition
          const fieldValue = instance.data[field]

          switch (operator) {
            case "eq":
              result = fieldValue === value
              break
            case "neq":
              result = fieldValue !== value
              break
            case "gt":
              result = fieldValue > value
              break
            case "gte":
              result = fieldValue >= value
              break
            case "lt":
              result = fieldValue < value
              break
            case "lte":
              result = fieldValue <= value
              break
            case "contains":
              result = String(fieldValue).includes(String(value))
              break
            case "startsWith":
              result = String(fieldValue).startsWith(String(value))
              break
            case "endsWith":
              result = String(fieldValue).endsWith(String(value))
              break
            default:
              result = false
          }
        }
      } catch (error) {
        logger.error(`Error evaluating condition in step ${step.id}:`, error)
        result = false
      }

      // Determine next step
      const nextStepId = result ? trueStepId : falseStepId

      // Complete step
      await this.completeWorkflowStep({
        instanceId: instance._id.toString(),
        stepId: step.id,
        userId: instance.createdBy.toString(),
        result: {
          condition,
          result,
          nextStepId,
        },
        nextStepId,
      })
    } catch (error) {
      logger.error(`Error handling condition step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Handle action step
   */
  private async handleActionStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      const { action, params } = step.config

      // Execute action
      let result
      try {
        switch (action) {
          case "updateContent":
            // Update content status or other fields
            result = await this.executeUpdateContentAction(instance, params)
            break

          case "createContent":
            // Create new content
            result = await this.executeCreateContentAction(instance, params)
            break

          case "publishContent":
            // Publish content
            result = await this.executePublishContentAction(instance, params)
            break

          case "unpublishContent":
            // Unpublish content
            result = await this.executeUnpublishContentAction(instance, params)
            break

          case "sendEmail":
            // Send email
            result = await this.executeSendEmailAction(instance, params)
            break

          case "webhook":
            // Call webhook
            result = await this.executeWebhookAction(instance, params)
            break

          default:
            logger.error(`Unknown action: ${action}`)
            result = { error: `Unknown action: ${action}` }
        }
      } catch (error) {
        logger.error(`Error executing action ${action} in step ${step.id}:`, error)
        result = { error: (error as Error).message }
      }

      // Complete step
      await this.completeWorkflowStep({
        instanceId: instance._id.toString(),
        stepId: step.id,
        userId: instance.createdBy.toString(),
        result,
      })
    } catch (error) {
      logger.error(`Error handling action step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Handle delay step
   */
  private async handleDelayStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      const { duration, unit } = step.config

      // Calculate delay in milliseconds
      let delayMs = 0
      switch (unit) {
        case "seconds":
          delayMs = duration * 1000
          break
        case "minutes":
          delayMs = duration * 60 * 1000
          break
        case "hours":
          delayMs = duration * 60 * 60 * 1000
          break
        case "days":
          delayMs = duration * 24 * 60 * 60 * 1000
          break
        default:
          delayMs = duration * 1000 // Default to seconds
      }

      // Schedule job to complete step after delay
      await schedulerService.createJob({
        name: "workflow_delay",
        type: "scheduled",
        scheduledFor: new Date(Date.now() + delayMs),
        data: {
          instanceId: instance._id.toString(),
          stepId: step.id,
          userId: instance.createdBy.toString(),
        },
        maxRetries: 3,
      })

      logger.info(`Scheduled delay of ${duration} ${unit} for workflow instance ${instance._id} step ${step.id}`)
    } catch (error) {
      logger.error(`Error handling delay step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Handle fork step
   */
  private async handleForkStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      // Fork creates parallel branches
      // We'll complete this step and let the workflow engine handle the next steps
      await this.completeWorkflowStep({
        instanceId: instance._id.toString(),
        stepId: step.id,
        userId: instance.createdBy.toString(),
        result: {
          branches: step.nextSteps,
        },
      })
    } catch (error) {
      logger.error(`Error handling fork step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Handle join step
   */
  private async handleJoinStep(instance: IWorkflowInstance, step: IWorkflowStep): Promise<void> {
    try {
      // Join waits for all incoming branches to complete
      // This is a simplified implementation
      // In a real system, this would be more complex
      await this.completeWorkflowStep({
        instanceId: instance._id.toString(),
        stepId: step.id,
        userId: instance.createdBy.toString(),
        result: {
          joined: true,
        },
      })
    } catch (error) {
      logger.error(`Error handling join step ${step.id} for instance ${instance._id}:`, error)
    }
  }

  /**
   * Execute update content action
   */
  private async executeUpdateContentAction(instance: IWorkflowInstance, params: Record<string, any>): Promise<any> {
    // This would call the content service to update content
    // For now, we'll just return a placeholder result
    return {
      action: "updateContent",
      contentId: instance.contentId?.toString(),
      params,
      success: true,
    }
  }

  /**
   * Execute create content action
   */
  private async executeCreateContentAction(instance: IWorkflowInstance, params: Record<string, any>): Promise<any> {
    // This would call the content service to create content
    // For now, we'll just return a placeholder result
    return {
      action: "createContent",
      contentTypeId: instance.contentTypeId?.toString(),
      params,
      success: true,
    }
  }

  /**
   * Execute publish content action
   */
  private async executePublishContentAction(instance: IWorkflowInstance, params: Record<string, any>): Promise<any> {
    // This would call the content service to publish content
    // For now, we'll just return a placeholder result
    return {
      action: "publishContent",
      contentId: instance.contentId?.toString(),
      params,
      success: true,
    }
  }

  /**
   * Execute unpublish content action
   */
  private async executeUnpublishContentAction(instance: IWorkflowInstance, params: Record<string, any>): Promise<any> {
    // This would call the content service to unpublish content
    // For now, we'll just return a placeholder result
    return {
      action: "unpublishContent",
      contentId: instance.contentId?.toString(),
      params,
      success: true,
    }
  }

  /**
   * Execute send email action
   */
  private async executeSendEmailAction(instance: IWorkflowInstance, params: Record<string, any>): Promise<any> {
    // This would call an email service to send an email
    // For now, we'll just return a placeholder result
    return {
      action: "sendEmail",
      to: params.to,
      subject: params.subject,
      success: true,
    }
  }

  /**
   * Execute webhook action
   */
  private async executeWebhookAction(instance: IWorkflowInstance, params: Record<string, any>): Promise<any> {
    // This would call a webhook
    // For now, we'll just return a placeholder result
    return {
      action: "webhook",
      url: params.url,
      method: params.method,
      success: true,
    }
  }

  /**
   * Validate workflow
   */
  private validateWorkflow(data: {
    name: string
    steps: IWorkflowStep[]
    startStepId: string
  }): void {
    // Check if name is provided
    if (!data.name) {
      throw ApiError.badRequest("Workflow name is required")
    }

    // Check if steps are provided
    if (!data.steps || data.steps.length === 0) {
      throw ApiError.badRequest("Workflow must have at least one step")
    }

    // Check if start step is provided
    if (!data.startStepId) {
      throw ApiError.badRequest("Workflow start step is required")
    }

    // Validate steps
    this.validateWorkflowSteps(data.steps, data.startStepId)
  }

  /**
   * Validate workflow steps
   */
  private validateWorkflowSteps(steps: IWorkflowStep[], startStepId: string): void {
    // Check if start step exists
    const startStep = steps.find((step) => step.id === startStepId)
    if (!startStep) {
      throw ApiError.badRequest(`Start step ${startStepId} not found in workflow steps`)
    }

    // Check for duplicate step IDs
    const stepIds = steps.map((step) => step.id)
    const uniqueStepIds = new Set(stepIds)
    if (stepIds.length !== uniqueStepIds.size) {
      throw ApiError.badRequest("Workflow contains duplicate step IDs")
    }

    // Check if all next steps exist
    for (const step of steps) {
      for (const nextStepId of step.nextSteps) {
        if (!steps.some((s) => s.id === nextStepId)) {
          throw ApiError.badRequest(`Next step ${nextStepId} not found in workflow steps`)
        }
      }
    }

    // Validate step configurations
    for (const step of steps) {
      this.validateStepConfig(step)
    }
  }

  /**
   * Validate step configuration
   */
  private validateStepConfig(step: IWorkflowStep): void {
    switch (step.type) {
      case WorkflowStepType.APPROVAL:
        if (!step.config.approvers || !Array.isArray(step.config.approvers) || step.config.approvers.length === 0) {
          throw ApiError.badRequest(`Approval step ${step.id} must have at least one approver`)
        }
        break

      case WorkflowStepType.NOTIFICATION:
        if (!step.config.recipients || !Array.isArray(step.config.recipients) || step.config.recipients.length === 0) {
          throw ApiError.badRequest(`Notification step ${step.id} must have at least one recipient`)
        }
        if (!step.config.message) {
          throw ApiError.badRequest(`Notification step ${step.id} must have a message`)
        }
        break

      case WorkflowStepType.CONDITION:
        if (!step.config.condition) {
          throw ApiError.badRequest(`Condition step ${step.id} must have a condition`)
        }
        if (!step.config.trueStepId || !step.config.falseStepId) {
          throw ApiError.badRequest(`Condition step ${step.id} must have true and false step IDs`)
        }
        break

      case WorkflowStepType.ACTION:
        if (!step.config.action) {
          throw ApiError.badRequest(`Action step ${step.id} must have an action`)
        }
        break

      case WorkflowStepType.DELAY:
        if (!step.config.duration || step.config.duration <= 0) {
          throw ApiError.badRequest(`Delay step ${step.id} must have a positive duration`)
        }
        if (!step.config.unit || !["seconds", "minutes", "hours", "days"].includes(step.config.unit)) {
          throw ApiError.badRequest(`Delay step ${step.id} must have a valid unit (seconds, minutes, hours, days)`)
        }
        break

      case WorkflowStepType.FORK:
        if (!step.nextSteps || step.nextSteps.length < 2) {
          throw ApiError.badRequest(`Fork step ${step.id} must have at least two next steps`)
        }
        break

      case WorkflowStepType.JOIN:
        // No specific validation for join steps
        break

      default:
        throw ApiError.badRequest(`Unknown step type: ${step.type}`)
    }
  }
}

// Register job handler for workflow delay
schedulerService.registerJobHandler("workflow_delay", async (job) => {
  try {
    const { instanceId, stepId, userId } = job.data

    // Get workflow service instance
    const workflowService = new WorkflowService()

    // Complete the step
    await workflowService.completeWorkflowStep({
      instanceId,
      stepId,
      userId,
      result: {
        delayed: true,
      },
    })

    return { success: true }
  } catch (error) {
    logger.error("Error handling workflow delay job:", error)
    throw error
  }
})

// Export singleton instance
export const workflowService = new WorkflowService()
