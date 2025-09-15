import { Router } from "express"
import { WorkflowController } from "../../../controllers/workflow.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { workflowValidation } from "../../../validations/workflow.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const workflowController = new WorkflowController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get workflow triggers
router.get("/triggers", workflowController.getWorkflowTriggers)

// Get workflows
router.get("/", workflowController.getWorkflows)

// Get workflow by ID
router.get("/:id", workflowController.getWorkflow)

// Create workflow (admin and editor only)
router.post(
  "/",
  requireRoles(["admin", "editor"]),
  validateRequest(workflowValidation.createWorkflow),
  workflowController.createWorkflow,
)

// Update workflow (admin and editor only)
router.put(
  "/:id",
  requireRoles(["admin", "editor"]),
  validateRequest(workflowValidation.updateWorkflow),
  workflowController.updateWorkflow,
)

// Delete workflow (admin only)
router.delete("/:id", requireRoles(["admin"]), workflowController.deleteWorkflow)

// Get default workflow for content type
router.get("/default/:contentTypeId", workflowController.getDefaultWorkflow)

// Trigger workflow
router.post("/trigger", validateRequest(workflowValidation.triggerWorkflow), workflowController.triggerWorkflow)

// Get workflow statistics
router.get("/statistics", requireRoles(["admin", "editor"]), workflowController.getWorkflowStatistics)

// Workflow instances
router.get("/instances", workflowController.getWorkflowInstances)
router.get("/instances/:id", workflowController.getWorkflowInstance)
router.post(
  "/instances",
  validateRequest(workflowValidation.createWorkflowInstance),
  workflowController.createWorkflowInstance,
)
router.post("/instances/:id/cancel", workflowController.cancelWorkflowInstance)

// Workflow steps
router.post(
  "/instances/:instanceId/steps/:stepId/complete",
  validateRequest(workflowValidation.completeWorkflowStep),
  workflowController.completeWorkflowStep,
)
router.post(
  "/instances/:instanceId/steps/:stepId/reject",
  validateRequest(workflowValidation.rejectWorkflowStep),
  workflowController.rejectWorkflowStep,
)
router.post(
  "/instances/:instanceId/steps/:stepId/assign",
  validateRequest(workflowValidation.assignWorkflowStep),
  workflowController.assignWorkflowStep,
)

export const workflowRoutes = router
