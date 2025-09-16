import express from "express"
import { SegmentController } from "../controllers/segment-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const segmentController = new SegmentController()

// Get all segments
router.get("/", segmentController.getAllSegments)

// Get segment by ID
router.get("/:id", segmentController.getSegmentById)

// Get segment by key
router.get("/key/:key", segmentController.getSegmentByKey)

// Create segment (admin/manager only)
router.post("/", authorize(["admin", "manager"]), segmentController.createSegment)

// Update segment (admin/manager only)
router.put("/:id", authorize(["admin", "manager"]), segmentController.updateSegment)

// Delete segment (admin only)
router.delete("/:id", authorize(["admin"]), segmentController.deleteSegment)

// Get feature flags for a segment
router.get("/:id/feature-flags", segmentController.getSegmentFeatureFlags)

export default router
