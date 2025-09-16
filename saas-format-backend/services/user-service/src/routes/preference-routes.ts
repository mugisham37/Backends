import express from "express"
import { PreferenceController } from "../controllers/preference-controller"

const router = express.Router()
const preferenceController = new PreferenceController()

// Get current user's preferences
router.get("/me", preferenceController.getCurrentUserPreferences)

// Update current user's preferences
router.put("/me", preferenceController.updateCurrentUserPreferences)

// Get user preferences by user ID
router.get("/:userId", preferenceController.getUserPreferences)

// Update user preferences by user ID (self or admin)
router.put("/:userId", preferenceController.updateUserPreferences)

export default router
