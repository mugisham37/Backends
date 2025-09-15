import { Router } from "express"
import { AnalyticsController } from "../../../controllers/analytics.controller"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const analyticsController = new AnalyticsController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Only admins and editors can access analytics
router.use(requireRoles(["admin", "editor"]))

// System overview
router.get("/overview", analyticsController.getSystemOverview)

// Content statistics
router.get("/content", analyticsController.getContentStats)
router.get("/content/over-time", analyticsController.getContentCreationOverTime)
router.get("/content/status-distribution", analyticsController.getContentStatusDistribution)

// Media statistics
router.get("/media", analyticsController.getMediaStats)
router.get("/media/type-distribution", analyticsController.getMediaTypeDistribution)

// User statistics
router.get("/users", analyticsController.getUserStats)
router.get("/users/activity", analyticsController.getUserActivityOverTime)
router.get("/users/role-distribution", analyticsController.getUserRoleDistribution)
router.get("/users/top-creators", analyticsController.getTopContentCreators)

// Webhook statistics
router.get("/webhooks", analyticsController.getWebhookStats)
router.get("/webhooks/success-rate", analyticsController.getWebhookSuccessRateOverTime)

// Workflow statistics
router.get("/workflows", analyticsController.getWorkflowStats)
router.get("/workflows/completion", analyticsController.getWorkflowCompletionStats)

export const analyticsRoutes = router
