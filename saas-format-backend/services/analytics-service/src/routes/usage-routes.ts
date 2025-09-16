import express from "express"
import { query } from "express-validator"
import {
  getUsersOverTime,
  getProjectsOverTime,
  getTasksOverTime,
  getStorageUsage,
  getApiUsage,
  createUsageSnapshot,
} from "../controllers/usage-controller"
import { validateRequest } from "../middleware/validate-request"
import { hasRole } from "../middleware/auth-middleware"

const router = express.Router()

// Get users over time
router.get(
  "/users",
  [
    query("startDate").isISO8601().withMessage("Start date must be a valid ISO date"),
    query("endDate").isISO8601().withMessage("End date must be a valid ISO date"),
  ],
  validateRequest,
  getUsersOverTime,
)

// Get projects over time
router.get(
  "/projects",
  [
    query("startDate").isISO8601().withMessage("Start date must be a valid ISO date"),
    query("endDate").isISO8601().withMessage("End date must be a valid ISO date"),
  ],
  validateRequest,
  getProjectsOverTime,
)

// Get tasks over time
router.get(
  "/tasks",
  [
    query("startDate").isISO8601().withMessage("Start date must be a valid ISO date"),
    query("endDate").isISO8601().withMessage("End date must be a valid ISO date"),
  ],
  validateRequest,
  getTasksOverTime,
)

// Get storage usage
router.get("/storage", getStorageUsage)

// Get API usage
router.get(
  "/api",
  [
    query("startDate").isISO8601().withMessage("Start date must be a valid ISO date"),
    query("endDate").isISO8601().withMessage("End date must be a valid ISO date"),
  ],
  validateRequest,
  getApiUsage,
)

// Create usage snapshot (admin only)
router.post("/snapshot", hasRole(["admin"]), createUsageSnapshot)

export default router
