import express from "express"
import { PlanController } from "../controllers/plan-controller"
import { authorize } from "../middleware/auth-middleware"

const router = express.Router()
const planController = new PlanController()

// Get all plans
router.get("/", planController.getAllPlans)

// Get plan by ID
router.get("/:id", planController.getPlanById)

// Admin-only routes
router.post("/", authorize(["super_admin"]), planController.createPlan)
router.put("/:id", authorize(["super_admin"]), planController.updatePlan)
router.delete("/:id", authorize(["super_admin"]), planController.deletePlan)

export default router
