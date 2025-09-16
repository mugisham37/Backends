import express from "express"
import * as vendorDashboardController from "../controllers/vendor-dashboard.controller"
import { protect, restrictTo } from "../middleware/auth.middleware"

const router = express.Router()

// Protected admin routes
router.use(protect)
router.use(restrictTo("admin"))

router.get("/vendors/:vendorId/dashboard", vendorDashboardController.getVendorDashboardSummaryAdmin)

export default router
