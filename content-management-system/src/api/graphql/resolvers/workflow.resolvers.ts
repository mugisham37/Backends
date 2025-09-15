import { WorkflowService } from "../../../services/workflow.service"
import { ApiError } from "../../../utils/errors"
import { generateCursor } from "../../../utils/helpers"
import { WorkflowEntryStatus, WorkflowStepType } from "../../../db/models/workflow.model"

const workflowService = new WorkflowService()

export const workflowResolvers = {
  Query: {
    workflows: async (_: any, args: any, context: any) => {
      const { filter = {}, pagination = {} } = args
      const { first, after, last, before } = pagination

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.search) serviceFilter.search = filter.search
      if (filter.contentTypeId) serviceFilter.contentTypeId = filter.contentTypeId
      if (filter.isDefault !== undefined) serviceFilter.isDefault = filter.isDefault

      // For cursor-based pagination, we need to implement custom logic
      // This is a simplified version
      const limit = first || last || 10
      const result = await workflowService.getAllWorkflows(
        serviceFilter,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const workflows = result.workflows.slice(0, limit)
      const hasNextPage = result.workflows.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = workflows.map((workflow) => ({
        cursor: generateCursor(workflow._id.toString()),
        node: workflow,
      }))

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount: result.totalCount,
      }
    },

    workflow: async (_: any, args: any, context: any) => {
      const { id } = args
      return workflowService.getWorkflowById(id)
    },

    workflowEntries: async (_: any, args: any, context: any) => {
      const { filter = {}, pagination = {} } = args
      const { first, after, last, before } = pagination

      // Convert GraphQL filter to service filter
      const serviceFilter: any = {}
      if (filter.workflowId) serviceFilter.workflowId = filter.workflowId
      if (filter.contentId) serviceFilter.contentId = filter.contentId
      if (filter.status) serviceFilter.status = filter.status
      if (filter.assignedTo) serviceFilter.assignedTo = filter.assignedTo

      // For cursor-based pagination, we need to implement custom logic
      // This is a simplified version
      const limit = first || last || 10
      const result = await workflowService.getWorkflowEntries(
        serviceFilter,
        { page: 1, limit: limit + 1 }, // Get one extra to check if there are more pages
      )

      const entries = result.entries.slice(0, limit)
      const hasNextPage = result.entries.length > limit
      const hasPreviousPage = after !== undefined || before !== undefined

      // Create edges
      const edges = entries.map((entry) => ({
        cursor: generateCursor(entry._id.toString()),
        node: entry,
      }))

      return {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage,
          startCursor: edges.length > 0 ? edges[0].cursor : null,
          endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
        },
        totalCount: result.totalCount,
      }
    },

    workflowEntry: async (_: any, args: any, context: any) => {
      const { id } = args
      return workflowService.getWorkflowEntryById(id)
    },
  },

  Mutation: {
    createWorkflow: async (_: any, args: any, context: any) => {
      const { input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can create workflows)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to create workflows")
      }

      return workflowService.createWorkflow(input)
    },

    updateWorkflow: async (_: any, args: any, context: any) => {
      const { id, input } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can update workflows)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to update workflows")
      }

      return workflowService.updateWorkflow(id, input)
    },

    deleteWorkflow: async (_: any, args: any, context: any) => {
      const { id } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins can delete workflows)
      if (user.role !== "admin") {
        throw ApiError.forbidden("You do not have permission to delete workflows")
      }

      await workflowService.deleteWorkflow(id)
      return true
    },

    startWorkflow: async (_: any, args: any, context: any) => {
      const { contentId, workflowId } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      return workflowService.startWorkflow(contentId, workflowId)
    },

    completeWorkflowStep: async (_: any, args: any, context: any) => {
      const { entryId, stepId, approve, comments } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      return workflowService.completeWorkflowStep(entryId, stepId, user._id, approve, comments)
    },

    assignWorkflowStep: async (_: any, args: any, context: any) => {
      const { entryId, stepId, userIds } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can assign workflow steps)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to assign workflow steps")
      }

      return workflowService.assignWorkflowStep(entryId, stepId, userIds)
    },

    cancelWorkflow: async (_: any, args: any, context: any) => {
      const { entryId } = args
      const user = context.user

      // Check authentication
      if (!user) {
        throw ApiError.unauthorized("Authentication required")
      }

      // Check authorization (only admins and editors can cancel workflows)
      if (!["admin", "editor"].includes(user.role)) {
        throw ApiError.forbidden("You do not have permission to cancel workflows")
      }

      return workflowService.cancelWorkflow(entryId)
    },
  },

  Workflow: {
    id: (parent: any) => parent._id || parent.id,
    contentTypes: async (parent: any) => {
      if (parent.contentTypes && Array.isArray(parent.contentTypes)) {
        // If contentTypes are already populated, return them
        if (typeof parent.contentTypes[0] !== "string") {
          return parent.contentTypes
        }
      }
      // If contentTypes are not populated, return null
      // In a real implementation, you would use a DataLoader to populate them
      return []
    },
  },

  WorkflowStep: {
    id: (parent: any) => parent._id || parent.id,
  },

  WorkflowEntry: {
    id: (parent: any) => parent._id || parent.id,
    workflow: (parent: any) => {
      if (parent.workflow && typeof parent.workflow !== "string") {
        return parent.workflow
      }
      return null
    },
    content: (parent: any) => {
      if (parent.content && typeof parent.content !== "string") {
        return parent.content
      }
      return null
    },
    currentStep: (parent: any) => {
      if (parent.currentStep && typeof parent.currentStep !== "string") {
        return parent.currentStep
      }
      return null
    },
  },

  WorkflowStepEntry: {
    id: (parent: any) => parent._id || parent.id,
    step: (parent: any) => {
      if (parent.step && typeof parent.step !== "string") {
        return parent.step
      }
      return null
    },
    assignedTo: (parent: any) => {
      if (parent.assignedTo && Array.isArray(parent.assignedTo)) {
        // If assignedTo are already populated, return them
        if (parent.assignedTo.length > 0 && typeof parent.assignedTo[0] !== "string") {
          return parent.assignedTo
        }
      }
      return []
    },
    completedBy: (parent: any) => {
      if (parent.completedBy && typeof parent.completedBy !== "string") {
        return parent.completedBy
      }
      return null
    },
  },

  WorkflowStepType: {
    review: WorkflowStepType.REVIEW,
    approval: WorkflowStepType.APPROVAL,
    custom: WorkflowStepType.CUSTOM,
  },

  WorkflowEntryStatus: {
    inProgress: WorkflowEntryStatus.IN_PROGRESS,
    approved: WorkflowEntryStatus.APPROVED,
    rejected: WorkflowEntryStatus.REJECTED,
    canceled: WorkflowEntryStatus.CANCELED,
  },
}
