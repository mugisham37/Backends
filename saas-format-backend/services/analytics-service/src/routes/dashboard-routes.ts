import express from "express"
import { body, param } from "express-validator"
import {
  createDashboard,
  getDashboards,
  getDashboardById,
  updateDashboard,
  deleteDashboard,
} from "../controllers/dashboard-controller"
import { validateRequest } from "../middleware/validate-request"

const router = express.Router()

// Create a new analytics dashboard
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Dashboard name is required"),
    body("layout").isObject().withMessage("Dashboard layout must be an object"),
    body("reports").isArray().withMessage("Reports must be an array of report IDs"),
    body("description").optional().isString().withMessage("Description must be a string"),
  ],
  validateRequest,
  createDashboard,
)

// Get all dashboards for the tenant
router.get("/", getDashboards)

// Get a specific dashboard by ID
router.get("/:id", getDashboardById)

// Update a dashboard
router.put(
  "/:id",
  [
    param("id").isUUID().withMessage("Invalid dashboard ID"),
    body("name").optional().isString().withMessage("Dashboard name must be a string"),
    body("description").optional().isString().withMessage("Description must be a string"),
    body("layout").optional().isObject().withMessage("Dashboard layout must be an object"),
    body("reports").optional().isArray().withMessage("Reports must be an array of report IDs"),
  ],
  validateRequest,
  updateDashboard,
)

// Delete a dashboard
router.delete("/:id", deleteDashboard)

export default router
