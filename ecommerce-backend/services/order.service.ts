// Add this import at the top of the file
import * as loyaltyService from "./loyalty.service"
import { createRequestLogger } from "../utils/logger"
import { Order, type IOrder } from "../models/order.model"
import { ApiError } from "../utils/api-error"
import { User } from "../models/user.model"
import { sendOrderDeliveredEmail, sendOrderConfirmationEmail } from "./email.service"
import { processOrderInventory } from "./inventory.service"

// Add this function to the existing order service
/**
 * Process order completion
 * @param orderId Order ID
 * @param requestId Request ID for logging
 * @returns Updated order
 */
export const processOrderCompletion = async (orderId: string, requestId?: string): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Processing order completion for order ID: ${orderId}`)

  try {
    // Get order
    const order = await Order.findById(orderId)
    if (!order) {
      throw new ApiError("Order not found", 404)
    }

    // Check if order is already delivered
    if (order.isDelivered) {
      logger.info(`Order ${orderId} is already marked as delivered`)
      return order
    }

    // Update order status
    order.isDelivered = true
    order.deliveredAt = new Date()
    order.status = "delivered"

    // Save order
    await order.save()

    // Process loyalty points if order is paid
    if (order.isPaid && order.user) {
      try {
        await loyaltyService.processOrderPoints(orderId, requestId)
      } catch (error) {
        logger.error(`Error processing loyalty points: ${error.message}`)
        // Continue processing even if loyalty points fail
      }
    }

    // Send order delivered email
    if (order.user) {
      const user = await User.findById(order.user)
      if (user && user.email) {
        try {
          await sendOrderDeliveredEmail(
            user.email,
            {
              firstName: user.firstName,
              orderId: order._id.toString(),
              reviewUrl: `${process.env.FRONTEND_URL || "https://example.com"}/review/${order._id}`,
              orderUrl: `${process.env.FRONTEND_URL || "https://example.com"}/orders/${order._id}`,
              storeName: process.env.STORE_NAME || "Our Store",
              year: new Date().getFullYear(),
            },
            user.language || "en",
            requestId,
          )
        } catch (emailError) {
          logger.error(`Error sending order delivered email: ${emailError.message}`)
          // Continue processing even if email fails
        }
      }
    }

    // Return updated order
    return order
  } catch (error) {
    logger.error(`Error processing order completion: ${error.message}`)
    throw error
  }
}

// Modify the updateOrderToPaid function to process loyalty points
export const updateOrderToPaid = async (
  orderId: string,
  paymentResult: {
    id: string
    status: string
    update_time: string
    email_address?: string
  },
  requestId?: string,
): Promise<IOrder> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Updating order ${orderId} to paid status`)

  try {
    const order = await Order.findById(orderId)

    if (!order) {
      throw new ApiError("Order not found", 404)
    }

    // Update order payment details
    order.isPaid = true
    order.paidAt = new Date()
    order.paymentResult = {
      id: paymentResult.id,
      status: paymentResult.status,
      update_time: paymentResult.update_time,
      email_address: paymentResult.email_address,
    }

    // Update order status
    if (order.status === "pending") {
      order.status = "processing"
    }

    // Save updated order
    const updatedOrder = await order.save()

    // Process inventory
    await processOrderInventory(orderId, requestId)

    // Process loyalty points if order has a user
    if (order.user) {
      try {
        await loyaltyService.processOrderPoints(orderId, requestId)
      } catch (error) {
        logger.error(`Error processing loyalty points: ${error.message}`)
        // Continue processing even if loyalty points fail
      }
    }

    // Send order confirmation email
    if (order.user) {
      const user = await User.findById(order.user)
      if (user && user.email) {
        try {
          // Format order items for email
          const formattedItems = order.orderItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
          }))

          await sendOrderConfirmationEmail(
            user.email,
            {
              firstName: user.firstName,
              orderId: order._id.toString(),
              orderDate: order.createdAt.toLocaleDateString(),
              orderItems: formattedItems,
              subtotal: order.itemsPrice,
              tax: order.taxPrice,
              shipping: order.shippingPrice,
              total: order.totalPrice,
              shippingAddress: order.shippingAddress,
              orderUrl: `${process.env.FRONTEND_URL || "https://example.com"}/orders/${order._id}`,
              storeName: process.env.STORE_NAME || "Our Store",
              year: new Date().getFullYear(),
            },
            user.language || "en",
            requestId,
          )
        } catch (emailError) {
          logger.error(`Error sending order confirmation email: ${emailError.message}`)
          // Continue processing even if email fails
        }
      }
    }

    return updatedOrder
  } catch (error) {
    logger.error(`Error updating order to paid: ${error.message}`)
    throw error
  }
}
