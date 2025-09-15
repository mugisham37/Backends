import { Router } from "express"
import { VersioningController } from "../../../controllers/versioning.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { versioningValidation } from "../../../validations/versioning.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"
import { createAuditMiddleware } from "../../../middleware/audit.middleware"

const router = Router()
const versioningController = new VersioningController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get all versions of a content
router.get("/content/:contentId", requireRoles(["admin", "editor", "author"]), versioningController.getContentVersions)

// Get the latest version of a content
router.get(
  "/content/:contentId/latest",
  requireRoles(["admin", "editor", "author"]),
  versioningController.getLatestVersion,
)

// Get a specific version of a content
router.get(
  "/content/:contentId/version/:version",
  requireRoles(["admin", "editor", "author"]),
  versioningController.getContentVersion,
)

// Create a new version
router.post(
  "/content/:contentId",
  requireRoles(["admin", "editor", "author"]),
  validateRequest(versioningValidation.createVersion),
  createAuditMiddleware({
    action: "version.create",
    entityType: "content",
    getEntityId: (req) => req.params.contentId,
  }),
  versioningController.createVersion,
)

// Publish a version
router.post(
  "/content/:contentId/version/:version/publish",
  requireRoles(["admin", "editor"]),
  createAuditMiddleware({
    action: "version.publish",
    entityType: "content",
    getEntityId: (req) => req.params.contentId,
  }),
  versioningController.publishVersion,
)

// Revert to a version
router.post(
  "/content/:contentId/version/:version/revert",
  requireRoles(["admin", "editor", "author"]),
  validateRequest(versioningValidation.revertToVersion),
  createAuditMiddleware({
    action: "version.revert",
    entityType: "content",
    getEntityId: (req) => req.params.contentId,
  }),
  versioningController.revertToVersion,
)

// Compare versions
router.get(
  "/content/:contentId/compare",
  requireRoles(["admin", "editor", "author"]),
  versioningController.compareVersions,
)

// Delete a version
router.delete(
  "/content/:contentId/version/:version",
  requireRoles(["admin"]),
  createAuditMiddleware({
    action: "version.delete",
    entityType: "content",
    getEntityId: (req) => req.params.contentId,
  }),
  versioningController.deleteVersion,
)

export const versioningRoutes = router
