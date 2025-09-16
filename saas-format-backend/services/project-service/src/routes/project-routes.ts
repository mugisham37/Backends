import express from "express"
import { ProjectController } from "../controllers/project-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const projectController = new ProjectController()

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
router.put("/:id/members/:userId/role", projectController.updateMemberRole)

// Project statistics
router.get("/:id/statistics", projectController.getProjectStatistics)

// Bulk operations
router.post("/bulk-create", authorize(["tenant_admin", "super_admin"]), projectController.bulkCreateProjects)
router.post("/bulk-update", authorize(["tenant_admin", "super_admin"]), projectController.bulkUpdateProjects)
router.post("/bulk-delete", authorize(["tenant_admin", "super_admin"]), projectController.bulkDeleteProjects)

export default router
