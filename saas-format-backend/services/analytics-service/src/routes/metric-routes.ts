import express from "express"
import { body, query } from "express-validator"
import { createMetric, getMetrics, getMetricById, deleteMetric } from "../controllers/metric-controller"
import { validateRequest } from "../middleware/validate-request"

const router = express.Router()

// Create a new analytics metric
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Metric name is required"),
    body("value").isNumeric().withMessage("Metric value must be a number"),
    body("unit").optional().isString().withMessage("Unit must be a string"),
  ],
  validateRequest,
  createMetric,
)

// Get metrics with optional filtering
router.get(
  "/",
  [
    query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),
    query("name").optional().isString().withMessage("Metric name must be a string"),
  ],
  validateRequest,
  getMetrics,
)

// Get a specific metric by ID
router.get("/:id", getMetricById)

// Delete a metric
router.delete("/:id", deleteMetric)

export default router
