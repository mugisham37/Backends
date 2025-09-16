import { Router } from "express"
import * as schedulerController from "../controllers/scheduler.controller"
import { authenticate, authorize } from "../middleware/auth.middleware"

const router = Router()

// All routes require admin authentication
router.use(authenticate, authorize(["admin", "superadmin"]))

/**
 * @swagger
 * /admin/scheduler/status:
 *   get:
 *     summary: Get scheduler job status
 *     tags: [Admin, Scheduler]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 requestId:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobs:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           running:
 *                             type: boolean
 *                           nextRun:
 *                             type: string
 *                             format: date-time
 */
router.get("/status", schedulerController.getJobStatus)

/**
 * @swagger
 * /admin/scheduler/start/{jobName}:
 *   post:
 *     summary: Start a scheduler job
 *     tags: [Admin, Scheduler]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *         description: Job name
 *     responses:
 *       200:
 *         description: Job started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 requestId:
 *                   type: string
 *                 message:
 *                   type: string
 *                   example: Job processEmailQueue started successfully
 */
router.post("/start/:jobName", schedulerController.startJob)

/**
 * @swagger
 * /admin/scheduler/stop/{jobName}:
 *   post:
 *     summary: Stop a scheduler job
 *     tags: [Admin, Scheduler]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *         description: Job name
 *     responses:
 *       200:
 *         description: Job stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 requestId:
 *                   type: string
 *                 message:
 *                   type: string
 *                   example: Job processEmailQueue stopped successfully
 */
router.post("/stop/:jobName", schedulerController.stopJob)

/**
 * @swagger
 * /admin/scheduler/run/{jobName}:
 *   post:
 *     summary: Run a scheduler job now
 *     tags: [Admin, Scheduler]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobName
 *         required: true
 *         schema:
 *           type: string
 *         description: Job name
 *     responses:
 *       200:
 *         description: Job executed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 requestId:
 *                   type: string
 *                 message:
 *                   type: string
 *                   example: Job processEmailQueue executed successfully
 */
router.post("/run/:jobName", schedulerController.runJobNow)

/**
 * @swagger
 * /admin/scheduler/start-all:
 *   post:
 *     summary: Start all scheduler jobs
 *     tags: [Admin, Scheduler]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All jobs started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 requestId:
 *                   type: string
 *                 message:
 *                   type: string
 *                   example: All jobs started successfully
 */
router.post("/start-all", schedulerController.startAllJobs)

/**
 * @swagger
 * /admin/scheduler/stop-all:
 *   post:
 *     summary: Stop all scheduler jobs
 *     tags: [Admin, Scheduler]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All jobs stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 requestId:
 *                   type: string
 *                 message:
 *                   type: string
 *                   example: All jobs stopped successfully
 */
router.post("/stop-all", schedulerController.stopAllJobs)

export default router
