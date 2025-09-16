import { Router } from "express";
import * as taxController from "../controllers/tax.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";
import * as taxValidation from "../validations/tax.validation";

const router = Router();

/**
 * @swagger
 * /taxes:
 *   get:
 *     summary: Get all tax rates
 *     tags: [Taxes]
 *     responses:
 *       200:
 *         description: List of tax rates
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
 *                     taxRates:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           rate:
 *                             type: number
 *                           country:
 *                             type: string
 *                           state:
 *                             type: string
 *                           postalCode:
 *                             type: string
 *                           isDefault:
 *                             type: boolean
 *                           isActive:
 *                             type: boolean
 *                           priority:
 *                             type: integer
 *                           productCategories:
 *                             type: array
 *                             items:
 *                               type: string
 */
router.get("/", taxController.getAllTaxRates);

/**
 * @swagger
 * /taxes/{id}:
 *   get:
 *     summary: Get tax rate by ID
 *     tags: [Taxes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Tax rate ID
 *     responses:
 *       200:
 *         description: Tax rate details
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
 *                     taxRate:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         country:
 *                           type: string
 *                         state:
 *                           type: string
 *                         postalCode:
 *                           type: string
 *                         isDefault:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         priority:
 *                           type: integer
 *                         productCategories:
 *                           type: array
 *                           items:
 *                             type: string
 */
router.get("/:id", taxController.getTaxRateById);

/**
 * @swagger
 * /taxes:
 *   post:
 *     summary: Create tax rate
 *     tags: [Taxes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - rate
 *               - country
 *             properties:
 *               name:
 *                 type: string
 *                 example: US Sales Tax
 *               rate:
 *                 type: number
 *                 example: 7.5
 *               country:
 *                 type: string
 *                 example: US
 *               state:
 *                 type: string
 *                 example: CA
 *               postalCode:
 *                 type: string
 *                 example: 90210
 *               isDefault:
 *                 type: boolean
 *                 example: false
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               priority:
 *                 type: integer
 *                 example: 1
 *               productCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60d21b4667d0d8992e610c85"]
 *     responses:
 *       201:
 *         description: Tax rate created successfully
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
 *                     taxRate:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         country:
 *                           type: string
 *                         state:
 *                           type: string
 *                         postalCode:
 *                           type: string
 *                         isDefault:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         priority:
 *                           type: integer
 *                         productCategories:
 *                           type: array
 *                           items:
 *                             type: string
 */
router.post(
  "/",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(taxValidation.createTaxRateSchema),
  taxController.createTaxRate
);

/**
 * @swagger
 * /taxes/{id}:
 *   put:
 *     summary: Update tax rate
 *     tags: [Taxes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Tax rate ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: US Sales Tax
 *               rate:
 *                 type: number
 *                 example: 7.5
 *               country:
 *                 type: string
 *                 example: US
 *               state:
 *                 type: string
 *                 example: CA
 *               postalCode:
 *                 type: string
 *                 example: 90210
 *               isDefault:
 *                 type: boolean
 *                 example: false
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               priority:
 *                 type: integer
 *                 example: 1
 *               productCategories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["60d21b4667d0d8992e610c85"]
 *     responses:
 *       200:
 *         description: Tax rate updated successfully
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
 *                     taxRate:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         country:
 *                           type: string
 *                         state:
 *                           type: string
 *                         postalCode:
 *                           type: string
 *                         isDefault:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         priority:
 *                           type: integer
 *                         productCategories:
 *                           type: array
 *                           items:
 *                             type: string
 */
router.put(
  "/:id",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(taxValidation.updateTaxRateSchema),
  taxController.updateTaxRate
);

/**
 * @swagger
 * /taxes/{id}:
 *   delete:
 *     summary: Delete tax rate
 *     tags: [Taxes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Tax rate ID
 *     responses:
 *       200:
 *         description: Tax rate deleted successfully
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
 *                     taxRate:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         country:
 *                           type: string
 *                         state:
 *                           type: string
 *                         postalCode:
 *                           type: string
 *                         isDefault:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         priority:
 *                           type: integer
 *                         productCategories:
 *                           type: array
 *                           items:
 *                             type: string
 */
router.delete(
  "/:id",
  authenticate,
  authorize(["admin", "superadmin"]),
  taxController.deleteTaxRate
);

/**
 * @swagger
 * /taxes/applicable:
 *   get:
 *     summary: Get applicable tax rate for a location
 *     tags: [Taxes]
 *     parameters:
 *       - in: query
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State/province code
 *       - in: query
 *         name: postalCode
 *         schema:
 *           type: string
 *         description: Postal/ZIP code
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Product category ID
 *     responses:
 *       200:
 *         description: Applicable tax rate
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
 *                     taxRate:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         name:
 *                           type: string
 *                         rate:
 *                           type: number
 *                         country:
 *                           type: string
 *                         state:
 *                           type: string
 *                         postalCode:
 *                           type: string
 *                         isDefault:
 *                           type: boolean
 *                         isActive:
 *                           type: boolean
 *                         priority:
 *                           type: integer
 *                         productCategories:
 *                           type: array
 *                           items:
 *                             type: string
 */
router.get("/applicable", taxController.getApplicableTaxRate);

/**
 * @swagger
 * /taxes/calculate:
 *   get:
 *     summary: Calculate tax amount
 *     tags: [Taxes]
 *     parameters:
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *         description: Amount to calculate tax on
 *       - in: query
 *         name: country
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: State/province code
 *       - in: query
 *         name: postalCode
 *         schema:
 *           type: string
 *         description: Postal/ZIP code
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Product category ID
 *     responses:
 *       200:
 *         description: Tax calculation result
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
 *                     taxAmount:
 *                       type: number
 *                     taxRate:
 *                       type: number
 *                     taxName:
 *                       type: string
 *                     taxRateId:
 *                       type: string
 *                     totalAmount:
 *                       type: number
 */
router.get("/calculate", taxController.calculateTax);

export default router;
