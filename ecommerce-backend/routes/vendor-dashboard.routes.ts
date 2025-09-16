import express from "express";
import * as vendorDashboardController from "../controllers/vendor-dashboard.controller";
import { protect } from "../middleware/auth.middleware";
import { isVendor } from "../middleware/vendor.middleware";

const router = express.Router();

// Protected vendor routes
router.use(protect);
router.use(isVendor);

router.get("/dashboard", vendorDashboardController.getVendorDashboardSummary);
router.get("/analytics/sales", vendorDashboardController.getVendorSalesAnalytics);
router.get("/analytics/products", vendorDashboardController.getVendorProductAnalytics);
router.get("/analytics/orders", vendorDashboardController.getVendorOrderAnalytics);
router.get("/analytics/payouts", vendorDashboardController.getVendorPayoutAnalytics);

export default router;
