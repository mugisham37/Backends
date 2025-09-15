import { Router } from "express"
import { WebhookController } from "../../../controllers/webhook.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { webhookValidation } from "../../../validations/webhook.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const webhookController = new WebhookController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get all webhooks
router.get("/", webhookController.getAllWebhooks)

// Get webhook by ID
router.get("/:id", webhookController.getWebhookById)

// Create webhook (admin and editor only)
router.post(
  "/",
  requireRoles(["admin", "editor"]),
  validateRequest(webhookValidation.createWebhook),
  webhookController.createWebhook,
)

// Update webhook (admin and editor only)
router.put(
  "/:id",
  requireRoles(["admin", "editor"]),
  validateRequest(webhookValidation.updateWebhook),
  webhookController.updateWebhook,
)

// Delete webhook (admin only)
router.delete("/:id", requireRoles(["admin"]), webhookController.deleteWebhook)

// Get webhook deliveries
router.get("/:id/deliveries", webhookController.getWebhookDeliveries)

// Test webhook (admin and editor only)
router.post("/:id/test", requireRoles(["admin", "editor"]), webhookController.testWebhook)

// Retry webhook delivery (admin and editor only)
router.post("/deliveries/:id/retry", requireRoles(["admin", "editor"]), webhookController.retryWebhookDelivery)

export const webhookRoutes = router
