import { Router } from "express"
import { AuthController } from "../../../controllers/auth.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { authValidation } from "../../../validations/auth.validation"
import { authMiddleware, requireAuth } from "../../../middleware/auth"

const router = Router()
const authController = new AuthController()

// Register a new user
router.post("/register", validateRequest(authValidation.register), authController.register)

// Login
router.post("/login", validateRequest(authValidation.login), authController.login)

// Refresh token
router.post("/refresh-token", validateRequest(authValidation.refreshToken), authController.refreshToken)

// Get current user
router.get("/me", authMiddleware, requireAuth, authController.getCurrentUser)

// Logout
router.post("/logout", authMiddleware, requireAuth, authController.logout)

// Change password
router.post(
  "/change-password",
  authMiddleware,
  requireAuth,
  validateRequest(authValidation.changePassword),
  authController.changePassword,
)

// Request password reset
router.post("/forgot-password", validateRequest(authValidation.forgotPassword), authController.forgotPassword)

// Reset password
router.post("/reset-password", validateRequest(authValidation.resetPassword), authController.resetPassword)

export const authRoutes = router
