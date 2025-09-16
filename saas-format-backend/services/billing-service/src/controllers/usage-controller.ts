import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import stripe from "../utils/stripe-client"
import { z } from "zod"

// Validation schemas
const recordUsageSchema = z.object({
  category: z.string(),
  quantity: z.number().positive(),
  tenantId: z.string().optional(), // Optional for admin usage
})

export class UsageController {
  // Record usage
  async recordUsage(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = recordUsageSchema.parse(req.body)

      // Get tenant ID from request or body
      const tenantId = validatedData.tenantId || req.tenant?.id

      if (!tenantId) {
        throw new ApiError(400, "Tenant ID is required")
      }

      // Check if user has permission to record usage for this tenant
      if (validatedData.tenantId && req.user?.role !== "super_admin") {
        throw new ApiError(403, "Insufficient permissions to record usage for other tenants")
      }

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // Record usage in database
      const usageRecord = await prisma.usageRecord.create({
        data: {
          subscriptionId: subscription.id,
          category: validatedData.category,
          quantity: validatedData.quantity,
        },
      })

      // If subscription has Stripe subscription ID and it's a metered billing plan,
      // report usage to Stripe
      if (subscription.subscriptionId) {
        try {
          // Get Stripe subscription
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.subscriptionId)

          // Find the subscription item for the given category
          const item = stripeSubscription.items.data.find((item) => {
            // This assumes you've set up your Stripe products with metadata to identify the category
            return item.price.metadata?.category === validatedData.category
          })

          if (item && item.price.recurring?.usage_type === "metered") {
            // Report usage to Stripe
            const stripeUsageRecord = await stripe.subscriptionItems.createUsageRecord(item.id, {
              quantity: Math.round(validatedData.quantity),
              timestamp: Math.floor(Date.now() / 1000),
              action: "increment",
            })

            // Update our usage record with Stripe ID
            await prisma.usageRecord.update({
              where: { id: usageRecord.id },
              data: {
                stripeUsageRecordId: stripeUsageRecord.id,
              },
            })
          }
        } catch (stripeError) {
          logger.error(
            `Error reporting usage to Stripe: ${stripeError instanceof Error ? stripeError.message : String(stripeError)}`,
          )
          // Continue even if Stripe reporting fails
        }
      }

      logger.info(
        `Usage recorded for tenant ${tenantId}, category ${validatedData.category}, quantity ${validatedData.quantity}`,
      )

      res.status(201).json({
        status: "success",
        data: usageRecord,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get usage for current tenant
  async getUsage(req: Request, res: Response, next: NextFunction) {
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

      // Get usage records
      const usageRecords = await prisma.usageRecord.findMany({
        where: {
          subscriptionId: subscription.id,
        },
        orderBy: {
          timestamp: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: usageRecords.length,
        data: usageRecords,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get usage summary
  async getUsageSummary(req: Request, res: Response, next: NextFunction) {
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

      // Get plan details to check limits
      const plan = await prisma.pricingPlan.findFirst({
        where: { name: subscription.plan },
      })

      if (!plan) {
        throw new ApiError(404, "Plan not found")
      }

      // Get current billing period
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

      // Get usage summary by category for current billing period
      const usageSummary = await prisma.$queryRaw`
        SELECT 
          category, 
          SUM(quantity) as total
        FROM "UsageRecord"
        WHERE 
          "subscriptionId" = ${subscription.id}
          AND "timestamp" >= ${startOfMonth}
          AND "timestamp" <= ${endOfMonth}
        GROUP BY category
      `

      // Format response with limits from plan
      const formattedSummary = Array.isArray(usageSummary)
        ? usageSummary.map((item: any) => ({
            category: item.category,
            total: Number(item.total),
            limit: plan.limits[item.category] || null,
            percentUsed: plan.limits[item.category] ? (Number(item.total) / plan.limits[item.category]) * 100 : null,
          }))
        : []

      res.status(200).json({
        status: "success",
        data: {
          summary: formattedSummary,
          billingPeriod: {
            start: startOfMonth,
            end: endOfMonth,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  // Get tenant usage (admin only)
  async getTenantUsage(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // Get usage records
      const usageRecords = await prisma.usageRecord.findMany({
        where: {
          subscriptionId: subscription.id,
        },
        orderBy: {
          timestamp: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: usageRecords.length,
        data: usageRecords,
      })
    } catch (error) {
      next(error)
    }
  }
}
