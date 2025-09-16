import express from "express"
import { UserController } from "../controllers/user-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const userController = new UserController()

// User management (tenant admins only)
router.get("/", authorize(["tenant_admin", "super_admin"]), userController.getAllUsers)
router.post("/", authorize(["tenant_admin", "super_admin"]), userController.createUser)
router.get("/:id", userController.getUserById)
router.put("/:id", userController.updateUser)
router.delete("/:id", authorize(["tenant_admin", "super_admin"]), userController.deleteUser)

// Bulk operations
router.post("/bulk-create", authorize(["tenant_admin", "super_admin"]), userController.bulkCreateUsers)
router.post("/bulk-update", authorize(["tenant_admin", "super_admin"]), userController.bulkUpdateUsers)
router.post("/bulk-delete", authorize(["tenant_admin", "super_admin"]), userController.bulkDeleteUsers)

// User search
router.get("/search", authorize(["tenant_admin", "super_admin"]), userController.searchUsers)

export default router
