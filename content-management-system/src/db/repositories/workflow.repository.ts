import { BaseRepository } from "./base.repository"
import {
  WorkflowModel,
  WorkflowEntryModel,
  type IWorkflow,
  type IWorkflowEntry,
  WorkflowEntryStatus,
} from "../models/workflow.model"
import { ApiError } from "../../utils/errors"

export class WorkflowRepository extends BaseRepository<IWorkflow> {
  constructor() {
    super(WorkflowModel)
  }

  /**
   * Find workflows by content type
   */
  async findByContentType(contentTypeId: string): Promise<IWorkflow[]> {
    return this.find({ contentTypes: contentTypeId })
  }

  /**
   * Find default workflow for a content type
   */
  async findDefaultForContentType(contentTypeId: string): Promise<IWorkflow | null> {
    return this.findOne({
      contentTypes: contentTypeId,
      isDefault: true,
    })
  }

  /**
   * Find default workflows
   */
  async findDefaults(): Promise<IWorkflow[]> {
    return this.find({ isDefault: true })
  }

  /**
   * Set a workflow as default for its content types
   */
  async setAsDefault(workflowId: string): Promise<IWorkflow> {
    const workflow = await this.findByIdOrThrow(workflowId)

    // First, unset default flag for all other workflows with the same content types
    for (const contentTypeId of workflow.contentTypes) {
      await this.model.updateMany(
        {
          _id: { $ne: workflowId },
          contentTypes: contentTypeId,
          isDefault: true,
        },
        { isDefault: false },
      )
    }

    // Then set this workflow as default
    return this.updateByIdOrThrow(workflowId, { isDefault: true })
  }

  /**
   * Add content types to a workflow
   */
  async addContentTypes(workflowId: string, contentTypeIds: string[]): Promise<IWorkflow> {
    const workflow = await this.findByIdOrThrow(workflowId)

    // Add new content types (avoid duplicates)
    const currentContentTypes = workflow.contentTypes.map((ct) => ct.toString())
    const uniqueContentTypes = [...new Set([...currentContentTypes, ...contentTypeIds])]

    return this.updateById(workflowId, { contentTypes: uniqueContentTypes }) as Promise<IWorkflow>
  }

  /**
   * Remove content types from a workflow
   */
  async removeContentTypes(workflowId: string, contentTypeIds: string[]): Promise<IWorkflow> {
    const workflow = await this.findByIdOrThrow(workflowId)

    // Remove specified content types
    const currentContentTypes = workflow.contentTypes.map((ct) => ct.toString())
    const updatedContentTypes = currentContentTypes.filter((ct) => !contentTypeIds.includes(ct))

    return this.updateById(workflowId, { contentTypes: updatedContentTypes }) as Promise<IWorkflow>
  }

  /**
   * Search workflows
   */
  async search(query: string): Promise<IWorkflow[]> {
    const regex = new RegExp(query, "i")
    return this.find({
      $or: [{ name: regex }, { description: regex }],
    })
  }
}

export class WorkflowEntryRepository extends BaseRepository<IWorkflowEntry> {
  constructor() {
    super(WorkflowEntryModel)
  }

  /**
   * Find workflow entries by workflow
   */
  async findByWorkflow(workflowId: string): Promise<IWorkflowEntry[]> {
    return this.find({ workflow: workflowId })
  }

  /**
   * Find workflow entries by content
   */
  async findByContent(contentId: string): Promise<IWorkflowEntry[]> {
    return this.find({ content: contentId })
  }

  /**
   * Find active workflow entry for content
   */
  async findActiveForContent(contentId: string): Promise<IWorkflowEntry | null> {
    return this.findOne({
      content: contentId,
      status: WorkflowEntryStatus.IN_PROGRESS,
    })
  }

  /**
   * Find workflow entries by status
   */
  async findByStatus(status: WorkflowEntryStatus): Promise<IWorkflowEntry[]> {
    return this.find({ status })
  }

  /**
   * Find workflow entries assigned to a user
   */
  async findAssignedToUser(userId: string): Promise<IWorkflowEntry[]> {
    return this.find({
      "steps.assignedTo": userId,
      status: WorkflowEntryStatus.IN_PROGRESS,
    })
  }

  /**
   * Complete a workflow step
   */
  async completeStep(
    entryId: string,
    stepId: string,
    userId: string,
    approve: boolean,
    comments?: string,
  ): Promise<IWorkflowEntry> {
    const entry = await this.findByIdOrThrow(entryId)

    // Find the step
    const stepIndex = entry.steps.findIndex((s) => s.step.toString() === stepId)
    if (stepIndex === -1) {
      throw ApiError.notFound(`Step not found with ID: ${stepId}`)
    }

    // Check if step is already completed
    if (entry.steps[stepIndex].status !== WorkflowEntryStatus.IN_PROGRESS) {
      throw ApiError.badRequest("Step is already completed")
    }

    // Update the step
    entry.steps[stepIndex].status = approve ? WorkflowEntryStatus.APPROVED : WorkflowEntryStatus.REJECTED
    entry.steps[stepIndex].completedBy = userId
    entry.steps[stepIndex].completedAt = new Date()
    if (comments) {
      entry.steps[stepIndex].comments = comments
    }

    // If step is rejected, mark the workflow as rejected
    if (!approve) {
      entry.status = WorkflowEntryStatus.REJECTED
      await entry.save()
      return entry
    }

    // Find the next step
    const workflow = await WorkflowModel.findById(entry.workflow)
    if (!workflow) {
      throw ApiError.notFound(`Workflow not found with ID: ${entry.workflow}`)
    }

    const currentStepOrder = workflow.steps.find((s) => s._id.toString() === stepId)?.order
    if (currentStepOrder === undefined) {
      throw ApiError.notFound(`Step not found in workflow`)
    }

    const nextStep = workflow.steps
      .filter((s) => s.order > currentStepOrder)
      .sort((a, b) => a.order - b.order)
      .shift()

    if (nextStep) {
      // Move to the next step
      entry.currentStep = nextStep._id
      entry.steps.push({
        step: nextStep._id,
        status: WorkflowEntryStatus.IN_PROGRESS,
        createdAt: new Date(),
      } as any)
    } else {
      // All steps completed, mark the workflow as approved
      entry.status = WorkflowEntryStatus.APPROVED
      entry.currentStep = undefined
    }

    await entry.save()
    return entry
  }

  /**
   * Assign users to a workflow step
   */
  async assignUsers(entryId: string, stepId: string, userIds: string[]): Promise<IWorkflowEntry> {
    const entry = await this.findByIdOrThrow(entryId)

    // Find the step
    const stepIndex = entry.steps.findIndex((s) => s.step.toString() === stepId)
    if (stepIndex === -1) {
      throw ApiError.notFound(`Step not found with ID: ${stepId}`)
    }

    // Check if step is in progress
    if (entry.steps[stepIndex].status !== WorkflowEntryStatus.IN_PROGRESS) {
      throw ApiError.badRequest("Cannot assign users to a completed step")
    }

    // Update the step
    entry.steps[stepIndex].assignedTo = userIds as any

    await entry.save()
    return entry
  }

  /**
   * Cancel a workflow
   */
  async cancel(entryId: string): Promise<IWorkflowEntry> {
    const entry = await this.findByIdOrThrow(entryId)

    // Check if workflow is already completed
    if (entry.status !== WorkflowEntryStatus.IN_PROGRESS) {
      throw ApiError.badRequest("Workflow is already completed")
    }

    // Update the workflow
    entry.status = WorkflowEntryStatus.CANCELED
    entry.currentStep = undefined

    await entry.save()
    return entry
  }
}
