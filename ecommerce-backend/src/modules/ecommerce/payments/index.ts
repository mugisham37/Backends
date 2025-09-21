/**
 * Payment Module Index
 * Exports all payment-related functionality
 */

// Core services and repositories
export { PaymentService } from "./payment.service.js";
export {
  PaymentController,
  createPaymentController,
} from "./payment.controller.js";
export { PaymentRepository } from "../../../core/repositories/payment.repository.js";

// Types and interfaces
export * from "./payment.types.js";

// Validators (explicit re-exports to avoid conflicts)
export {
  createPaymentSchema,
  updatePaymentSchema,
  processPaymentSchema,
  refundPaymentSchema,
  paymentFiltersSchema,
  paymentReportingSchema,
} from "./payment.validators.js";

// Payment providers
export { StripeProvider } from "./providers/stripe.provider.js";
export { PayPalProvider } from "./providers/paypal.provider.js";

// Routes
export { paymentRoutes } from "../../../api/rest/routes/payment.routes.js";

/**
 * Payment module configuration
 */
export const paymentConfig = {
  defaultCurrency: "USD",
  supportedCurrencies: ["USD", "EUR", "GBP", "CAD", "AUD"],
  providers: {
    stripe: {
      provider: "stripe",
      isEnabled: process.env.STRIPE_ENABLED === "true",
      config: {
        apiKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      },
      fees: {
        fixedFee: 0.3,
        percentageFee: 2.9,
        currency: "USD",
      },
    },
    paypal: {
      provider: "paypal",
      isEnabled: process.env.PAYPAL_ENABLED === "true",
      config: {
        clientId: process.env.PAYPAL_CLIENT_ID,
        clientSecret: process.env.PAYPAL_CLIENT_SECRET,
        environment: process.env.PAYPAL_ENVIRONMENT || "sandbox",
      },
      fees: {
        fixedFee: 0.3,
        percentageFee: 2.9,
        currency: "USD",
      },
    },
  },
  security: {
    maxAttempts: 3,
    cooldownPeriod: 15, // minutes
    fraudThreshold: 70,
    requiresVerification: true,
  },
  fees: {
    defaultApplicationFeePercentage: 1.0,
    minimumApplicationFee: 0.5,
  },
  features: {
    enableRefunds: true,
    enablePartialRefunds: true,
    enableDisputes: true,
    enableSubscriptions: false,
    enableMultiCurrency: true,
  },
} as const;
