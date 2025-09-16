import express from "express"
import { UsageController } from "../controllers/usage-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const usageController = new UsageController()

// Record usage
router.post("/record", usageController.recordUsage)

// Get usage for current tenant
router.get("/", usageController.getUsage)

// Get usage summary
router.get("/summary", usageController.getUsageSummary)

// Admin-only routes
router.get("/:tenantId", authorize(["super_admin"]), usageController.getTenantUsage)

export default router
