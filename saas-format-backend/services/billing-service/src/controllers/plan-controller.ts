import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"
import stripe from "../utils/stripe-client"
import { z } from "zod"

// Validation schemas
const createPlanSchema = z.object({
  name: z.string().min(2).max(50),
  displayName: z.string().min(2).max(100),
  description: z.string().optional(),
  price: z.number().min(0),
  currency: z.string().default("usd"),
  interval: z.enum(["month", "year"]).default("month"),
  features: z.array(z.string()),
  limits: z.record(z.number()),
  stripePriceId: z.string().optional(),
})

const updatePlanSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  currency: z.string().optional(),
  interval: z.enum(["month", "year"]).optional(),
  features: z.array(z.string()).optional(),
  limits: z.record(z.number()).optional(),
  isActive: z.boolean().optional(),
  stripePriceId: z.string().optional(),
})

export class PlanController {
  // Get all plans
  async getAllPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const plans = await prisma.pricingPlan.findMany({
        where: {
          isActive: true,
        },
        orderBy: {
          price: "asc",
        },
      })

      res.status(200).json({
        status: "success",
        results: plans.length,
        data: plans,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get plan by ID
  async getPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      const plan = await prisma.pricingPlan.findUnique({
        where: { id },
      })

      if (!plan) {
        throw new ApiError(404, "Plan not found")
      }

      res.status(200).json({
        status: "success",
        data: plan,
      })
    } catch (error) {
      next(error)
    }
  }

  // Create plan
  async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      // Validate request body
      const validatedData = createPlanSchema.parse(req.body)

      // Check if plan with name already exists
      const existingPlan = await prisma.pricingPlan.findUnique({
        where: { name: validatedData.name },
      })

      if (existingPlan) {
        throw new ApiError(400, "Plan with this name already exists")
      }

      let stripePriceId = validatedData.stripePriceId

      // If price > 0 and no stripePriceId provided, create price in Stripe
      if (validatedData.price > 0 && !stripePriceId) {
        // Create product in Stripe
        const product = await stripe.products.create({
          name: validatedData.displayName,
          description: validatedData.description,
          metadata: {
            plan_name: validatedData.name,
          },
        })

        // Create price in Stripe
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(validatedData.price * 100), // Convert to cents
          currency: validatedData.currency,
          recurring: {
            interval: validatedData.interval,
          },
          metadata: {
            plan_name: validatedData.name,
          },
        })

        stripePriceId = price.id
      }

      // Create plan
      const plan = await prisma.pricingPlan.create({
        data: {
          name: validatedData.name,
          displayName: validatedData.displayName,
          description: validatedData.description,
          price: validatedData.price,
          currency: validatedData.currency,
          interval: validatedData.interval,
          features: validatedData.features,
          limits: validatedData.limits,
          stripePriceId,
        },
      })

      logger.info(`Plan created: ${plan.id} (${plan.name})`)

      res.status(201).json({
        status: "success",
        data: plan,
      })
    } catch (error) {
      next(error)
    }
  }

  // Update plan
  async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Validate request body
      const validatedData = updatePlanSchema.parse(req.body)

      // Check if plan exists
      const existingPlan = await prisma.pricingPlan.findUnique({
        where: { id },
      })

      if (!existingPlan) {
        throw new ApiError(404, "Plan not found")
      }

      // If price is changing and plan is paid, create new price in Stripe
      let stripePriceId = existingPlan.stripePriceId

      if (
        validatedData.price !== undefined &&
        validatedData.price > 0 &&
        validatedData.price !== existingPlan.price &&
        !validatedData.stripePriceId
      ) {
        // Get or create product in Stripe
        let productId

        if (stripePriceId) {
          // Get existing price to find product
          const existingPrice = await stripe.prices.retrieve(stripePriceId)
          productId = existingPrice.product as string
        } else {
          // Create new product
          const product = await stripe.products.create({
            name: validatedData.displayName || existingPlan.displayName,
            description: validatedData.description || existingPlan.description,
            metadata: {
              plan_name: existingPlan.name,
            },
          })
          productId = product.id
        }

        // Create new price in Stripe
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: Math.round(validatedData.price * 100), // Convert to cents
          currency: validatedData.currency || existingPlan.currency,
          recurring: {
            interval: validatedData.interval || existingPlan.interval,
          },
          metadata: {
            plan_name: existingPlan.name,
          },
        })

        stripePriceId = price.id
      }

      // Update plan
      const updatedPlan = await prisma.pricingPlan.update({
        where: { id },
        data: {
          ...validatedData,
          stripePriceId: validatedData.stripePriceId || stripePriceId,
        },
      })

      logger.info(`Plan updated: ${updatedPlan.id} (${updatedPlan.name})`)

      res.status(200).json({
        status: "success",
        data: updatedPlan,
      })
    } catch (error) {
      next(error)
    }
  }

  // Delete plan
  async deletePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params

      // Check if plan exists
      const existingPlan = await prisma.pricingPlan.findUnique({
        where: { id },
      })

      if (!existingPlan) {
        throw new ApiError(404, "Plan not found")
      }

      // Check if plan is in use
      const subscriptionsUsingPlan = await prisma.subscription.count({
        where: {
          plan: existingPlan.name,
          status: {
            in: ["active", "trialing"],
          },
        },
      })

      if (subscriptionsUsingPlan > 0) {
        throw new ApiError(400, "Cannot delete plan that is in use by active subscriptions")
      }

      // Instead of deleting, mark as inactive
      const updatedPlan = await prisma.pricingPlan.update({
        where: { id },
        data: {
          isActive: false,
        },
      })

      // If there's a Stripe price ID, archive the price in Stripe
      if (existingPlan.stripePriceId) {
        try {
          // Get the product ID from the price
          const price = await stripe.prices.retrieve(existingPlan.stripePriceId)
          const productId = price.product as string

          // Archive the price
          await stripe.prices.update(existingPlan.stripePriceId, {
            active: false,
          })

          // Archive the product
          await stripe.products.update(productId, {
            active: false,
          })
        } catch (stripeError) {
          logger.error(
            `Error archiving Stripe price: ${stripeError instanceof Error ? stripeError.message : String(stripeError)}`,
          )
          // Continue with the deletion even if Stripe operations fail
        }
      }

      logger.info(`Plan deleted (marked inactive): ${id} (${existingPlan.name})`)

      res.status(200).json({
        status: "success",
        data: updatedPlan,
      })
    } catch (error) {
      next(error)
    }
  }
}
