import express from "express"
import { body, query } from "express-validator"
import { createEvent, getEvents, getEventById, deleteEvent } from "../controllers/event-controller"
import { validateRequest } from "../middleware/validate-request"

const router = express.Router()

// Create a new analytics event
router.post(
  "/",
  [
    body("name").notEmpty().withMessage("Event name is required"),
    body("properties").optional().isObject().withMessage("Properties must be an object"),
  ],
  validateRequest,
  createEvent,
)

// Get events with optional filtering
router.get(
  "/",
  [
    query("startDate").optional().isISO8601().withMessage("Start date must be a valid ISO date"),
    query("endDate").optional().isISO8601().withMessage("End date must be a valid ISO date"),
    query("name").optional().isString().withMessage("Event name must be a string"),
  ],
  validateRequest,
  getEvents,
)

// Get a specific event by ID
router.get("/:id", getEventById)

// Delete an event
router.delete("/:id", deleteEvent)

export default router
