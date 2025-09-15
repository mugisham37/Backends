import { Router } from "express"
import { MonitoringController } from "../../../controllers/monitoring.controller"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const monitoringController = new MonitoringController()

// Simple health check (public)
router.get("/health", monitoringController.healthCheck)

// Detailed health status (authenticated)
router.get("/health/status", authMiddleware, requireAuth, monitoringController.getHealthStatus)

// System metrics (admin only)
router.get("/metrics/system", authMiddleware, requireRoles(["admin"]), monitoringController.getMetrics)

// Application metrics (admin only)
router.get("/metrics/application", authMiddleware, requireRoles(["admin"]), monitoringController.getApplicationMetrics)

export const monitoringRoutes = router
