import express from "express"
import { TenantController } from "../controllers/tenant-controller"
import { authMiddleware, authorize } from "../middleware/auth-middleware"

const router = express.Router()
const tenantController = new TenantController()

// Public routes
router.post("/", tenantController.createTenant)

// Protected routes
router.use(authMiddleware)

// Admin-only routes
router.get("/", authorize(["admin", "super_admin"]), tenantController.getAllTenants)

// Tenant-specific routes (tenant admins and super admins)
router.get("/:id", authorize(["tenant_admin", "super_admin"]), tenantController.getTenantById)
router.put("/:id", authorize(["tenant_admin", "super_admin"]), tenantController.updateTenant)
router.delete("/:id", authorize(["super_admin"]), tenantController.deleteTenant)

// Tenant settings
router.get("/:id/settings", authorize(["tenant_admin", "super_admin"]), tenantController.getTenantSettings)
router.put("/:id/settings", authorize(["tenant_admin", "super_admin"]), tenantController.updateTenantSettings)

export default router
