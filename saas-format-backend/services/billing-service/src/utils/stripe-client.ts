import Stripe from "stripe"
import { logger } from "./logger"

// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
})

// Test Stripe connection
export const testStripeConnection = async () => {
  try {
    const paymentMethods = await stripe.paymentMethods.list({
      limit: 1,
    })
    logger.info("Stripe connection successful")
    return true
  } catch (error) {
    logger.error(`Stripe connection failed: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

export default stripe
