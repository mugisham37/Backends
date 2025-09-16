import * as loyaltyService from "./loyalty.service"
import * as settingsService from "./settings.service"
import type { IReview } from "../models/review.model"
import { createRequestLogger } from "../utils/logger"
import { Product } from "../models/product.model"
import { ApiError } from "../utils/api-error"
import { User } from "../models/user.model"
import { Review } from "../models/review.model"
import { Order } from "../models/order.model"
import { updateProductRatings } from "./product.service"

// Update the createReview function to award loyalty points
export const createReview = async (reviewData: Partial<IReview>, requestId?: string): Promise<IReview> => {
  const logger = createRequestLogger(requestId)
  logger.info("Creating new review")

  try {
    // Check if product exists
    const product = await Product.findById(reviewData.product)
    if (!product) {
      throw new ApiError("Product not found", 404)
    }

    // Check if user exists
    const user = await User.findById(reviewData.user)
    if (!user) {
      throw new ApiError("User not found", 404)
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      user: reviewData.user,
      product: reviewData.product,
    })

    if (existingReview) {
      throw new ApiError("You have already reviewed this product", 400)
    }

    // Check if user has purchased the product
    const hasPurchased = await Order.exists({
      user: reviewData.user,
      "orderItems.product": reviewData.product,
      isPaid: true,
    })

    if (!hasPurchased && !user.role.includes("admin")) {
      throw new ApiError("You can only review products you have purchased", 400)
    }

    // Create review
    const review = await Review.create({
      ...reviewData,
      isVerified: Boolean(hasPurchased),
    })

    // Update product ratings
    await updateProductRatings(reviewData.product.toString(), requestId)

    // Award loyalty points for review
    try {
      // Get review bonus points from settings
      const reviewBonus = await settingsService.getSetting("loyalty.reviewBonus", 50, requestId)

      if (reviewBonus > 0) {
        await loyaltyService.addLoyaltyPoints(
          reviewData.user.toString(),
          reviewBonus,
          `Points earned for reviewing ${product.name}`,
          review._id.toString(),
          "other",
          requestId,
        )
      }
    } catch (loyaltyError) {
      logger.error(`Error awarding loyalty points for review: ${loyaltyError.message}`)
      // Continue processing even if loyalty points fail
    }

    return review
  } catch (error) {
    logger.error(`Error creating review: ${error.message}`)
    throw error
  }
}
