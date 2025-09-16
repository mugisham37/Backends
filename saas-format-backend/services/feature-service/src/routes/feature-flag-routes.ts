import express from "express"
import { FeatureFlagController } from "../controllers/feature-flag-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const featureFlagController = new FeatureFlagController()

// Get all feature flags
router.get("/", featureFlagController.getAllFeatureFlags)

// Get feature flag by ID
router.get("/:id", featureFlagController.getFeatureFlagById)

// Get feature flag by key
router.get("/key/:key", featureFlagController.getFeatureFlagByKey)

// Create feature flag (admin/manager only)
router.post("/", authorize(["admin", "manager"]), featureFlagController.createFeatureFlag)

// Update feature flag (admin/manager only)
router.put("/:id", authorize(["admin", "manager"]), featureFlagController.updateFeatureFlag)

// Delete feature flag (admin only)
router.delete("/:id", authorize(["admin"]), featureFlagController.deleteFeatureFlag)

// Enable/disable feature flag (admin/manager only)
router.patch("/:id/toggle", authorize(["admin", "manager"]), featureFlagController.toggleFeatureFlag)

// Get tenant overrides for a feature flag
router.get("/:id/tenant-overrides", featureFlagController.getTenantOverrides)

// Create/update tenant override (admin/manager only)
router.put(
  "/:id/tenant-overrides/:tenantId",
  authorize(["admin", "manager"]),
  featureFlagController.upsertTenantOverride,
)

// Delete tenant override (admin/manager only)
router.delete(
  "/:id/tenant-overrides/:tenantId",
  authorize(["admin", "manager"]),
  featureFlagController.deleteTenantOverride,
)

// Get user overrides for a feature flag
router.get("/:id/user-overrides", featureFlagController.getUserOverrides)

// Create/update user override (admin/manager only)
router.put("/:id/user-overrides/:userId", authorize(["admin", "manager"]), featureFlagController.upsertUserOverride)

// Delete user override (admin/manager only)
router.delete("/:id/user-overrides/:userId", authorize(["admin", "manager"]), featureFlagController.deleteUserOverride)

// Get segments for a feature flag
router.get("/:id/segments", featureFlagController.getFeatureFlagSegments)

// Add segment to feature flag (admin/manager only)
router.post("/:id/segments/:segmentId", authorize(["admin", "manager"]), featureFlagController.addSegmentToFeatureFlag)

// Update segment settings for feature flag (admin/manager only)
router.put("/:id/segments/:segmentId", authorize(["admin", "manager"]), featureFlagController.updateFeatureFlagSegment)

// Remove segment from feature flag (admin/manager only)
router.delete(
  "/:id/segments/:segmentId",
  authorize(["admin", "manager"]),
  featureFlagController.removeSegmentFromFeatureFlag,
)

export default router
