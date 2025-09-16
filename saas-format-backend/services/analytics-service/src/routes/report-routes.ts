import express from "express"
import { body, param } from "express-validator"
import {
  createReport,
  getReports,
  getReportById,
  updateReport,
  deleteReport,
  generateReportData,
} from "../controllers/report-controller"
import { validateRequest } from "../middleware/validate-request"

const router = express.Router()

// Create a new analytics report
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Report name is required"),
    body("type").notEmpty().withMessage("Report type is required"),
    body("config").isObject().withMessage("Report configuration must be an object"),
    body("description").optional().isString().withMessage("Description must be a string"),
  ],
  validateRequest,
  createReport,
)

// Get all reports for the tenant
router.get("/", getReports)

// Get a specific report by ID
router.get("/:id", getReportById)

// Update a report
router.put(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid report ID"),
    body("name").optional().isString().withMessage("Report name must be a string"),
    body("description").optional().isString().withMessage("Description must be a string"),
    body("config").optional().isObject().withMessage("Report configuration must be an object"),
  ],
  validateRequest,
  updateReport,
)

// Delete a report
router.delete("/:id", deleteReport)

// Generate report data
router.post(
  "/:id/generate",
  [param("id").isUUID().withMessage("Invalid report ID")],
  validateRequest,
  generateReportData,
)

export default router
