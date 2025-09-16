import express from "express";
import * as loyaltyController from "../controllers/loyalty.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validate } from "../middleware/validate.middleware";
import { redeemRewardSchema, applyReferralCodeSchema } from "../validations/loyalty.validation";
import * as loyaltyDashboardController from "../controllers/loyaltyDashboard.controller";

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /loyalty/program:
 *   get:
 *     summary: Get customer loyalty program
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
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
 *                   properties:
 *                     _id:
 *                       type: string
 *                     user:
 *                       type: string
 *                     tier:
 *                       type: object
 *                     points:
 *                       type: number
 *                     lifetimePoints:
 *                       type: number
 *                     referralCode:
 *                       type: string
 *                     nextTier:
 *                       type: object
 *                       nullable: true
 *                     pointsForNextTier:
 *                       type: number
 *                       nullable: true
 *                     recentHistory:
 *                       type: array
 *                       items:
 *                         type: object
 *                     activeRedemptions:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get("/program", loyaltyController.getCustomerLoyaltyProgram);

/**
 * @swagger
 * /loyalty/tiers:
 *   get:
 *     summary: Get loyalty tiers
 *     tags: [Loyalty]
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
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       level:
 *                         type: number
 *                       pointsThreshold:
 *                         type: number
 *                       benefits:
 *                         type: array
 *                         items:
 *                           type: string
 *                       discountPercentage:
 *                         type: number
 *                       active:
 *                         type: boolean
 *                       color:
 *                         type: string
 */
router.get("/tiers", loyaltyController.getLoyaltyTiers);

/**
 * @swagger
 * /loyalty/rewards:
 *   get:
 *     summary: Get available rewards
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available rewards retrieved successfully
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
 *                     properties:
 *                       _id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       pointsCost:
 *                         type: number
 *                       type:
 *                         type: string
 *                       canRedeem:
 *                         type: boolean
 *                       pointsNeeded:
 *                         type: number
 */
router.get("/rewards", loyaltyController.getAvailableRewards);

/**
 * @swagger
 * /loyalty/rewards/{rewardId}:
 *   get:
 *     summary: Get reward details
 *     tags: [Loyalty]
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
 *         description: Reward details retrieved successfully
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
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     pointsCost:
 *                       type: number
 *                     type:
 *                       type: string
 */
router.get("/rewards/:rewardId", loyaltyController.getRewardById);

/**
 * @swagger
 * /loyalty/rewards/redeem:
 *   post:
 *     summary: Redeem a reward
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rewardId
 *             properties:
 *               rewardId:
 *                 type: string
 *                 description: ID of the reward to redeem
 *     responses:
 *       200:
 *         description: Reward redeemed successfully
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
 *                     _id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     status:
 *                       type: string
 *                     pointsUsed:
 *                       type: number
 *                     reward:
 *                       type: object
 */
router.post("/rewards/redeem", validate(redeemRewardSchema), loyaltyController.redeemReward);

/**
 * @swagger
 * /loyalty/history:
 *   get:
 *     summary: Get loyalty history
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Loyalty history retrieved successfully
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
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: number
 *                     pagination:
 *                       type: object
 */
router.get("/history", loyaltyController.getLoyaltyHistory);

/**
 * @swagger
 * /loyalty/redemptions:
 *   get:
 *     summary: Get customer redemptions
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Customer redemptions retrieved successfully
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
router.get("/redemptions", loyaltyController.getCustomerRedemptions);

/**
 * @swagger
 * /loyalty/redemptions/{redemptionId}:
 *   get:
 *     summary: Get redemption details
 *     tags: [Loyalty]
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
 *         description: Redemption details retrieved successfully
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
 *                     _id:
 *                       type: string
 *                     code:
 *                       type: string
 *                     status:
 *                       type: string
 *                     pointsUsed:
 *                       type: number
 *                     reward:
 *                       type: object
 */
router.get("/redemptions/:redemptionId", loyaltyController.getRedemptionById);

/**
 * @swagger
 * /loyalty/referral:
 *   get:
 *     summary: Get referral code
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Referral code retrieved successfully
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
 *                     referralCode:
 *                       type: string
 *                     referralCount:
 *                       type: number
 *                     referralUrl:
 *                       type: string
 */
router.get("/referral", loyaltyController.getReferralCode);

/**
 * @swagger
 * /loyalty/referral/apply:
 *   post:
 *     summary: Apply a referral code
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - referralCode
 *             properties:
 *               referralCode:
 *                 type: string
 *                 description: Referral code to apply
 *     responses:
 *       200:
 *         description: Referral code applied successfully
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
 *                     message:
 *                       type: string
 */
router.post(
  "/referral/apply",
  validate(applyReferralCodeSchema),
  loyaltyController.applyReferralCode
);

/**
 * @swagger
 * /loyalty/dashboard:
 *   get:
 *     summary: Get customer loyalty dashboard
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Loyalty dashboard retrieved successfully
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
router.get("/dashboard", loyaltyDashboardController.getCustomerLoyaltyDashboard);

/**
 * @swagger
 * /loyalty/statistics/{period}:
 *   get:
 *     summary: Get loyalty statistics by period
 *     tags: [Loyalty]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: period
 *         required: true
 *         schema:
 *           type: string
 *           enum: [week, month, year, all]
 *         description: Time period for statistics
 *     responses:
 *       200:
 *         description: Loyalty statistics retrieved successfully
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
router.get("/statistics/:period", loyaltyDashboardController.getLoyaltyStatisticsByPeriod);

export default router;
