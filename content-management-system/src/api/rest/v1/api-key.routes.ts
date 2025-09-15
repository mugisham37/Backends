import { Router } from "express"
import { ApiKeyController } from "../../../controllers/api-key.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { apiKeyValidation } from "../../../validations/api-key.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"
import { UserRole } from "../../../db/models/user.model"

const router = Router()
const apiKeyController = new ApiKeyController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Create a new API key
router.post(
  "/",
  requireRoles([UserRole.ADMIN]),
  validateRequest(apiKeyValidation.createApiKey),
  apiKeyController.createApiKey,
)

// Get all API keys
router.get("/", requireRoles([UserRole.ADMIN]), apiKeyController.getAllApiKeys)

// Get API key by ID
router.get(
  "/:id",
  requireRoles([UserRole.ADMIN]),
  validateRequest(apiKeyValidation.getApiKey),
  apiKeyController.getApiKeyById,
)

// Update API key
router.patch(
  "/:id",
  requireRoles([UserRole.ADMIN]),
  validateRequest(apiKeyValidation.updateApiKey),
  apiKeyController.updateApiKey,
)

// Delete API key
router.delete(
  "/:id",
  requireRoles([UserRole.ADMIN]),
  validateRequest(apiKeyValidation.deleteApiKey),
  apiKeyController.deleteApiKey,
)

// Regenerate API key
router.post(
  "/:id/regenerate",
  requireRoles([UserRole.ADMIN]),
  validateRequest(apiKeyValidation.regenerateApiKey),
  apiKeyController.regenerateApiKey,
)

export const apiKeyRoutes = router
