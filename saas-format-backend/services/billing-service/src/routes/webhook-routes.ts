import express from "express"
import { WebhookController } from "../controllers/webhook-controller"

const router = express.Router()
const webhookController = new WebhookController()

// Stripe webhook endpoint
router.post("/", express.raw({ type: "application/json" }), webhookController.handleWebhook)

export default router
