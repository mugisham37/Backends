import express from "express"
import { InvoiceController } from "../controllers/invoice-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const invoiceController = new InvoiceController()

// Get invoices for current tenant
router.get("/", invoiceController.getInvoices)

// Get invoice by ID
router.get("/:id", invoiceController.getInvoiceById)

// Admin-only routes
router.get("/tenant/:tenantId", authorize(["super_admin"]), invoiceController.getTenantInvoices)

export default router
