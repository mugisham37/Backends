import { Router } from "express"
import { I18nController } from "../../../controllers/i18n.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { i18nValidation } from "../../../validations/i18n.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"
import { UserRole } from "../../../db/models/user.model"
import multer from "multer"

// Configure multer for file uploads
const upload = multer({
  dest: "temp/uploads/",
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only JSON files
    if (file.mimetype === "application/json") {
      cb(null, true)
    } else {
      cb(new Error("Only JSON files are allowed"))
    }
  },
})

const router = Router()
const i18nController = new I18nController()

// Public routes (no authentication required)
router.get("/locales", i18nController.getLocales)
router.get("/namespaces", i18nController.getNamespaces)
router.get("/translations/:locale/:namespace", i18nController.getTranslations)
router.post("/translate", validateRequest(i18nValidation.translate), i18nController.translate)

// Protected routes (authentication required)
router.use(authMiddleware, requireAuth)

// Routes for editors and admins
router.use(requireRoles([UserRole.ADMIN, UserRole.EDITOR]))

router.post("/translations", validateRequest(i18nValidation.upsertTranslation), i18nController.upsertTranslation)

router.post("/import", validateRequest(i18nValidation.importTranslations), i18nController.importTranslations)

router.post(
  "/import/file",
  upload.single("file"),
  validateRequest(i18nValidation.importTranslationsFromFile),
  i18nController.importTranslationsFromFile,
)

router.get("/export/:locale/:namespace", i18nController.exportTranslations)
router.get("/export/file/:locale/:namespace", i18nController.exportTranslationsToFile)

// Admin-only routes
router.use(requireRoles([UserRole.ADMIN]))

router.delete("/translations/:id", i18nController.deleteTranslation)
router.post("/default-locale", validateRequest(i18nValidation.setDefaultLocale), i18nController.setDefaultLocale)
router.post("/clear-cache", i18nController.clearCache)

export const i18nRoutes = router
