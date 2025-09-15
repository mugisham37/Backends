import { Router } from "express"
import { ApiGatewayController } from "../../../controllers/api-gateway.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { apiGatewayValidation } from "../../../validations/api-gateway.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"
import { UserRole } from "../../../db/models/user.model"

const router = Router()
const apiGatewayController = new ApiGatewayController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Admin-only routes
router.use(requireRoles([UserRole.ADMIN]))

// Create a new route
router.post("/routes", validateRequest(apiGatewayValidation.createRoute), apiGatewayController.createRoute)

// Update a route
router.put("/routes/:id", validateRequest(apiGatewayValidation.updateRoute), apiGatewayController.updateRoute)

// Delete a route
router.delete("/routes/:id", validateRequest(apiGatewayValidation.getRoute), apiGatewayController.deleteRoute)

// Get a route by ID
router.get("/routes/:id", validateRequest(apiGatewayValidation.getRoute), apiGatewayController.getRouteById)

// List routes
router.get("/routes", validateRequest(apiGatewayValidation.listRoutes), apiGatewayController.listRoutes)

// Clear cache
router.post("/cache/clear", apiGatewayController.clearCache)

// Reload routes
router.post("/routes/reload", apiGatewayController.reloadRoutes)

export const apiGatewayRoutes = router
