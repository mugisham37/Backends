import express from "express"
import { ProfileController } from "../controllers/profile-controller"

const router = express.Router()
const profileController = new ProfileController()

// Get current user's profile
router.get("/me", profileController.getCurrentUserProfile)

// Update current user's profile
router.put("/me", profileController.updateCurrentUserProfile)

// Get user profile by user ID
router.get("/:userId", profileController.getUserProfile)

// Update user profile by user ID (self or admin)
router.put("/:userId", profileController.updateUserProfile)

export default router
