import express from "express"
import { AuthController } from "../controllers/auth-controller"
import { tenantMiddleware } from "../middleware/tenant-middleware"
import { authMiddleware } from "../middleware/auth-middleware"

const router = express.Router()
const authController = new AuthController()

// Tenant-specific auth routes
router.use(tenantMiddleware)

// Public routes
router.post("/register", authController.register)
router.post("/login", authController.login)
router.post("/forgot-password", authController.forgotPassword)
router.post("/reset-password", authController.resetPassword)

// Protected routes
router.use(authMiddleware)
router.get("/me", authController.getCurrentUser)
router.post("/logout", authController.logout)
router.put("/change-password", authController.changePassword)
router.get("/validate-token", authController.validateToken)

export default router
