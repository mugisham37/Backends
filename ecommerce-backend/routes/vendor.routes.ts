import { Router } from "express";
import * as vendorController from "../controllers/vendor.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validateRequest } from "../middleware/validation.middleware";
import { vendorValidation } from "../validations/vendor.validation";

const router = Router();

// Public routes
router.get("/slug/:slug", vendorController.getVendorBySlug);
router.get("/:id/products", vendorController.getVendorProducts);

// Admin routes
router
  .route("/")
  .get(authenticate, authorize(["admin", "superadmin"]), vendorController.getAllVendors)
  .post(
    authenticate,
    authorize(["admin", "superadmin"]),
    validateRequest(vendorValidation.createVendor),
    vendorController.createVendor
  );

router
  .route("/:id")
  .get(authenticate, authorize(["admin", "superadmin", "vendor"]), vendorController.getVendorById)
  .put(
    authenticate,
    authorize(["admin", "superadmin", "vendor"]),
    validateRequest(vendorValidation.updateVendor),
    vendorController.updateVendor
  )
  .delete(authenticate, authorize(["admin", "superadmin"]), vendorController.deleteVendor);

// Vendor status
router.patch(
  "/:id/status",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(vendorValidation.updateVendorStatus),
  vendorController.updateVendorStatus
);

// Vendor metrics
router.get(
  "/:id/metrics",
  authenticate,
  authorize(["admin", "superadmin", "vendor"]),
  vendorController.getVendorMetrics
);

// Vendor payouts
router.get(
  "/:id/payouts",
  authenticate,
  authorize(["admin", "superadmin", "vendor"]),
  vendorController.getVendorPayouts
);

router.post(
  "/:id/calculate-payout",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(vendorValidation.calculatePayout),
  vendorController.calculateVendorPayout
);

// Payout routes
router.post(
  "/payouts",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(vendorValidation.createPayout),
  vendorController.createVendorPayout
);

router.get(
  "/payouts/:id",
  authenticate,
  authorize(["admin", "superadmin", "vendor"]),
  vendorController.getPayoutById
);

router.patch(
  "/payouts/:id/status",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(vendorValidation.updatePayoutStatus),
  vendorController.updatePayoutStatus
);

export default router;
