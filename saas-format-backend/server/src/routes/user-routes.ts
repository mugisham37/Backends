import express from "express"
import { UserController } from "../controllers/user-controller"
import { authMiddleware, authorize } from "../middleware/auth-middleware"

const router = express.Router()
const userController = new UserController()

// All routes require authentication
router.use(authMiddleware)

// User management (tenant admins only)
router.get("/", authorize(["tenant_admin", "super_admin"]), userController.getAllUsers)
router.post("/", authorize(["tenant_admin", "super_admin"]), userController.createUser)
router.get("/:id", userController.getUserById)
router.put("/:id", userController.updateUser)
router.delete("/:id", authorize(["tenant_admin", "super_admin"]), userController.deleteUser)

export default router
