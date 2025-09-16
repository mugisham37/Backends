import { Router } from "express";
import * as countryController from "../controllers/country.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateRequest } from "../middleware/validation.middleware";
import * as countryValidation from "../validations/country.validation";

const router = Router();

/**
 * @swagger
 * /countries:
 *   get:
 *     summary: Get all countries
 *     tags: [Countries]
 *     responses:
 *       200:
 *         description: List of countries
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
 *                     countries:
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
 *                           isActive:
 *                             type: boolean
 *                           phoneCode:
 *                             type: string
 *                           currency:
 *                             type: object
 *                             properties:
 *                               _id:
 *                                 type: string
 *                               code:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               symbol:
 *                                 type: string
 *                           defaultLanguage:
 *                             type: string
 *                           states:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 code:
 *                                   type: string
 *                                 name:
 *                                   type: string
 */
router.get("/", countryController.getAllCountries);

/**
 * @swagger
 * /countries/{code}:
 *   get:
 *     summary: Get country by code
 *     tags: [Countries]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *     responses:
 *       200:
 *         description: Country details
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
 *                     country:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         phoneCode:
 *                           type: string
 *                         currency:
 *                           type: object
 *                           properties:
 *                             _id:
 *                               type: string
 *                             code:
 *                               type: string
 *                             name:
 *                               type: string
 *                             symbol:
 *                               type: string
 *                         defaultLanguage:
 *                           type: string
 *                         states:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               code:
 *                                 type: string
 *                               name:
 *                                 type: string
 */
router.get("/:code", countryController.getCountryByCode);

/**
 * @swagger
 * /countries:
 *   post:
 *     summary: Create country
 *     tags: [Countries]
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
 *               - phoneCode
 *               - currency
 *             properties:
 *               code:
 *                 type: string
 *                 example: US
 *               name:
 *                 type: string
 *                 example: United States
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               phoneCode:
 *                 type: string
 *                 example: +1
 *               currency:
 *                 type: string
 *                 example: 60d21b4667d0d8992e610c85
 *               defaultLanguage:
 *                 type: string
 *                 example: en
 *               states:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: CA
 *                     name:
 *                       type: string
 *                       example: California
 *     responses:
 *       201:
 *         description: Country created successfully
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
 *                     country:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         phoneCode:
 *                           type: string
 *                         currency:
 *                           type: string
 *                         defaultLanguage:
 *                           type: string
 *                         states:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               code:
 *                                 type: string
 *                               name:
 *                                 type: string
 */
router.post(
  "/",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(countryValidation.createCountrySchema),
  countryController.createCountry
);

/**
 * @swagger
 * /countries/{code}:
 *   put:
 *     summary: Update country
 *     tags: [Countries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code:
 *                 type: string
 *                 example: US
 *               name:
 *                 type: string
 *                 example: United States
 *               isActive:
 *                 type: boolean
 *                 example: true
 *               phoneCode:
 *                 type: string
 *                 example: +1
 *               currency:
 *                 type: string
 *                 example: 60d21b4667d0d8992e610c85
 *               defaultLanguage:
 *                 type: string
 *                 example: en
 *               states:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: CA
 *                     name:
 *                       type: string
 *                       example: California
 *     responses:
 *       200:
 *         description: Country updated successfully
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
 *                     country:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         phoneCode:
 *                           type: string
 *                         currency:
 *                           type: string
 *                         defaultLanguage:
 *                           type: string
 *                         states:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               code:
 *                                 type: string
 *                               name:
 *                                 type: string
 */
router.put(
  "/:code",
  authenticate,
  authorize(["admin", "superadmin"]),
  validateRequest(countryValidation.updateCountrySchema),
  countryController.updateCountry
);

/**
 * @swagger
 * /countries/{code}:
 *   delete:
 *     summary: Delete country
 *     tags: [Countries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *     responses:
 *       200:
 *         description: Country deleted successfully
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
 *                     country:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         isActive:
 *                           type: boolean
 *                         phoneCode:
 *                           type: string
 *                         currency:
 *                           type: string
 *                         defaultLanguage:
 *                           type: string
 *                         states:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               code:
 *                                 type: string
 *                               name:
 *                                 type: string
 */
router.delete(
  "/:code",
  authenticate,
  authorize(["admin", "superadmin"]),
  countryController.deleteCountry
);

/**
 * @swagger
 * /countries/{code}/states:
 *   get:
 *     summary: Get states/provinces for a country
 *     tags: [Countries]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Country code
 *     responses:
 *       200:
 *         description: List of states/provinces
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
 *                     states:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                           name:
 *                             type: string
 */
router.get("/:code/states", countryController.getStatesByCountry);

export default router;
