import express from "express"
import { ProjectController } from "../controllers/project-controller"
import { TaskController } from "../controllers/task-controller"
import { authMiddleware } from "../middleware/auth-middleware"

const router = express.Router()
const projectController = new ProjectController()
const taskController = new TaskController()

// All routes require authentication
router.use(authMiddleware)

// Project routes
router.get("/", projectController.getAllProjects)
router.post("/", projectController.createProject)
router.get("/:id", projectController.getProjectById)
router.put("/:id", projectController.updateProject)
router.delete("/:id", projectController.deleteProject)

// Project members
router.get("/:id/members", projectController.getProjectMembers)
router.post("/:id/members", projectController.addProjectMember)
router.delete("/:id/members/:userId", projectController.removeProjectMember)

// Task routes
router.get("/:id/tasks", taskController.getTasksByProject)
router.post("/:id/tasks", taskController.createTask)
router.get("/:id/tasks/:taskId", taskController.getTaskById)
router.put("/:id/tasks/:taskId", taskController.updateTask)
router.delete("/:id/tasks/:taskId", taskController.deleteTask)

export default router
