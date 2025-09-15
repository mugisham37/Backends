import { Router } from "express"
import { AuditController } from "../../../controllers/audit.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { auditValidation } from "../../../validations/audit.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const auditController = new AuditController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Only admins can access audit logs
router.use(requireRoles(["admin"]))

// Get audit logs
router.get("/", auditController.getAuditLogs)

// Get recent audit logs
router.get("/recent", auditController.getRecentAuditLogs)

// Get entity audit logs
router.get("/entity/:entityType/:entityId", auditController.getEntityAuditLogs)

// Get user audit logs
router.get("/user/:userId", auditController.getUserAuditLogs)

// Delete old audit logs
router.delete("/", validateRequest(auditValidation.deleteOldAuditLogs), auditController.deleteOldAuditLogs)

export const auditRoutes = router
