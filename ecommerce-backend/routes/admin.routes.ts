import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import schedulerRoutes from "./scheduler.routes";
import * as adminDashboardController from "../controllers/admin.dashboard.controller";
import * as settingsController from "../controllers/settings.controller";
import * as reportController from "../controllers/report.controller";
import * as batchController from "../controllers/batch.controller";
import { validate } from "../middleware/validation.middleware";
import { batchLoyaltyPointsSchema } from "../utils/validation.schemas";
import * as notificationController from "../controllers/notification.controller";
import {
  sendLoyaltyNotificationSchema,
  sendBatchLoyaltyNotificationsSchema,
} from "../utils/validation.schemas";

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorize(["admin", "superadmin"]));

// Scheduler routes
router.use("/scheduler", schedulerRoutes);

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data retrieved successfully
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
 *                     salesSummary:
 *                       type: object
 *                     ordersSummary:
 *                       type: object
 *                     usersSummary:
 *                       type: object
 *                     productsSummary:
 *                       type: object
 */
router.get("/dashboard", adminController.getDashboardData);

router.get("/dashboard/loyalty", adminDashboardController.getLoyaltyDashboard);

/**
 * @swagger
 * /admin/sales:
 *   get:
 *     summary: Get sales data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering sales
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering sales
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly]
 *           default: daily
 *         description: Interval for aggregating sales data
 *     responses:
 *       200:
 *         description: Sales data retrieved successfully
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
 *                     sales:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/sales", adminController.getSalesData);

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     summary: Get orders data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering orders
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering orders
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, shipped, delivered, cancelled]
 *         description: Order status for filtering
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Orders data retrieved successfully
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
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 */
router.get("/orders", adminController.getOrdersData);

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get users data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering users
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering users
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [customer, admin, superadmin]
 *         description: User role for filtering
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Users data retrieved successfully
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
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 */
router.get("/users", adminController.getUsersData);

/**
 * @swagger
 * /admin/products:
 *   get:
 *     summary: Get products data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID for filtering products
 *       - in: query
 *         name: featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: boolean
 *         description: Filter by stock status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Products data retrieved successfully
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
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 */
router.get("/products", adminController.getProductsData);

/**
 * @swagger
 * /admin/inventory:
 *   get:
 *     summary: Get inventory data
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID for filtering inventory
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filter by low stock status
 *       - in: query
 *         name: outOfStock
 *         schema:
 *           type: boolean
 *         description: Filter by out of stock status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Inventory data retrieved successfully
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
 *                     inventory:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 */
router.get("/inventory", adminController.getInventoryData);

router.get("/settings/:key", settingsController.getSetting);
router.put("/settings/:key", settingsController.setSetting);
router.get("/settings/group/:group", settingsController.getSettingsByGroup);
router.delete("/settings/:key", settingsController.deleteSetting);

router.post("/reports/loyalty", reportController.generateLoyaltyReport);

/**
 * @swagger
 * /admin/batch/loyalty-points:
 *   post:
 *     summary: Process batch loyalty points
 *     tags: [Admin Batch]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operations
 *             properties:
 *               operations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - points
 *                     - description
 *                   properties:
 *                     userId:
 *                       type: string
 *                     points:
 *                       type: number
 *                     description:
 *                       type: string
 *                     referenceId:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [order, referral, manual, other]
 *     responses:
 *       200:
 *         description: Batch loyalty points processed successfully
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
 */
router.post(
  "/batch/loyalty-points",
  validate(batchLoyaltyPointsSchema),
  batchController.processBatchLoyaltyPoints
);

/**
 * @swagger
 * /admin/batch/expired-points:
 *   post:
 *     summary: Process batch expired points
 *     tags: [Admin Batch]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               batchSize:
 *                 type: number
 *                 default: 100
 *     responses:
 *       200:
 *         description: Batch expired points processed successfully
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
 */
router.post("/batch/expired-points", batchController.processBatchExpiredPoints);

/**
 * @swagger
 * /admin/notifications/loyalty:
 *   post:
 *     summary: Send loyalty notification
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - type
 *               - data
 *             properties:
 *               userId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [points_earned, points_expired, tier_upgrade, reward_redeemed, reward_approved, reward_rejected]
 *               data:
 *                 type: object
 *     responses:
 *       200:
 *         description: Loyalty notification sent successfully
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
 *                     success:
 *                       type: boolean
 */
router.post(
  "/notifications/loyalty",
  validate(sendLoyaltyNotificationSchema),
  notificationController.sendLoyaltyNotification
);

/**
 * @swagger
 * /admin/notifications/loyalty/batch:
 *   post:
 *     summary: Send batch loyalty notifications
 *     tags: [Admin Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notifications
 *             properties:
 *               notifications:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - userId
 *                     - type
 *                     - data
 *                   properties:
 *                     userId:
 *                       type: string
 *                     type:
 *                       type: string
 *                       enum: [points_earned, points_expired, tier_upgrade, reward_redeemed, reward_approved, reward_rejected]
 *                     data:
 *                       type: object
 *     responses:
 *       200:
 *         description: Batch loyalty notifications sent successfully
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
 */
router.post(
  "/notifications/loyalty/batch",
  validate(sendBatchLoyaltyNotificationsSchema),
  notificationController.sendBatchLoyaltyNotifications
);

export default router;
