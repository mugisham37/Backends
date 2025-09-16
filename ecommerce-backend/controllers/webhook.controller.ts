import type { Request, Response } from "express"
import asyncHandler from "express-async-handler"
import { createRequestLogger } from "../utils/requestLogger"
import { loyaltyService } from "../services/loyalty.service"

// Add this function to the existing webhook controller

/**
 * Handle loyalty webhook events
 * @route POST /api/v1/webhooks/loyalty
 * @access Public
 */
export const handleLoyaltyWebhook = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const signature = req.headers["x-loyalty-signature"] as string

  // Verify signature (implement your own verification logic)
  if (!signature) {
    requestLogger.warn("Missing loyalty webhook signature")
    return res.status(400).json({ status: "error", message: "Missing signature" })
  }

  // Process webhook event
  const event = req.body

  requestLogger.info(`Received loyalty webhook event: ${event.type}`)

  try {
    switch (event.type) {
      case "points.awarded":
        // Handle points awarded event
        await loyaltyService.addLoyaltyPoints(
          event.data.userId,
          event.data.points,
          event.data.description || "Points awarded via webhook",
          event.data.referenceId,
          event.data.type || "other",
          req.id,
        )
        break

      case "points.redeemed":
        // Handle points redeemed event
        if (event.data.rewardId) {
          await loyaltyService.redeemReward(event.data.userId, event.data.rewardId, req.id)
        }
        break

      case "tier.upgraded":
        // Handle tier upgraded event
        // This is handled automatically by the addLoyaltyPoints function
        break

      default:
        requestLogger.warn(`Unknown loyalty webhook event type: ${event.type}`)
    }

    res.status(200).json({ status: "success", message: "Webhook processed successfully" })
  } catch (error) {
    requestLogger.error(`Error processing loyalty webhook: ${error.message}`)
    res.status(500).json({ status: "error", message: "Error processing webhook" })
  }
})
