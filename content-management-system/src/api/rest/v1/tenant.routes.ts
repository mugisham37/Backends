import { Router } from "express"
import { TenantController } from "../../../controllers/tenant.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { tenantValidation } from "../../../validations/tenant.validation"
import { authMiddleware, requireAuth } from "../../../middleware/auth"

const router = Router()
const tenantController = new TenantController()

// Apply authentication middleware to all tenant routes
router.use(authMiddleware, requireAuth)

// Create a new tenant
router.post("/", validateRequest(tenantValidation.createTenant), tenantController.createTenant)

// Get tenant by ID
router.get("/:id", validateRequest(tenantValidation.getTenant), tenantController.getTenantById)

// Update tenant
router.patch("/:id", validateRequest(tenantValidation.updateTenant), tenantController.updateTenant)

// Delete tenant
router.delete("/:id", validateRequest(tenantValidation.deleteTenant), tenantController.deleteTenant)

// List tenants
router.get("/", validateRequest(tenantValidation.listTenants), tenantController.listTenants)

// Get user tenants
router.get("/user/me", tenantController.getUserTenants)

// Add user to tenant
router.post("/:id/users", validateRequest(tenantValidation.addUserToTenant), tenantController.addUserToTenant)

// Update user role in tenant
router.patch(
  "/:id/users/:userId/role",
  validateRequest(tenantValidation.updateUserRole),
  tenantController.updateUserRole,
)

// Remove user from tenant
router.delete(
  "/:id/users/:userId",
  validateRequest(tenantValidation.removeUserFromTenant),
  tenantController.removeUserFromTenant,
)

// Update tenant plan
router.patch("/:id/plan", validateRequest(tenantValidation.updateTenantPlan), tenantController.updateTenantPlan)

// Update tenant status
router.patch("/:id/status", validateRequest(tenantValidation.updateTenantStatus), tenantController.updateTenantStatus)

// Get tenant usage
router.get("/:id/usage", validateRequest(tenantValidation.getTenant), tenantController.getTenantUsage)

export const tenantRoutes = router
