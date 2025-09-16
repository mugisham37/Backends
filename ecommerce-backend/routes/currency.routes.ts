import { Router } from "express";
import * as currencyController from "../controllers/currency.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";
import * as currencyValidation from "../validations/currency.validation";

const router = Router();

/**
 * @swagger
 * /currencies:
 *   get:
 *     summary: Get all currencies
 *     tags: [Currencies]
 *     responses:
 *       200:
 *         description: List of currencies
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
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     currencies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           code:
 *                             type: string
 *                           name:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           rate:
 *                             type: number
 *                           isBase:
 *                             type: boolean
 *                           isActive:
 *                             type: boolean
 *                           decimalPlaces:
 *                             type: integer
 */
router.get("/", currencyController.getAllCurrencies);

/**
 * @swagger
 * /currencies/base:
 *   get:
 *     summary: Get base currency
 *     tags: [Currencies]
 *     responses:
 *       200:
 *         description: Base currency
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
 *                     currency:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         isBase:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         decimalPlaces:
 *                           type: integer
 */
router.get("/base", currencyController.getBaseCurrency);

/**
 * @swagger
 * /currencies/{code}:
 *   get:
 *     summary: Get currency by code
 *     tags: [Currencies]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Currency details
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
 *                     currency:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         isBase:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         decimalPlaces:
 *                           type: integer
 */
router.get("/:code", currencyController.getCurrencyByCode);

/**
 * @swagger
 * /currencies:
 *   post:
 *     summary: Create currency
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *               - name
 *               - symbol
 *               - rate
 *             properties:
 *               code:
 *                 type: string
 *                 example: USD
 *               name:
 *                 type: string
 *                 example: US Dollar
 *               symbol:
 *                 type: string
 *                 example: $
 *               rate:
 *                 type: number
 *                 example: 1
 *               isBase:
 *                 type: boolean
 *                 example: false
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               decimalPlaces:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       201:
 *         description: Currency created successfully
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
 *                     currency:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         isBase:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         decimalPlaces:
 *                           type: integer
 */
router.post(
  "/",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(currencyValidation.createCurrencySchema),
  currencyController.createCurrency
);

/**
 * @swagger
 * /currencies/{code}:
 *   put:
 *     summary: Update currency
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: USD
 *               name:
 *                 type: string
 *                 example: US Dollar
 *               symbol:
 *                 type: string
 *                 example: $
 *               rate:
 *                 type: number
 *                 example: 1
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               decimalPlaces:
 *                 type: integer
 *                 example: 2
 *     responses:
 *       200:
 *         description: Currency updated successfully
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
 *                     currency:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         isBase:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         decimalPlaces:
 *                           type: integer
 */
router.put(
  "/:code",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(currencyValidation.updateCurrencySchema),
  currencyController.updateCurrency
);

/**
 * @swagger
 * /currencies/{code}:
 *   delete:
 *     summary: Delete currency
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Currency deleted successfully
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
 *                     currency:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         isBase:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         decimalPlaces:
 *                           type: integer
 */
router.delete(
  "/:code",
  authenticate,
  authorize(["admin", "superadmin"]),
  currencyController.deleteCurrency
);

/**
 * @swagger
 * /currencies/{code}/set-base:
 *   post:
 *     summary: Set currency as base currency
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Base currency set successfully
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
 *                     currency:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         isBase:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         decimalPlaces:
 *                           type: integer
 */
router.post(
  "/:code/set-base",
  authenticate,
  authorize(["admin", "superadmin"]),
  currencyController.setBaseCurrency
);

/**
 * @swagger
 * /currencies/update-rates:
 *   post:
 *     summary: Update exchange rates from external API
 *     tags: [Currencies]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 example: your-api-key
 *     responses:
 *       200:
 *         description: Exchange rates updated successfully
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
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     currencies:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           code:
 *                             type: string
 *                           name:
 *                             type: string
 *                           symbol:
 *                             type: string
 *                           rate:
 *                             type: number
 *                           isBase:
 *                             type: boolean
 *                           isActive:
 *                             type: boolean
 *                           decimalPlaces:
 *                             type: integer
 */
router.post(
  "/update-rates",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(currencyValidation.updateRatesSchema),
  currencyController.updateExchangeRates
);

/**
 * @swagger
 * /currencies/convert:
 *   get:
 *     summary: Convert amount between currencies
 *     tags: [Currencies]
 *     parameters:
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Amount to convert
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *         description: Source currency code
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *         description: Target currency code
 *     responses:
 *       200:
 *         description: Converted amount
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
 *                     amount:
 *                       type: number
 *                     fromCurrency:
 *                       type: string
 *                     toCurrency:
 *                       type: string
 *                     convertedAmount:
 *                       type: number
 */
router.get("/convert", currencyController.convertCurrency);

/**
 * @swagger
 * /currencies/format:
 *   get:
 *     summary: Format amount according to currency
 *     tags: [Currencies]
 *     parameters:
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Amount to format
 *       - in: query
 *         name: currency
 *         required: true
 *         schema:
 *           type: string
 *         description: Currency code
 *     responses:
 *       200:
 *         description: Formatted amount
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
 *                     amount:
 *                       type: number
 *                     currency:
 *                       type: string
 *                     formattedAmount:
 *                       type: string
 */
router.get("/format", currencyController.formatCurrency);

export default router;
