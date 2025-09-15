import { Router } from "express"
import { UserController } from "../../../controllers/user.controller"
import { validateRequest } from "../../../middleware/validate-request"
import { userValidation } from "../../../validations/user.validation"
import { authMiddleware, requireAuth, requireRoles } from "../../../middleware/auth"

const router = Router()
const userController = new UserController()

// Apply authentication middleware to all routes
router.use(authMiddleware, requireAuth)

// Get all users (admin only)
router.get("/", requireRoles(["admin"]), userController.getAllUsers)

// Get user by ID (admin or self)
router.get("/:id", userController.getUserById)

// Create user (admin only)
router.post("/", requireRoles(["admin"]), validateRequest(userValidation.createUser), userController.createUser)

// Update user (admin or self)
router.put("/:id", validateRequest(userValidation.updateUser), userController.updateUser)

// Delete user (admin only)
router.delete("/:id", requireRoles(["admin"]), userController.deleteUser)

// Change password (self only)
router.post("/change-password", validateRequest(userValidation.changePassword), userController.changePassword)

// Activate user (admin only)
router.post("/:id/activate", requireRoles(["admin"]), userController.activateUser)

// Deactivate user (admin only)
router.post("/:id/deactivate", requireRoles(["admin"]), userController.deactivateUser)

// Change user role (admin only)
router.post(
  "/:id/change-role",
  requireRoles(["admin"]),
  validateRequest(userValidation.changeRole),
  userController.changeRole,
)

// Search users (admin only)
router.get("/search", requireRoles(["admin"]), userController.searchUsers)

export const userRoutes = router
