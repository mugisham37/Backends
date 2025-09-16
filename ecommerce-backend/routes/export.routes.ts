import { Router } from "express";
import * as exportController from "../controllers/export.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

/**
 * @swagger
 * /export/orders:
 *   get:
 *     summary: Export orders
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf, json]
 *           default: csv
 *         description: Export format
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
 *         name: isPaid
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by payment status
 *     responses:
 *       200:
 *         description: Orders exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/orders",
  authenticate,
  authorize(["admin", "superadmin"]),
  exportController.exportOrdersController
);

/**
 * @swagger
 * /export/products:
 *   get:
 *     summary: Export products
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf, json]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID for filtering products
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price for filtering products
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price for filtering products
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by stock status
 *       - in: query
 *         name: featured
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by featured status
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Products exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/products",
  authenticate,
  authorize(["admin", "superadmin"]),
  exportController.exportProductsController
);

/**
 * @swagger
 *  authorize(["admin", "superadmin"]), exportController.exportProductsController)

/**
 * @swagger
 * /export/customers:
 *   get:
 *     summary: Export customers
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf, json]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering customers
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering customers
 *       - in: query
 *         name: active
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Customers exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/customers",
  authenticate,
  authorize(["admin", "superadmin"]),
  exportController.exportCustomersController
);

/**
 * @swagger
 * /export/sales:
 *   get:
 *     summary: Export sales data
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf, json]
 *           default: csv
 *         description: Export format
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
 *         description: Sales data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/sales",
  authenticate,
  authorize(["admin", "superadmin"]),
  exportController.exportSalesController
);

/**
 * @swagger
 * /export/inventory:
 *   get:
 *     summary: Export inventory data
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, excel, pdf, json]
 *           default: csv
 *         description: Export format
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Category ID for filtering inventory
 *       - in: query
 *         name: minQuantity
 *         schema:
 *           type: number
 *         description: Minimum quantity for filtering inventory
 *       - in: query
 *         name: maxQuantity
 *         schema:
 *           type: number
 *         description: Maximum quantity for filtering inventory
 *       - in: query
 *         name: inStock
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter by stock status
 *       - in: query
 *         name: includeVariants
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: false
 *         description: Include variant details in export
 *     responses:
 *       200:
 *         description: Inventory data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *           application/json:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get(
  "/inventory",
  authenticate,
  authorize(["admin", "superadmin"]),
  exportController.exportInventoryController
);

export default router;
