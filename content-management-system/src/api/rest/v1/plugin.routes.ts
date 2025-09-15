import { Router } from "express"
import { PluginController } from "../../../controllers/plugin.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { pluginValidation } from "../../../validations/plugin.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"
import { UserRole } from "../../../db/models/user.model"

const router = Router()
const pluginController = new PluginController()

// Apply authentication middleware to all plugin routes
router.use(authMiddleware, requireAuth)

// Only admins can manage plugins
router.use(requireRoles([UserRole.ADMIN]))

// Install a plugin
router.post("/", validateRequest(pluginValidation.installPlugin), pluginController.installPlugin)

// Uninstall a plugin
router.delete("/:id", validateRequest(pluginValidation.getPlugin), pluginController.uninstallPlugin)

// Enable a plugin
router.post("/:id/enable", validateRequest(pluginValidation.getPlugin), pluginController.enablePlugin)

// Disable a plugin
router.post("/:id/disable", validateRequest(pluginValidation.getPlugin), pluginController.disablePlugin)

// Update a plugin
router.patch("/:id", validateRequest(pluginValidation.updatePlugin), pluginController.updatePlugin)

// Get plugin by ID
router.get("/:id", validateRequest(pluginValidation.getPlugin), pluginController.getPluginById)

// List plugins
router.get("/", validateRequest(pluginValidation.listPlugins), pluginController.listPlugins)

// Execute plugin hook
router.post("/hooks/:hook", validateRequest(pluginValidation.executeHook), pluginController.executeHook)

export const pluginRoutes = router
