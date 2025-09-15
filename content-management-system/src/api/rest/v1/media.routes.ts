import { Router } from "express"
import { MediaController } from "../../../controllers/media.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { mediaValidation } from "../../../validations/media.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const mediaController = new MediaController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get all media
router.get("/", mediaController.getAllMedia)

// Get media by ID
router.get("/:id", mediaController.getMediaById)

// Upload media
router.post(
  "/upload",
  mediaController.uploadMedia, // This middleware handles file upload and validation
)

// Update media
router.put("/:id", validateRequest(mediaValidation.updateMedia), mediaController.updateMedia)

// Delete media (admin, editor, and author only)
router.delete("/:id", requireRoles(["admin", "editor", "author"]), mediaController.deleteMedia)

// Create folder
router.post("/folders", validateRequest(mediaValidation.createFolder), mediaController.createFolder)

// Delete folder (admin, editor, and author only)
router.delete("/folders/:path(*)", requireRoles(["admin", "editor", "author"]), mediaController.deleteFolder)

// List folders
router.get("/folders", mediaController.listFolders)

export const mediaRoutes = router
