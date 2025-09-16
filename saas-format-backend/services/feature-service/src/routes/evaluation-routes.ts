import express from "express"
import { EvaluationController } from "../controllers/evaluation-controller"

const router = express.Router()
const evaluationController = new EvaluationController()

// Evaluate all feature flags for a user
router.post("/", evaluationController.evaluateAllFeatureFlags)

// Evaluate a specific feature flag for a user
router.post("/:key", evaluationController.evaluateFeatureFlag)

export default router
