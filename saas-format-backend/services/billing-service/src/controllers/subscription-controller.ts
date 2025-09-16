import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import stripe from "../utils/stripe-client"
import { sendMessage } from "../utils/kafka-client"
import { z } from "zod"

// Validation schemas
const createSubscriptionSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string().optional(),
})

const changePlanSchema = z.object({
  planId: z.string(),
})

const addPaymentMethodSchema = z.object({
  paymentMethodId: z.string(),
})

export class SubscriptionController {
  // Get current tenant's subscription
  async getCurrentSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription) {
        return res.status(200).json({
          status: "success",
          data: null,
        })
      }

      // Get plan details
      const plan = await prisma.pricingPlan.findFirst({
        where: { name: subscription.plan },
      })

      res.status(200).json({
        status: "success",
        data: {
          ...subscription,
          planDetails: plan,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Create or update subscription
  async createOrUpdateSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Validate request body
      const validatedData = createSubscriptionSchema.parse(req.body)

      // Get pricing plan
      const plan = await prisma.pricingPlan.findUnique({
        where: { id: validatedData.planId },
      })

      if (!plan) {
        throw new ApiError(404, "Pricing plan not found")
      }

      // Check if subscription already exists
      const existingSubscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      // If free plan, just create a subscription record without Stripe
      if (plan.price === 0) {
        const subscription = existingSubscription
          ? await prisma.subscription.update({
              where: { tenantId: req.tenant.id },
              data: {
                plan: plan.name,
                status: "active",
                startDate: new Date(),
                endDate: null,
                canceledAt: null,
              },
            })
          : await prisma.subscription.create({
              data: {
                tenantId: req.tenant.id,
                plan: plan.name,
                status: "active",
                startDate: new Date(),
              },
            })

        // Log subscription creation/update
        await prisma.billingAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            action: existingSubscription ? "subscription_updated" : "subscription_created",
            performedBy: req.user?.id,
            details: JSON.stringify({
              plan: plan.name,
              status: "active",
            }),
          },
        })

        // Publish subscription event
        await sendMessage("billing-events", {
          type: existingSubscription ? "SUBSCRIPTION_UPDATED" : "SUBSCRIPTION_CREATED",
          data: {
            tenantId: req.tenant.id,
            plan: plan.name,
            status: "active",
            startDate: subscription.startDate,
          },
        })

        return res.status(200).json({
          status: "success",
          data: subscription,
        })
      }

      // For paid plans, we need to interact with Stripe
      // Check if we have a Stripe customer ID
      let customerId = existingSubscription?.customerId

      if (!customerId) {
        // Create a customer in Stripe
        const customer = await stripe.customers.create({
          email: req.user?.email,
          metadata: {
            tenantId: req.tenant.id,
          },
        })

        customerId = customer.id
      }

      // If payment method provided, attach it to the customer
      if (validatedData.paymentMethodId) {
        await stripe.paymentMethods.attach(validatedData.paymentMethodId, {
          customer: customerId,
        })

        // Set as default payment method
        await stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: validatedData.paymentMethodId,
          },
        })
      }

      // Create or update subscription in Stripe
      let stripeSubscription

      if (existingSubscription?.subscriptionId) {
        // Update existing subscription
        stripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.subscriptionId)

        // If subscription is canceled, create a new one
        if (stripeSubscription.status === "canceled") {
          stripeSubscription = await stripe.subscriptions.create({
            customer: customerId,
            items: [
              {
                price: plan.stripePriceId,
              },
            ],
            metadata: {
              tenantId: req.tenant.id,
            },
          })
        } else {
          // Update existing subscription
          stripeSubscription = await stripe.subscriptions.update(existingSubscription.subscriptionId, {
            items: [
              {
                id: stripeSubscription.items.data[0].id,
                price: plan.stripePriceId,
              },
            ],
          })
        }
      } else {
        // Create new subscription
        stripeSubscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [
            {
              price: plan.stripePriceId,
            },
          ],
          metadata: {
            tenantId: req.tenant.id,
          },
        })
      }

      // Update or create subscription in database
      const subscription = existingSubscription
        ? await prisma.subscription.update({
            where: { tenantId: req.tenant.id },
            data: {
              plan: plan.name,
              status: stripeSubscription.status,
              startDate: new Date(stripeSubscription.current_period_start * 1000),
              endDate: new Date(stripeSubscription.current_period_end * 1000),
              customerId,
              subscriptionId: stripeSubscription.id,
              canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            },
          })
        : await prisma.subscription.create({
            data: {
              tenantId: req.tenant.id,
              plan: plan.name,
              status: stripeSubscription.status,
              startDate: new Date(stripeSubscription.current_period_start * 1000),
              endDate: new Date(stripeSubscription.current_period_end * 1000),
              customerId,
              subscriptionId: stripeSubscription.id,
              canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            },
          })

      // Log subscription creation/update
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: existingSubscription ? "subscription_updated" : "subscription_created",
          performedBy: req.user?.id,
          details: JSON.stringify({
            plan: plan.name,
            status: stripeSubscription.status,
            stripeSubscriptionId: stripeSubscription.id,
          }),
        },
      })

      // Publish subscription event
      await sendMessage("billing-events", {
        type: existingSubscription ? "SUBSCRIPTION_UPDATED" : "SUBSCRIPTION_CREATED",
        data: {
          tenantId: req.tenant.id,
          plan: plan.name,
          status: stripeSubscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      })

      logger.info(`Subscription ${existingSubscription ? "updated" : "created"} for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        data: subscription,
      })
    } catch (error) {
      next(error)
    }
  }

  // Cancel subscription
  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // If it's a free plan, just update the status
      if (!subscription.subscriptionId) {
        const updatedSubscription = await prisma.subscription.update({
          where: { tenantId: req.tenant.id },
          data: {
            status: "canceled",
            canceledAt: new Date(),
          },
        })

        // Log subscription cancellation
        await prisma.billingAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            action: "subscription_canceled",
            performedBy: req.user?.id,
            details: JSON.stringify({
              plan: subscription.plan,
              status: "canceled",
            }),
          },
        })

        // Publish subscription canceled event
        await sendMessage("billing-events", {
          type: "SUBSCRIPTION_CANCELED",
          data: {
            tenantId: req.tenant.id,
            plan: subscription.plan,
            canceledAt: updatedSubscription.canceledAt,
          },
        })

        return res.status(200).json({
          status: "success",
          data: updatedSubscription,
        })
      }

      // Cancel subscription in Stripe
      const stripeSubscription = await stripe.subscriptions.update(subscription.subscriptionId, {
        cancel_at_period_end: true,
      })

      // Update subscription in database
      const updatedSubscription = await prisma.subscription.update({
        where: { tenantId: req.tenant.id },
        data: {
          status: "canceled",
          canceledAt: new Date(),
        },
      })

      // Log subscription cancellation
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "subscription_canceled",
          performedBy: req.user?.id,
          details: JSON.stringify({
            plan: subscription.plan,
            status: "canceled",
            stripeSubscriptionId: subscription.subscriptionId,
          }),
        },
      })

      // Publish subscription canceled event
      await sendMessage("billing-events", {
        type: "SUBSCRIPTION_CANCELED",
        data: {
          tenantId: req.tenant.id,
          plan: subscription.plan,
          canceledAt: updatedSubscription.canceledAt,
        },
      })

      logger.info(`Subscription canceled for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        data: updatedSubscription,
      })
    } catch (error) {
      next(error)
    }
  }

  // Reactivate subscription
  async reactivateSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // If it's a free plan, just update the status
      if (!subscription.subscriptionId) {
        const updatedSubscription = await prisma.subscription.update({
          where: { tenantId: req.tenant.id },
          data: {
            status: "active",
            canceledAt: null,
          },
        })

        // Log subscription reactivation
        await prisma.billingAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            action: "subscription_reactivated",
            performedBy: req.user?.id,
            details: JSON.stringify({
              plan: subscription.plan,
              status: "active",
            }),
          },
        })

        // Publish subscription reactivated event
        await sendMessage("billing-events", {
          type: "SUBSCRIPTION_REACTIVATED",
          data: {
            tenantId: req.tenant.id,
            plan: subscription.plan,
          },
        })

        return res.status(200).json({
          status: "success",
          data: updatedSubscription,
        })
      }

      // Reactivate subscription in Stripe
      const stripeSubscription = await stripe.subscriptions.update(subscription.subscriptionId, {
        cancel_at_period_end: false,
      })

      // Update subscription in database
      const updatedSubscription = await prisma.subscription.update({
        where: { tenantId: req.tenant.id },
        data: {
          status: stripeSubscription.status,
          canceledAt: null,
        },
      })

      // Log subscription reactivation
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "subscription_reactivated",
          performedBy: req.user?.id,
          details: JSON.stringify({
            plan: subscription.plan,
            status: stripeSubscription.status,
            stripeSubscriptionId: subscription.subscriptionId,
          }),
        },
      })

      // Publish subscription reactivated event
      await sendMessage("billing-events", {
        type: "SUBSCRIPTION_REACTIVATED",
        data: {
          tenantId: req.tenant.id,
          plan: subscription.plan,
        },
      })

      logger.info(`Subscription reactivated for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        data: updatedSubscription,
      })
    } catch (error) {
      next(error)
    }
  }

  // Change subscription plan
  async changePlan(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Validate request body
      const validatedData = changePlanSchema.parse(req.body)

      // Get pricing plan
      const plan = await prisma.pricingPlan.findUnique({
        where: { id: validatedData.planId },
      })

      if (!plan) {
        throw new ApiError(404, "Pricing plan not found")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // If changing to free plan, cancel Stripe subscription if exists
      if (plan.price === 0 && subscription.subscriptionId) {
        await stripe.subscriptions.del(subscription.subscriptionId)

        // Update subscription in database
        const updatedSubscription = await prisma.subscription.update({
          where: { tenantId: req.tenant.id },
          data: {
            plan: plan.name,
            status: "active",
            subscriptionId: null,
            canceledAt: null,
          },
        })

        // Log plan change
        await prisma.billingAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            action: "plan_changed",
            performedBy: req.user?.id,
            details: JSON.stringify({
              oldPlan: subscription.plan,
              newPlan: plan.name,
              status: "active",
            }),
          },
        })

        // Publish subscription updated event
        await sendMessage("billing-events", {
          type: "SUBSCRIPTION_UPDATED",
          data: {
            tenantId: req.tenant.id,
            plan: plan.name,
            status: "active",
          },
        })

        return res.status(200).json({
          status: "success",
          data: updatedSubscription,
        })
      }

      // If changing from free plan to paid plan, create new Stripe subscription
      if (plan.price > 0 && !subscription.subscriptionId) {
        // We need a customer ID and payment method
        if (!subscription.customerId) {
          throw new ApiError(400, "Customer not set up for billing. Please add a payment method first.")
        }

        // Get customer's payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: subscription.customerId,
          type: "card",
        })

        if (paymentMethods.data.length === 0) {
          throw new ApiError(400, "No payment method found. Please add a payment method first.")
        }

        // Create subscription in Stripe
        const stripeSubscription = await stripe.subscriptions.create({
          customer: subscription.customerId,
          items: [
            {
              price: plan.stripePriceId,
            },
          ],
          metadata: {
            tenantId: req.tenant.id,
          },
        })

        // Update subscription in database
        const updatedSubscription = await prisma.subscription.update({
          where: { tenantId: req.tenant.id },
          data: {
            plan: plan.name,
            status: stripeSubscription.status,
            startDate: new Date(stripeSubscription.current_period_start * 1000),
            endDate: new Date(stripeSubscription.current_period_end * 1000),
            subscriptionId: stripeSubscription.id,
            canceledAt: null,
          },
        })

        // Log plan change
        await prisma.billingAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            action: "plan_changed",
            performedBy: req.user?.id,
            details: JSON.stringify({
              oldPlan: subscription.plan,
              newPlan: plan.name,
              status: stripeSubscription.status,
              stripeSubscriptionId: stripeSubscription.id,
            }),
          },
        })

        // Publish subscription updated event
        await sendMessage("billing-events", {
          type: "SUBSCRIPTION_UPDATED",
          data: {
            tenantId: req.tenant.id,
            plan: plan.name,
            status: stripeSubscription.status,
          },
        })

        return res.status(200).json({
          status: "success",
          data: updatedSubscription,
        })
      }

      // If changing between paid plans, update Stripe subscription
      if (plan.price > 0 && subscription.subscriptionId) {
        // Update subscription in Stripe
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.subscriptionId)

        const updatedStripeSubscription = await stripe.subscriptions.update(subscription.subscriptionId, {
          items: [
            {
              id: stripeSubscription.items.data[0].id,
              price: plan.stripePriceId,
            },
          ],
        })

        // Update subscription in database
        const updatedSubscription = await prisma.subscription.update({
          where: { tenantId: req.tenant.id },
          data: {
            plan: plan.name,
            status: updatedStripeSubscription.status,
            startDate: new Date(updatedStripeSubscription.current_period_start * 1000),
            endDate: new Date(updatedStripeSubscription.current_period_end * 1000),
          },
        })

        // Log plan change
        await prisma.billingAuditLog.create({
          data: {
            tenantId: req.tenant.id,
            action: "plan_changed",
            performedBy: req.user?.id,
            details: JSON.stringify({
              oldPlan: subscription.plan,
              newPlan: plan.name,
              status: updatedStripeSubscription.status,
              stripeSubscriptionId: subscription.subscriptionId,
            }),
          },
        })

        // Publish subscription updated event
        await sendMessage("billing-events", {
          type: "SUBSCRIPTION_UPDATED",
          data: {
            tenantId: req.tenant.id,
            plan: plan.name,
            status: updatedStripeSubscription.status,
          },
        })

        return res.status(200).json({
          status: "success",
          data: updatedSubscription,
        })
      }

      throw new ApiError(500, "Unexpected subscription state")
    } catch (error) {
      next(error)
    }
  }

  // Get payment methods
  async getPaymentMethods(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription || !subscription.customerId) {
        return res.status(200).json({
          status: "success",
          data: [],
        })
      }

      // Get payment methods from Stripe
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.customerId,
        type: "card",
      })

      // Get default payment method
      const customer = await stripe.customers.retrieve(subscription.customerId)
      const defaultPaymentMethodId = customer.invoice_settings?.default_payment_method

      // Format response
      const formattedPaymentMethods = paymentMethods.data.map((pm) => ({
        id: pm.id,
        brand: pm.card?.brand,
        last4: pm.card?.last4,
        expMonth: pm.card?.exp_month,
        expYear: pm.card?.exp_year,
        isDefault: pm.id === defaultPaymentMethodId,
      }))

      res.status(200).json({
        status: "success",
        data: formattedPaymentMethods,
      })
    } catch (error) {
      next(error)
    }
  }

  // Add payment method
  async addPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Validate request body
      const validatedData = addPaymentMethodSchema.parse(req.body)

      // Check if subscription exists
      let subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      let customerId

      if (!subscription) {
        // Create a subscription record with null subscriptionId
        subscription = await prisma.subscription.create({
          data: {
            tenantId: req.tenant.id,
            plan: "free",
            status: "active",
            startDate: new Date(),
          },
        })
      }

      // If no customer ID, create a customer in Stripe
      if (!subscription.customerId) {
        const customer = await stripe.customers.create({
          email: req.user?.email,
          metadata: {
            tenantId: req.tenant.id,
          },
        })

        customerId = customer.id

        // Update subscription with customer ID
        subscription = await prisma.subscription.update({
          where: { tenantId: req.tenant.id },
          data: {
            customerId,
          },
        })
      } else {
        customerId = subscription.customerId
      }

      // Attach payment method to customer
      await stripe.paymentMethods.attach(validatedData.paymentMethodId, {
        customer: customerId,
      })

      // Set as default payment method
      await stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: validatedData.paymentMethodId,
        },
      })

      // Get payment method details
      const paymentMethod = await stripe.paymentMethods.retrieve(validatedData.paymentMethodId)

      // Log payment method addition
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "payment_method_added",
          performedBy: req.user?.id,
          details: JSON.stringify({
            paymentMethodId: validatedData.paymentMethodId,
            brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4,
          }),
        },
      })

      logger.info(`Payment method added for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        data: {
          id: paymentMethod.id,
          brand: paymentMethod.card?.brand,
          last4: paymentMethod.card?.last4,
          expMonth: paymentMethod.card?.exp_month,
          expYear: paymentMethod.card?.exp_year,
          isDefault: true,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete payment method
  async deletePaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { id } = req.params

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription || !subscription.customerId) {
        throw new ApiError(404, "No billing setup found")
      }

      // Check if payment method belongs to customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.customerId,
        type: "card",
      })

      const paymentMethod = paymentMethods.data.find((pm) => pm.id === id)

      if (!paymentMethod) {
        throw new ApiError(404, "Payment method not found")
      }

      // Get customer to check if it's the default payment method
      const customer = await stripe.customers.retrieve(subscription.customerId)
      const isDefault = customer.invoice_settings?.default_payment_method === id

      // If it's the default and there are other payment methods, set another one as default
      if (isDefault && paymentMethods.data.length > 1) {
        const newDefault = paymentMethods.data.find((pm) => pm.id !== id)

        if (newDefault) {
          await stripe.customers.update(subscription.customerId, {
            invoice_settings: {
              default_payment_method: newDefault.id,
            },
          })
        }
      }

      // Detach payment method
      await stripe.paymentMethods.detach(id)

      // Log payment method deletion
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "payment_method_deleted",
          performedBy: req.user?.id,
          details: JSON.stringify({
            paymentMethodId: id,
            brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4,
          }),
        },
      })

      logger.info(`Payment method deleted for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        message: "Payment method deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  // Set default payment method
  async setDefaultPaymentMethod(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { id } = req.params

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription || !subscription.customerId) {
        throw new ApiError(404, "No billing setup found")
      }

      // Check if payment method belongs to customer
      const paymentMethods = await stripe.paymentMethods.list({
        customer: subscription.customerId,
        type: "card",
      })

      const paymentMethod = paymentMethods.data.find((pm) => pm.id === id)

      if (!paymentMethod) {
        throw new ApiError(404, "Payment method not found")
      }

      // Set as default payment method
      await stripe.customers.update(subscription.customerId, {
        invoice_settings: {
          default_payment_method: id,
        },
      })

      // Log default payment method change
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "default_payment_method_changed",
          performedBy: req.user?.id,
          details: JSON.stringify({
            paymentMethodId: id,
            brand: paymentMethod.card?.brand,
            last4: paymentMethod.card?.last4,
          }),
        },
      })

      logger.info(`Default payment method changed for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        message: "Default payment method updated successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  // Create checkout session
  async createCheckoutSession(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Validate request body
      const validatedData = changePlanSchema.parse(req.body)

      // Get pricing plan
      const plan = await prisma.pricingPlan.findUnique({
        where: { id: validatedData.planId },
      })

      if (!plan) {
        throw new ApiError(404, "Pricing plan not found")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: plan.stripePriceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${req.headers.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/billing/cancel`,
        customer: subscription?.customerId,
        customer_creation: subscription?.customerId ? undefined : "always",
        metadata: {
          tenantId: req.tenant.id,
          planId: validatedData.planId,
        },
      })

      // Log checkout session creation
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "checkout_session_created",
          performedBy: req.user?.id,
          details: JSON.stringify({
            sessionId: session.id,
            planId: validatedData.planId,
          }),
        },
      })

      logger.info(`Checkout session created for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        data: {
          sessionId: session.id,
          url: session.url,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Create customer portal session
  async createCustomerPortalSession(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription || !subscription.customerId) {
        throw new ApiError(404, "No billing setup found")
      }

      // Create customer portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: subscription.customerId,
        return_url: `${req.headers.origin}/billing`,
      })

      // Log customer portal session creation
      await prisma.billingAuditLog.create({
        data: {
          tenantId: req.tenant.id,
          action: "customer_portal_session_created",
          performedBy: req.user?.id,
          details: JSON.stringify({
            sessionId: session.id,
          }),
        },
      })

      logger.info(`Customer portal session created for tenant ${req.tenant.id}`)

      res.status(200).json({
        status: "success",
        data: {
          url: session.url,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}
