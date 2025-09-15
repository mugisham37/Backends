import { Router } from "express"
import { ContentTypeController } from "../../../controllers/content-type.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { contentTypeValidation } from "../../../validations/content-type.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const contentTypeController = new ContentTypeController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get all content types
router.get("/", contentTypeController.getAllContentTypes)

// Get content type by ID
router.get("/:id", contentTypeController.getContentTypeById)

// Create content type (admin and editor only)
router.post(
  "/",
  requireRoles(["admin", "editor"]),
  validateRequest(contentTypeValidation.createContentType),
  contentTypeController.createContentType,
)

// Update content type (admin and editor only)
router.put(
  "/:id",
  requireRoles(["admin", "editor"]),
  validateRequest(contentTypeValidation.updateContentType),
  contentTypeController.updateContentType,
)

// Delete content type (admin only)
router.delete("/:id", requireRoles(["admin"]), contentTypeController.deleteContentType)

// Add field to content type (admin and editor only)
router.post(
  "/:id/fields",
  requireRoles(["admin", "editor"]),
  validateRequest(contentTypeValidation.addField),
  contentTypeController.addField,
)

// Update field in content type (admin and editor only)
router.put(
  "/:id/fields/:fieldId",
  requireRoles(["admin", "editor"]),
  validateRequest(contentTypeValidation.updateField),
  contentTypeController.updateField,
)

// Remove field from content type (admin and editor only)
router.delete("/:id/fields/:fieldId", requireRoles(["admin", "editor"]), contentTypeController.removeField)

export const contentTypeRoutes = router
