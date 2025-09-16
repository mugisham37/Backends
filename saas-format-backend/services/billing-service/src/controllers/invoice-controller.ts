import type { Request, Response, NextFunction } from "express"
import { prisma } from "../utils/prisma"
import { ApiError } from "../utils/api-error"

export class InvoiceController {
  // Get invoices for current tenant
  async getInvoices(req: Request, res: Response, next: NextFunction) {
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

      // Get invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          subscriptionId: subscription.id,
        },
        orderBy: {
          invoiceDate: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: invoices.length,
        data: invoices,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get invoice by ID
  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.tenant) {
        throw new ApiError(400, "Tenant is required")
      }

      const { id } = req.params

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId: req.tenant.id },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // Get invoice
      const invoice = await prisma.invoice.findFirst({
        where: {
          id,
          subscriptionId: subscription.id,
        },
      })

      if (!invoice) {
        throw new ApiError(404, "Invoice not found")
      }

      res.status(200).json({
        status: "success",
        data: invoice,
      })
    } catch (error) {
      next(error)
    }
  }

  // Get tenant invoices (admin only)
  async getTenantInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const { tenantId } = req.params

      // Check if subscription exists
      const subscription = await prisma.subscription.findUnique({
        where: { tenantId },
      })

      if (!subscription) {
        throw new ApiError(404, "Subscription not found")
      }

      // Get invoices
      const invoices = await prisma.invoice.findMany({
        where: {
          subscriptionId: subscription.id,
        },
        orderBy: {
          invoiceDate: "desc",
        },
      })

      res.status(200).json({
        status: "success",
        results: invoices.length,
        data: invoices,
      })
    } catch (error) {
      next(error)
    }
  }
}
