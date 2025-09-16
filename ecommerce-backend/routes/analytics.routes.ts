import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorize(["admin", "superadmin"]));

/**
 * @swagger
 * /analytics/sales:
 *   get:
 *     summary: Get sales analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics (default is today)
 *       - in: query
 *         name: interval
 *         schema:
 *           type: string
 *           enum: [hourly, daily, weekly, monthly]
 *           default: daily
 *         description: Interval for aggregating data
 *       - in: query
 *         name: compareWithPrevious
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Whether to compare with previous period
 *     responses:
 *       200:
 *         description: Sales analytics retrieved successfully
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
 *                     current:
 *                       type: object
 *                     previous:
 *                       type: object
 *                     comparison:
 *                       type: object
 */
router.get("/sales", analyticsController.getSalesAnalytics);

/**
 * @swagger
 * /analytics/products:
 *   get:
 *     summary: Get product analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics (default is today)
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filter by category ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limit for top products
 *     responses:
 *       200:
 *         description: Product analytics retrieved successfully
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
 *                     topSellingProducts:
 *                       type: array
 *                     topViewedProducts:
 *                       type: array
 *                     topRatedProducts:
 *                       type: array
 *                     inventorySummary:
 *                       type: object
 */
router.get("/products", analyticsController.getProductAnalytics);

/**
 * @swagger
 * /analytics/users:
 *   get:
 *     summary: Get user analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics (default is today)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Limit for top customers
 *     responses:
 *       200:
 *         description: User analytics retrieved successfully
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
 *                     userGrowth:
 *                       type: array
 *                     topCustomers:
 *                       type: array
 *                     customerSegmentation:
 *                       type: object
 *                     userRetention:
 *                       type: object
 */
router.get("/users", analyticsController.getUserAnalytics);

/**
 * @swagger
 * /analytics/dashboard:
 *   get:
 *     summary: Get dashboard analytics
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics (default is 30 days ago)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics (default is today)
 *     responses:
 *       200:
 *         description: Dashboard analytics retrieved successfully
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
 *                     userSummary:
 *                       type: object
 *                     productSummary:
 *                       type: object
 *                     orderSummary:
 *                       type: object
 *                     recentOrders:
 *                       type: array
 *                     topProducts:
 *                       type: array
 *                     salesByCategory:
 *                       type: array
 */
router.get("/dashboard", analyticsController.getDashboardAnalytics);

export default router;
