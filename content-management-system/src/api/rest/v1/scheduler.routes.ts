import { Router } from "express"
import { SchedulerController } from "../../../controllers/scheduler.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { schedulerValidation } from "../../../validations/scheduler.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const schedulerController = new SchedulerController()

// Create a new job
router.post(
  "/jobs",
  authMiddleware,
  requireAuth,
  validateRequest(schedulerValidation.createJob),
  schedulerController.createJob,
)

// Get jobs with filtering and pagination
router.get("/jobs", authMiddleware, requireAuth, schedulerController.getJobs)

// Get a job by ID
router.get("/jobs/:id", authMiddleware, requireAuth, schedulerController.getJob)

// Cancel a job
router.post("/jobs/:id/cancel", authMiddleware, requireAuth, schedulerController.cancelJob)

// Retry a failed job
router.post("/jobs/:id/retry", authMiddleware, requireAuth, schedulerController.retryJob)

// Delete a job
router.delete("/jobs/:id", authMiddleware, requireAuth, schedulerController.deleteJob)

// Clean up old jobs (admin only)
router.post(
  "/jobs/cleanup",
  authMiddleware,
  requireRoles(["admin"]),
  validateRequest(schedulerValidation.cleanupJobs),
  schedulerController.cleanupJobs,
)

export const schedulerRoutes = router
