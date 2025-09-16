import { createRequestLogger } from "../config/logger"
import * as loyaltyService from "./loyalty.service"
import { LoyaltyHistory } from "../models/loyalty.model"
import { ApiError } from "../utils/api-error"

/**
 * Process loyalty points in batch
 * @param operations Array of operations
 * @param requestId Request ID for logging
 * @returns Results of batch processing
 */
export const processBatchLoyaltyPoints = async (
  operations: Array<{
    userId: string
    points: number
    description: string
    referenceId?: string
    type?: "order" | "referral" | "manual" | "other"
  }>,
  requestId?: string,
): Promise<{
  success: boolean
  results: Array<{
    userId: string
    success: boolean
    points: number
    error?: string
  }>
}> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Processing batch loyalty points for ${operations.length} operations`)

  const results = []
  let hasErrors = false

  // Process operations in chunks to avoid overwhelming the database
  const CHUNK_SIZE = 50
  const chunks = []

  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    chunks.push(operations.slice(i, i + CHUNK_SIZE))
  }

  for (const chunk of chunks) {
    // Process chunk in parallel
    const chunkResults = await Promise.all(
      chunk.map(async (operation) => {
        try {
          await loyaltyService.addLoyaltyPoints(
            operation.userId,
            operation.points,
            operation.description,
            operation.referenceId,
            operation.type || "other",
            requestId,
          )

          return {
            userId: operation.userId,
            success: true,
            points: operation.points,
          }
        } catch (error) {
          hasErrors = true
          return {
            userId: operation.userId,
            success: false,
            points: operation.points,
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

/**
 * Process expired loyalty points in batch
 * @param expiryDays Number of days after which points expire
 * @param batchSize Batch size for processing
 * @param requestId Request ID for logging
 * @returns Results of batch processing
 */
export const processBatchExpiredPoints = async (
  expiryDays = 365,
  batchSize = 100,
  requestId?: string,
): Promise<{
  success: boolean
  processed: number
  errors: number
}> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Processing batch expired points with expiry days: ${expiryDays}, batch size: ${batchSize}`)

  try {
    // Calculate expiry date
    const expiryDate = new Date()
    expiryDate.setDate(expiryDate.getDate() - expiryDays)

    // Find loyalty history entries older than expiry date that haven't been processed
    const historyEntries = await LoyaltyHistory.find({
      createdAt: { $lt: expiryDate },
      type: { $in: ["order", "referral", "manual", "other"] }, // Only positive point entries
      points: { $gt: 0 },
      processed: { $ne: true },
    })
      .limit(batchSize)
      .populate("user")

    logger.info(`Found ${historyEntries.length} loyalty history entries to expire`)

    let processed = 0
    let errors = 0

    // Process entries in chunks
    const CHUNK_SIZE = 20
    const chunks = []

    for (let i = 0; i < historyEntries.length; i += CHUNK_SIZE) {
      chunks.push(historyEntries.slice(i, i + CHUNK_SIZE))
    }

    for (const chunk of chunks) {
      // Process chunk in parallel
      await Promise.all(
        chunk.map(async (entry) => {
          try {
            // Mark entry as processed
            entry.processed = true
            await entry.save()

            // Add expiry entry to history
            await LoyaltyHistory.create({
              user: entry.user._id,
              type: "expire",
              points: -entry.points,
              description: `Points expired from ${new Date(entry.createdAt).toLocaleDateString()}`,
            })

            // Update user's points
            await loyaltyService.adjustCustomerPoints(
              entry.user._id.toString(),
              -entry.points,
              `Points expired from ${new Date(entry.createdAt).toLocaleDateString()}`,
              requestId,
            )

            processed++
          } catch (error) {
            logger.error(`Error processing loyalty expiry for user ${entry.user._id}: ${error.message}`)
            errors++
          }
        }),
      )
    }

    return {
      success: errors === 0,
      processed,
      errors,
    }
  } catch (error) {
    logger.error(`Error in batch expired points processing: ${error.message}`)
    throw new ApiError(`Failed to process expired points: ${error.message}`, 500)
  }
}
