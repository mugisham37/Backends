import express from "express"
import { TaskController } from "../controllers/task-controller"

const router = express.Router()
const taskController = new TaskController()

// Task routes
router.get("/project/:projectId", taskController.getTasksByProject)
router.post("/project/:projectId", taskController.createTask)
router.get("/:id", taskController.getTaskById)
router.put("/:id", taskController.updateTask)
router.delete("/:id", taskController.deleteTask)

// Task assignment
router.post("/:id/assign", taskController.assignTask)
router.post("/:id/unassign", taskController.unassignTask)

// Task status
router.post("/:id/status", taskController.updateTaskStatus)

// Task bulk operations
router.post("/bulk-create", taskController.bulkCreateTasks)
router.post("/bulk-update", taskController.bulkUpdateTasks)
router.post("/bulk-delete", taskController.bulkDeleteTasks)

export default router
