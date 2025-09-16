import express from "express"
import * as adminLoyaltyController from "../controllers/admin-loyalty.controller"
import { authenticate, authorize } from "../middleware/auth.middleware"
import { validate } from "../middleware/validate.middleware"
import {
  createLoyaltyTierSchema,
  updateLoyaltyTierSchema,
  createRewardSchema,
  updateRewardSchema,
  updateRedemptionStatusSchema,
  adjustCustomerPointsSchema,
} from "../validations/loyalty.validation"

const router = express.Router()

// All routes require admin authentication
router.use(authenticate, authorize(["admin", "superadmin"]))

/**
 * @swagger
 * /admin/loyalty/tiers:
 *   get:
 *     summary: Get all loyalty tiers
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty tiers retrieved successfully
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
 *                   type: array
 *                   items:
 *                     type: object
 *   post:
 *     summary: Create a loyalty tier
 *     tags: [Admin Loyalty]
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
 *               - level
 *               - pointsThreshold
 *             properties:
 *               name:
 *                 type: string
 *               level:
 *                 type: number
 *               pointsThreshold:
 *                 type: number
 *               benefits:
 *                 type: array
 *                 items:
 *                   type: string
 *               discountPercentage:
 *                 type: number
 *               active:
 *                 type: boolean
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       201:
 *         description: Loyalty tier created successfully
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
router.get("/tiers", adminLoyaltyController.getAllLoyaltyTiers)
router.post("/tiers", validate(createLoyaltyTierSchema), adminLoyaltyController.createLoyaltyTier)

/**
 * @swagger
 * /admin/loyalty/tiers/{tierId}:
 *   get:
 *     summary: Get loyalty tier by ID
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tierId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tier ID
 *     responses:
 *       200:
 *         description: Loyalty tier retrieved successfully
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
 *   put:
 *     summary: Update a loyalty tier
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tierId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tier ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               level:
 *                 type: number
 *               pointsThreshold:
 *                 type: number
 *               benefits:
 *                 type: array
 *                 items:
 *                   type: string
 *               discountPercentage:
 *                 type: number
 *               active:
 *                 type: boolean
 *               color:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       200:
 *         description: Loyalty tier updated successfully
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
 *   delete:
 *     summary: Delete a loyalty tier
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tierId
 *         required: true
 *         schema:
 *           type: string
 *         description: Tier ID
 *     responses:
 *       200:
 *         description: Loyalty tier deleted successfully
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
router.get("/tiers/:tierId", adminLoyaltyController.getLoyaltyTierById)
router.put("/tiers/:tierId", validate(updateLoyaltyTierSchema), adminLoyaltyController.updateLoyaltyTier)
router.delete("/tiers/:tierId", adminLoyaltyController.deleteLoyaltyTier)

/**
 * @swagger
 * /admin/loyalty/rewards:
 *   get:
 *     summary: Get all rewards
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *         description: Filter by required tier
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
 *         description: Rewards retrieved successfully
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
 *                     rewards:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 *                     pagination:
 *                       type: object
 *   post:
 *     summary: Create a reward
 *     tags: [Admin Loyalty]
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
 *               - description
 *               - pointsCost
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               pointsCost:
 *                 type: number
 *               requiredTier:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [discount, freeProduct, freeShipping, giftCard, other]
 *               value:
 *                 type: number
 *               code:
 *                 type: string
 *               active:
 *                 type: boolean
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               limitPerCustomer:
 *                 type: number
 *               limitTotal:
 *                 type: number
 *               redemptionExpiryDays:
 *                 type: number
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reward created successfully
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
router.get("/rewards", adminLoyaltyController.getAllRewards)
router.post("/rewards", validate(createRewardSchema), adminLoyaltyController.createReward)

/**
 * @swagger
 * /admin/loyalty/rewards/{rewardId}:
 *   get:
 *     summary: Get reward by ID
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reward ID
 *     responses:
 *       200:
 *         description: Reward retrieved successfully
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
 *   put:
 *     summary: Update a reward
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reward ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               pointsCost:
 *                 type: number
 *               requiredTier:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [discount, freeProduct, freeShipping, giftCard, other]
 *               value:
 *                 type: number
 *               code:
 *                 type: string
 *               active:
 *                 type: boolean
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               limitPerCustomer:
 *                 type: number
 *               limitTotal:
 *                 type: number
 *               redemptionExpiryDays:
 *                 type: number
 *               image:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reward updated successfully
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
 *   delete:
 *     summary: Delete a reward
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rewardId
 *         required: true
 *         schema:
 *           type: string
 *         description: Reward ID
 *     responses:
 *       200:
 *         description: Reward deleted successfully
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
router.get("/rewards/:rewardId", adminLoyaltyController.getRewardById)
router.put("/rewards/:rewardId", validate(updateRewardSchema), adminLoyaltyController.updateReward)
router.delete("/rewards/:rewardId", adminLoyaltyController.deleteReward)

/**
 * @swagger
 * /admin/loyalty/programs:
 *   get:
 *     summary: Get all loyalty programs
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *         description: Filter by tier
 *       - in: query
 *         name: minPoints
 *         schema:
 *           type: number
 *         description: Filter by minimum points
 *       - in: query
 *         name: maxPoints
 *         schema:
 *           type: number
 *         description: Filter by maximum points
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -points
 *         description: Sort field and direction (prefix with - for descending)
 *     responses:
 *       200:
 *         description: Loyalty programs retrieved successfully
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
 *                     programs:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 *                     pagination:
 *                       type: object
 */
router.get("/programs", adminLoyaltyController.getAllLoyaltyPrograms)

/**
 * @swagger
 * /admin/loyalty/programs/{userId}:
 *   get:
 *     summary: Get loyalty program by user ID
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: Loyalty program retrieved successfully
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
router.get("/programs/:userId", adminLoyaltyController.getLoyaltyProgramByUserId)

/**
 * @swagger
 * /admin/loyalty/redemptions:
 *   get:
 *     summary: Get all redemptions
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, used, expired]
 *         description: Filter by status
 *       - in: query
 *         name: reward
 *         schema:
 *           type: string
 *         description: Filter by reward ID
 *       - in: query
 *         name: user
 *         schema:
 *           type: string
 *         description: Filter by user ID
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
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -createdAt
 *         description: Sort field and direction (prefix with - for descending)
 *     responses:
 *       200:
 *         description: Redemptions retrieved successfully
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
 *                     redemptions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 *                     pagination:
 *                       type: object
 */
router.get("/redemptions", adminLoyaltyController.getAllRedemptions)

/**
 * @swagger
 * /admin/loyalty/redemptions/{redemptionId}:
 *   get:
 *     summary: Get redemption by ID
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: redemptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Redemption ID
 *     responses:
 *       200:
 *         description: Redemption retrieved successfully
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
 *   put:
 *     summary: Update redemption status
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: redemptionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Redemption ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, approved, rejected, used, expired]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Redemption status updated successfully
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
router.get("/redemptions/:redemptionId", adminLoyaltyController.getRedemptionById)
router.put(
  "/redemptions/:redemptionId",
  validate(updateRedemptionStatusSchema),
  adminLoyaltyController.updateRedemptionStatus,
)

/**
 * @swagger
 * /admin/loyalty/points/adjust:
 *   post:
 *     summary: Adjust customer points
 *     tags: [Admin Loyalty]
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
 *               - points
 *               - reason
 *             properties:
 *               userId:
 *                 type: string
 *               points:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Points adjusted successfully
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
router.post("/points/adjust", validate(adjustCustomerPointsSchema), adminLoyaltyController.adjustCustomerPoints)

/**
 * @swagger
 * /admin/loyalty/statistics:
 *   get:
 *     summary: Get loyalty program statistics
 *     tags: [Admin Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty program statistics retrieved successfully
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
router.get("/statistics", adminLoyaltyController.getLoyaltyStatistics)

export default router
