import { createRequestLogger } from "../config/logger"
import * as emailService from "./email.service"
import User from "../models/user.model"

/**
 * Send loyalty notification
 * @param userId User ID
 * @param type Notification type
 * @param data Notification data
 * @param requestId Request ID for logging
 * @returns Result of sending notification
 */
export const sendLoyaltyNotification = async (
  userId: string,
  type: "points_earned" | "points_expired" | "tier_upgrade" | "reward_redeemed" | "reward_approved" | "reward_rejected",
  data: Record<string, any>,
  requestId?: string,
): Promise<boolean> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending loyalty notification of type ${type} to user ${userId}`)

  try {
    // Get user
    const user = await User.findById(userId)
    if (!user || !user.email) {
      logger.warn(`User ${userId} not found or has no email`)
      return false
    }

    // Define notification templates
    const templates: Record<string, { subject: string; template: (data: any) => string }> = {
      points_earned: {
        subject: "You've Earned Loyalty Points!",
        template: (data) => `
          <h1>Congratulations, ${user.firstName || "Valued Customer"}!</h1>
          <p>You've earned <strong>${data.points}</strong> loyalty points.</p>
          <p>${data.description || ""}</p>
          <p>Your current points balance is <strong>${data.currentPoints}</strong>.</p>
          <p>Thank you for your loyalty!</p>
        `,
      },
      points_expired: {
        subject: "Your Loyalty Points Have Expired",
        template: (data) => `
          <h1>Hello, ${user.firstName || "Valued Customer"}</h1>
          <p>We wanted to let you know that <strong>${data.points}</strong> of your loyalty points have expired.</p>
          <p>Your current points balance is <strong>${data.currentPoints}</strong>.</p>
          <p>Remember to use your points before they expire!</p>
        `,
      },
      tier_upgrade: {
        subject: "Congratulations on Your Tier Upgrade!",
        template: (data) => `
          <h1>Congratulations, ${user.firstName || "Valued Customer"}!</h1>
          <p>We're excited to inform you that you've been upgraded to our <strong>${data.tierName}</strong> tier!</p>
          <p>You now have access to exclusive benefits including:</p>
          <ul>
            ${data.benefits.map((benefit: string) => `<li>${benefit}</li>`).join("")}
          </ul>
          <p>Thank you for your continued loyalty. Your current points balance is <strong>${
            data.currentPoints
          }</strong>.</p>
          <p>Keep shopping to enjoy even more rewards!</p>
        `,
      },
      reward_redeemed: {
        subject: "Reward Redemption Confirmation",
        template: (data) => `
          <h1>Reward Redemption Confirmation</h1>
          <p>Dear ${user.firstName || "Customer"},</p>
          <p>Thank you for redeeming your loyalty points for the following reward:</p>
          <h2>${data.rewardName}</h2>
          <p>${data.rewardDescription}</p>
          <p>Your redemption code is: <strong>${data.code}</strong></p>
          ${data.expiresAt ? `<p>This code will expire on ${new Date(data.expiresAt).toLocaleDateString()}.</p>` : ""}
          <p>You now have ${data.currentPoints} points remaining in your account.</p>
          <p>Thank you for your loyalty!</p>
        `,
      },
      reward_approved: {
        subject: "Your Reward Redemption Has Been Approved",
        template: (data) => `
          <h1>Reward Redemption Approved</h1>
          <p>Dear ${user.firstName || "Customer"},</p>
          <p>We're pleased to inform you that your redemption for <strong>${data.rewardName}</strong> has been approved!</p>
          <p>Your redemption code is: <strong>${data.code}</strong></p>
          ${data.expiresAt ? `<p>This code will expire on ${new Date(data.expiresAt).toLocaleDateString()}.</p>` : ""}
          <p>Thank you for your loyalty!</p>
        `,
      },
      reward_rejected: {
        subject: "Your Reward Redemption Has Been Rejected",
        template: (data) => `
          <h1>Reward Redemption Rejected</h1>
          <p>Dear ${user.firstName || "Customer"},</p>
          <p>We regret to inform you that your redemption for <strong>${data.rewardName}</strong> has been rejected.</p>
          ${data.notes ? `<p>Reason: ${data.notes}</p>` : ""}
          <p>Your points have been refunded to your account. Your current points balance is <strong>${
            data.currentPoints
          }</strong>.</p>
          <p>If you have any questions, please contact our customer support.</p>
        `,
      },
    }

    // Get template
    const template = templates[type]
    if (!template) {
      logger.error(`Notification template not found for type ${type}`)
      return false
    }

    // Send email
    await emailService.sendEmail(
      user.email,
      template.subject,
      template.template(data),
      {
        firstName: user.firstName,
        lastName: user.lastName,
      },
      requestId,
    )

    return true
  } catch (error) {
    logger.error(`Error sending loyalty notification: ${error.message}`)
    return false
  }
}

/**
 * Send batch loyalty notifications
 * @param notifications Array of notifications
 * @param requestId Request ID for logging
 * @returns Results of batch processing
 */
export const sendBatchLoyaltyNotifications = async (
  notifications: Array<{
    userId: string
    type:
      | "points_earned"
      | "points_expired"
      | "tier_upgrade"
      | "reward_redeemed"
      | "reward_approved"
      | "reward_rejected"
    data: Record<string, any>
  }>,
  requestId?: string,
): Promise<{
  success: boolean
  results: Array<{
    userId: string
    type: string
    success: boolean
    error?: string
  }>
}> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending batch loyalty notifications for ${notifications.length} notifications`)

  const results = []
  let hasErrors = false

  // Process notifications in chunks to avoid overwhelming the email service
  const CHUNK_SIZE = 20
  const chunks = []

  for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
    chunks.push(notifications.slice(i, i + CHUNK_SIZE))
  }

  for (const chunk of chunks) {
    // Process chunk in parallel
    const chunkResults = await Promise.all(
      chunk.map(async (notification) => {
        try {
          const success = await sendLoyaltyNotification(
            notification.userId,
            notification.type,
            notification.data,
            requestId,
          )

          return {
            userId: notification.userId,
            type: notification.type,
            success,
          }
        } catch (error) {
          hasErrors = true
          return {
            userId: notification.userId,
            type: notification.type,
            success: false,
            error: error.message,
          }
        }
      }),
    )

    results.push(...chunkResults)
  }

  return {
    success: !hasErrors,
    results,
  }
}
