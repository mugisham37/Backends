import type { Request, Response, NextFunction } from "express"
import {
  workflowService,
  type WorkflowStatus,
  type WorkflowInstanceStatus,
  WorkflowTriggerType,
} from "../services/workflow.service"

export class WorkflowController {
  /**
   * Create a new workflow
   */
  public createWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, description, contentTypeId, steps, triggers, startStepId, isDefault } = req.body
      const userId = (req as any).user.id

      const workflow = await workflowService.createWorkflow({
        name,
        description,
        contentTypeId,
        steps,
        triggers,
        startStepId,
        createdBy: userId,
        isDefault,
        tenantId: (req as any).tenantId,
      })

      res.status(201).json({
        status: "success",
        data: {
          workflow,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update a workflow
   */
  public updateWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const { name, description, status, contentTypeId, steps, triggers, startStepId, isDefault } = req.body
      const userId = (req as any).user.id

      const workflow = await workflowService.updateWorkflow(id, {
        name,
        description,
        status,
        contentTypeId,
        steps,
        triggers,
        startStepId,
        updatedBy: userId,
        isDefault,
      })

      res.status(200).json({
        status: "success",
        data: {
          workflow,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get a workflow by ID
   */
  public getWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const workflow = await workflowService.getWorkflow(id)

      res.status(200).json({
        status: "success",
        data: {
          workflow,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflows with filtering and pagination
   */
  public getWorkflows = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentTypeId, status, triggerType, isDefault, search, page, limit, sort, order } = req.query as any

      // Parse status
      let parsedStatus: WorkflowStatus[] | undefined
      if (status) {
        parsedStatus = Array.isArray(status) ? status : [status]
      }

      // Parse isDefault
      let parsedIsDefault: boolean | undefined
      if (isDefault !== undefined) {
        parsedIsDefault = isDefault === "true"
      }

      const result = await workflowService.getWorkflows({
        contentTypeId,
        status: parsedStatus,
        triggerType,
        isDefault: parsedIsDefault,
        search,
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        sort,
        order,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete a workflow
   */
  public deleteWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      await workflowService.deleteWorkflow(id)

      res.status(200).json({
        status: "success",
        message: "Workflow deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get default workflow for content type
   */
  public getDefaultWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { contentTypeId } = req.params

      const workflow = await workflowService.getDefaultWorkflow(contentTypeId, (req as any).tenantId)

      if (!workflow) {
        return res.status(404).json({
          status: "error",
          message: "No default workflow found for this content type",
        })
      }

      res.status(200).json({
        status: "success",
        data: {
          workflow,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Trigger workflow
   */
  public triggerWorkflow = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { triggerType, contentId, contentTypeId, userId, mediaId, data } = req.body
      const currentUserId = (req as any).user.id

      const instance = await workflowService.triggerWorkflow({
        triggerType,
        contentId,
        contentTypeId,
        userId,
        mediaId,
        data,
        createdBy: currentUserId,
        tenantId: (req as any).tenantId,
      })

      if (!instance) {
        return res.status(404).json({
          status: "error",
          message: "No workflow found for this trigger type",
        })
      }

      res.status(201).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create workflow instance
   */
  public createWorkflowInstance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, contentId, contentTypeId, userId, mediaId, data } = req.body
      const currentUserId = (req as any).user.id

      const instance = await workflowService.createWorkflowInstance({
        workflowId,
        contentId,
        contentTypeId,
        userId,
        mediaId,
        data,
        createdBy: currentUserId,
        tenantId: (req as any).tenantId,
      })

      res.status(201).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflow instance
   */
  public getWorkflowInstance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      const instance = await workflowService.getWorkflowInstance(id)

      res.status(200).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflow instances
   */
  public getWorkflowInstances = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, contentId, contentTypeId, userId, mediaId, status, createdBy, page, limit, sort, order } =
        req.query as any

      // Parse status
      let parsedStatus: WorkflowInstanceStatus[] | undefined
      if (status) {
        parsedStatus = Array.isArray(status) ? status : [status]
      }

      const result = await workflowService.getWorkflowInstances({
        workflowId,
        contentId,
        contentTypeId,
        userId,
        mediaId,
        status: parsedStatus,
        createdBy,
        page: page ? Number.parseInt(page) : undefined,
        limit: limit ? Number.parseInt(limit) : undefined,
        sort,
        order,
        tenantId: (req as any).tenantId,
      })

      res.status(200).json({
        status: "success",
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Cancel workflow instance
   */
  public cancelWorkflowInstance = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params
      const userId = (req as any).user.id

      const instance = await workflowService.cancelWorkflowInstance(id, userId)

      res.status(200).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Complete workflow step
   */
  public completeWorkflowStep = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId, stepId } = req.params
      const { result, notes, nextStepId } = req.body
      const userId = (req as any).user.id

      const instance = await workflowService.completeWorkflowStep({
        instanceId,
        stepId,
        userId,
        result,
        notes,
        nextStepId,
      })

      res.status(200).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Reject workflow step
   */
  public rejectWorkflowStep = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId, stepId } = req.params
      const { reason } = req.body
      const userId = (req as any).user.id

      const instance = await workflowService.rejectWorkflowStep({
        instanceId,
        stepId,
        userId,
        reason,
      })

      res.status(200).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Assign workflow step
   */
  public assignWorkflowStep = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { instanceId, stepId } = req.params
      const { assigneeId } = req.body
      const assignerId = (req as any).user.id

      const instance = await workflowService.assignWorkflowStep({
        instanceId,
        stepId,
        assigneeId,
        assignerId,
      })

      res.status(200).json({
        status: "success",
        data: {
          instance,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflow triggers
   */
  public getWorkflowTriggers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Return all available trigger types
      const triggers = Object.values(WorkflowTriggerType)

      res.status(200).json({
        status: "success",
        data: {
          triggers,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get workflow statistics
   */
  public getWorkflowStatistics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { workflowId, startDate, endDate } = req.query as any
      const tenantId = (req as any).tenantId

      // Parse dates
      const parsedStartDate = startDate ? new Date(startDate) : undefined
      const parsedEndDate = endDate ? new Date(endDate) : undefined

      // Get statistics
      const statistics = await workflowService.getWorkflowStatistics({
        workflowId,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          statistics,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
