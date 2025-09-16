import { Router } from "express";
import * as abTestController from "../controllers/ab-test.controller";
import { authenticate } from "../middleware/auth.middleware";
import { authorize } from "../middleware/role.middleware";
import { validateRequest } from "../middleware/validation.middleware";
import { abTestValidation } from "../validations/ab-test.validation";

const router = Router();

// Admin routes
router
  .route("/")
  .get(authenticate, authorize(["admin", "superadmin"]), abTestController.getAllTests)
  .post(
    authenticate,
    authorize(["admin", "superadmin"]),
    validateRequest(abTestValidation.createTest),
    abTestController.createTest
  );

router
  .route("/:testId")
  .get(authenticate, authorize(["admin", "superadmin"]), abTestController.getTestById)
  .put(
    authenticate,
    authorize(["admin", "superadmin"]),
    validateRequest(abTestValidation.updateTest),
    abTestController.updateTest
  )
  .delete(authenticate, authorize(["admin", "superadmin"]), abTestController.deleteTest);

// Start/stop test
router.patch(
  "/:testId/start",
  authenticate,
  authorize(["admin", "superadmin"]),
  abTestController.startTest
);

router.patch(
  "/:testId/stop",
  authenticate,
  authorize(["admin", "superadmin"]),
  abTestController.stopTest
);

// Get test results
router.get(
  "/:testId/results",
  authenticate,
  authorize(["admin", "superadmin"]),
  abTestController.getTestResults
);

// Public route to get variant for a user
router.get("/variant/:testId", abTestController.getVariantForUser);

// Track conversion
router.post(
  "/track/:testId",
  validateRequest(abTestValidation.trackConversion),
  abTestController.trackConversion
);

export default router;
