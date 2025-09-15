import { Router } from "express"
import { ContentController } from "../../../controllers/content.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { contentValidation } from "../../../validations/content.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const contentController = new ContentController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get all content
router.get("/", contentController.getAllContent)

// Get content by ID
router.get("/:id", contentController.getContentById)

// Get content by slug
router.get("/by-slug/:contentTypeId/:slug", contentController.getContentBySlug)

// Create content
router.post("/", validateRequest(contentValidation.createContent), contentController.createContent)

// Update content
router.put("/:id", validateRequest(contentValidation.updateContent), contentController.updateContent)

// Delete content (admin, editor, and author only)
router.delete("/:id", requireRoles(["admin", "editor", "author"]), contentController.deleteContent)

// Publish content (admin, editor, and author only)
router.post(
  "/:id/publish",
  requireRoles(["admin", "editor", "author"]),
  validateRequest(contentValidation.publishContent),
  contentController.publishContent,
)

// Unpublish content (admin, editor, and author only)
router.post("/:id/unpublish", requireRoles(["admin", "editor", "author"]), contentController.unpublishContent)

// Archive content (admin, editor, and author only)
router.post("/:id/archive", requireRoles(["admin", "editor", "author"]), contentController.archiveContent)

// Get content version
router.get("/:contentId/versions/:versionId", contentController.getContentVersion)

// Restore content version (admin, editor, and author only)
router.post(
  "/:contentId/versions/:versionId/restore",
  requireRoles(["admin", "editor", "author"]),
  contentController.restoreVersion,
)

export const contentRoutes = router
