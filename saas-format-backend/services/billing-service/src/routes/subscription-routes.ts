import express from "express"
import { SubscriptionController } from "../controllers/subscription-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const subscriptionController = new SubscriptionController()

// Get current tenant's subscription
router.get("/current", subscriptionController.getCurrentSubscription)

// Create or update subscription
router.post("/", authorize(["tenant_admin", "super_admin"]), subscriptionController.createOrUpdateSubscription)

// Cancel subscription
router.post("/cancel", authorize(["tenant_admin", "super_admin"]), subscriptionController.cancelSubscription)

// Reactivate subscription
router.post("/reactivate", authorize(["tenant_admin", "super_admin"]), subscriptionController.reactivateSubscription)

// Change subscription plan
router.post("/change-plan", authorize(["tenant_admin", "super_admin"]), subscriptionController.changePlan)

// Get payment methods
router.get("/payment-methods", authorize(["tenant_admin", "super_admin"]), subscriptionController.getPaymentMethods)

// Add payment method
router.post("/payment-methods", authorize(["tenant_admin", "super_admin"]), subscriptionController.addPaymentMethod)

// Delete payment method
router.delete(
  "/payment-methods/:id",
  authorize(["tenant_admin", "super_admin"]),
  subscriptionController.deletePaymentMethod,
)

// Set default payment method
router.post(
  "/payment-methods/:id/default",
  authorize(["tenant_admin", "super_admin"]),
  subscriptionController.setDefaultPaymentMethod,
)

// Create checkout session
router.post("/checkout", authorize(["tenant_admin", "super_admin"]), subscriptionController.createCheckoutSession)

// Create customer portal session
router.post("/portal", authorize(["tenant_admin", "super_admin"]), subscriptionController.createCustomerPortalSession)

export default router
