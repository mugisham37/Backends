import { Router } from "express"
import { MigrationController } from "../../../controllers/migration.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { migrationValidation } from "../../../validations/migration.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const migrationController = new MigrationController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Only admins can access migration routes
router.use(requireRoles(["admin"]))

// Initialize migrations
router.post("/initialize", migrationController.initializeMigrations)

// Export data
router.get("/export", migrationController.exportData)

// Import data
router.post("/import", validateRequest(migrationValidation.importData), migrationController.importData)

// Create migration
router.post("/create", validateRequest(migrationValidation.createMigration), migrationController.createMigration)

// Run migrations
router.post("/run", validateRequest(migrationValidation.runMigrations), migrationController.runMigrations)

export const migrationRoutes = router
