import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { logger } from "../utils/logger"
import stripe from "../utils/stripe-client"
import { sendMessage } from "../utils/kafka-client"

export class WebhookController {
  // Handle Stripe webhook
  async handleWebhook(req: Request, res: Response, next: NextFunction) {
    const sig = req.headers["stripe-signature"]

    if (!sig) {
      return res.status(400).send("Missing stripe-signature header")
    }

    try {
      // Verify webhook signature
      const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET || "")

      // Handle different event types
      switch (event.type) {
        case "checkout.session.completed":
          await this.handleCheckoutSessionCompleted(event.data.object)
          break

        case "customer.subscription.created":
          await this.handleSubscriptionCreated(event.data.object)
          break

        case "customer.subscription.updated":
          await this.handleSubscriptionUpdated(event.data.object)
          break

        case "customer.subscription.deleted":
          await this.handleSubscriptionDeleted(event.data.object)
          break

        case "invoice.payment_succeeded":
          await this.handleInvoicePaymentSucceeded(event.data.object)
          break

        case "invoice.payment_failed":
          await this.handleInvoicePaymentFailed(event.data.object)
          break

        default:
          logger.info(`Unhandled event type: ${event.type}`)
      }

      res.status(200).json({ received: true })
    } catch (error) {
      logger.error(`Webhook error: ${error instanceof Error ? error.message : String(error)}`)
      return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Handle checkout.session.completed event
  private async handleCheckoutSessionCompleted(session: any) {
    try {
      const { tenantId, planId } = session.metadata || {}

      if (!tenantId || !planId) {
        logger.error("Missing tenantId or planId in session metadata")
        return
      }

      // Get plan details
      const plan = await prisma.pricingPlan.findUnique({
        where: { id: planId },
      })

      if (!plan) {
        logger.error(`Plan not found: ${planId}`)
        return
      }

      // Check if subscription already exists
      const existingSubscription = await prisma.subscription.findUnique({
        where: { tenantId },
      })

      // Get subscription ID from session
      const subscriptionId = session.subscription

      // Get subscription details from Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId)

      // Create or update subscription
      const subscription = existingSubscription
        ? await prisma.subscription.update({
            where: { tenantId },
            data: {
              plan: plan.name,
              status: stripeSubscription.status,
              startDate: new Date(stripeSubscription.current_period_start * 1000),
              endDate: new Date(stripeSubscription.current_period_end * 1000),
              customerId: session.customer,
              subscriptionId,
              canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            },
          })
        : await prisma.subscription.create({
            data: {
              tenantId,
              plan: plan.name,
              status: stripeSubscription.status,
              startDate: new Date(stripeSubscription.current_period_start * 1000),
              endDate: new Date(stripeSubscription.current_period_end * 1000),
              customerId: session.customer,
              subscriptionId,
              canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            },
          })

      // Log checkout completion
      await prisma.billingAuditLog.create({
        data: {
          tenantId,
          action: "checkout_completed",
          details: JSON.stringify({
            sessionId: session.id,
            planId,
            plan: plan.name,
            subscriptionId,
            status: stripeSubscription.status,
          }),
        },
      })

      // Publish subscription event
      await sendMessage("billing-events", {
        type: existingSubscription ? "SUBSCRIPTION_UPDATED" : "SUBSCRIPTION_CREATED",
        data: {
          tenantId,
          plan: plan.name,
          status: stripeSubscription.status,
          startDate: subscription.startDate,
          endDate: subscription.endDate,
        },
      })

      logger.info(`Checkout completed for tenant ${tenantId}, subscribed to ${plan.name} plan`)
    } catch (error) {
      logger.error(
        `Error handling checkout.session.completed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Handle customer.subscription.created event
  private async handleSubscriptionCreated(subscription: any) {
    try {
      const { tenantId } = subscription.metadata || {}

      if (!tenantId) {
        logger.error("Missing tenantId in subscription metadata")
        return
      }

      // Get plan name from Stripe product
      const priceId = subscription.items.data[0].price.id
      const price = await stripe.prices.retrieve(priceId)
      const productId = price.product as string
      const product = await stripe.products.retrieve(productId)
      const planName = product.metadata.plan_name

      if (!planName) {
        logger.error(`Missing plan_name in product metadata for product ${productId}`)
        return
      }

      // Check if subscription already exists in our database
      const existingSubscription = await prisma.subscription.findUnique({
        where: { tenantId },
      })

      if (existingSubscription) {
        // Update existing subscription
        await prisma.subscription.update({
          where: { tenantId },
          data: {
            plan: planName,
            status: subscription.status,
            startDate: new Date(subscription.current_period_start * 1000),
            endDate: new Date(subscription.current_period_end * 1000),
            customerId: subscription.customer,
            subscriptionId: subscription.id,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          },
        })
      } else {
        // Create new subscription
        await prisma.subscription.create({
          data: {
            tenantId,
            plan: planName,
            status: subscription.status,
            startDate: new Date(subscription.current_period_start * 1000),
            endDate: new Date(subscription.current_period_end * 1000),
            customerId: subscription.customer,
            subscriptionId: subscription.id,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
          },
        })
      }

      // Log subscription creation
      await prisma.billingAuditLog.create({
        data: {
          tenantId,
          action: "subscription_created",
          details: JSON.stringify({
            subscriptionId: subscription.id,
            plan: planName,
            status: subscription.status,
          }),
        },
      })

      // Publish subscription created event
      await sendMessage("billing-events", {
        type: "SUBSCRIPTION_CREATED",
        data: {
          tenantId,
          plan: planName,
          status: subscription.status,
          startDate: new Date(subscription.current_period_start * 1000),
          endDate: new Date(subscription.current_period_end * 1000),
        },
      })

      logger.info(`Subscription created for tenant ${tenantId}, plan ${planName}`)
    } catch (error) {
      logger.error(
        `Error handling customer.subscription.created: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Handle customer.subscription.updated event
  private async handleSubscriptionUpdated(subscription: any) {
    try {
      // Find subscription by Stripe subscription ID
      const existingSubscription = await prisma.subscription.findFirst({
        where: { subscriptionId: subscription.id },
      })

      if (!existingSubscription) {
        logger.error(`Subscription not found for Stripe subscription ID: ${subscription.id}`)
        return
      }

      const tenantId = existingSubscription.tenantId

      // Get plan name from Stripe product
      const priceId = subscription.items.data[0].price.id
      const price = await stripe.prices.retrieve(priceId)
      const productId = price.product as string
      const product = await stripe.products.retrieve(productId)
      const planName = product.metadata.plan_name

      if (!planName) {
        logger.error(`Missing plan_name in product metadata for product ${productId}`)
        return
      }

      // Update subscription
      await prisma.subscription.update({
        where: { tenantId },
        data: {
          plan: planName,
          status: subscription.status,
          startDate: new Date(subscription.current_period_start * 1000),
          endDate: new Date(subscription.current_period_end * 1000),
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        },
      })

      // Log subscription update
      await prisma.billingAuditLog.create({
        data: {
          tenantId,
          action: "subscription_updated",
          details: JSON.stringify({
            subscriptionId: subscription.id,
            plan: planName,
            status: subscription.status,
            canceledAt: subscription.canceled_at,
          }),
        },
      })

      // Publish subscription updated event
      await sendMessage("billing-events", {
        type: "SUBSCRIPTION_UPDATED",
        data: {
          tenantId,
          plan: planName,
          status: subscription.status,
          startDate: new Date(subscription.current_period_start * 1000),
          endDate: new Date(subscription.current_period_end * 1000),
          canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        },
      })

      logger.info(`Subscription updated for tenant ${tenantId}, plan ${planName}, status ${subscription.status}`)
    } catch (error) {
      logger.error(
        `Error handling customer.subscription.updated: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Handle customer.subscription.deleted event
  private async handleSubscriptionDeleted(subscription: any) {
    try {
      // Find subscription by Stripe subscription ID
      const existingSubscription = await prisma.subscription.findFirst({
        where: { subscriptionId: subscription.id },
      })

      if (!existingSubscription) {
        logger.error(`Subscription not found for Stripe subscription ID: ${subscription.id}`)
        return
      }

      const tenantId = existingSubscription.tenantId

      // Update subscription status
      await prisma.subscription.update({
        where: { tenantId },
        data: {
          status: "canceled",
          canceledAt: new Date(),
        },
      })

      // Log subscription deletion
      await prisma.billingAuditLog.create({
        data: {
          tenantId,
          action: "subscription_deleted",
          details: JSON.stringify({
            subscriptionId: subscription.id,
            status: "canceled",
          }),
        },
      })

      // Publish subscription canceled event
      await sendMessage("billing-events", {
        type: "SUBSCRIPTION_CANCELED",
        data: {
          tenantId,
          plan: existingSubscription.plan,
          canceledAt: new Date(),
        },
      })

      logger.info(`Subscription deleted for tenant ${tenantId}`)
    } catch (error) {
      logger.error(
        `Error handling customer.subscription.deleted: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Handle invoice.payment_succeeded event
  private async handleInvoicePaymentSucceeded(invoice: any) {
    try {
      // Find subscription by Stripe subscription ID
      if (!invoice.subscription) {
        logger.info("Invoice is not associated with a subscription, skipping")
        return
      }

      const existingSubscription = await prisma.subscription.findFirst({
        where: { subscriptionId: invoice.subscription },
      })

      if (!existingSubscription) {
        logger.error(`Subscription not found for Stripe subscription ID: ${invoice.subscription}`)
        return
      }

      const tenantId = existingSubscription.tenantId

      // Create invoice record
      await prisma.invoice.create({
        data: {
          subscriptionId: existingSubscription.id,
          amount: invoice.amount_paid / 100, // Convert from cents
          currency: invoice.currency,
          status: invoice.status,
          invoiceDate: new Date(invoice.created * 1000),
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          paidAt: invoice.status === "paid" ? new Date(invoice.status_transitions.paid_at * 1000) : null,
          stripeInvoiceId: invoice.id,
        },
      })

      // Log invoice payment
      await prisma.billingAuditLog.create({
        data: {
          tenantId,
          action: "invoice_payment_succeeded",
          details: JSON.stringify({
            invoiceId: invoice.id,
            amount: invoice.amount_paid / 100,
            currency: invoice.currency,
          }),
        },
      })

      logger.info(
        `Invoice payment succeeded for tenant ${tenantId}, amount ${invoice.amount_paid / 100} ${invoice.currency}`,
      )
    } catch (error) {
      logger.error(
        `Error handling invoice.payment_succeeded: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  // Handle invoice.payment_failed event
  private async handleInvoicePaymentFailed(invoice: any) {
    try {
      // Find subscription by Stripe subscription ID
      if (!invoice.subscription) {
        logger.info("Invoice is not associated with a subscription, skipping")
        return
      }

      const existingSubscription = await prisma.subscription.findFirst({
        where: { subscriptionId: invoice.subscription },
      })

      if (!existingSubscription) {
        logger.error(`Subscription not found for Stripe subscription ID: ${invoice.subscription}`)
        return
      }

      const tenantId = existingSubscription.tenantId

      // Create invoice record
      await prisma.invoice.create({
        data: {
          subscriptionId: existingSubscription.id,
          amount: invoice.amount_due / 100, // Convert from cents
          currency: invoice.currency,
          status: invoice.status,
          invoiceDate: new Date(invoice.created * 1000),
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          stripeInvoiceId: invoice.id,
        },
      })

      // Log invoice payment failure
      await prisma.billingAuditLog.create({
        data: {
          tenantId,
          action: "invoice_payment_failed",
          details: JSON.stringify({
            invoiceId: invoice.id,
            amount: invoice.amount_due / 100,
            currency: invoice.currency,
            attemptCount: invoice.attempt_count,
          }),
        },
      })

      // Publish payment failed event
      await sendMessage("billing-events", {
        type: "PAYMENT_FAILED",
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount: invoice.amount_due / 100,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count,
        },
      })

      logger.info(
        `Invoice payment failed for tenant ${tenantId}, amount ${invoice.amount_due / 100} ${invoice.currency}`,
      )
    } catch (error) {
      logger.error(`Error handling invoice.payment_failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}
