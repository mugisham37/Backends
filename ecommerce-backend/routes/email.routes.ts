import { Router } from "express";
import * as emailController from "../controllers/email.controller";
import { authenticate, authorize } from "../middleware/auth.middleware";

const router = Router();

// All routes require admin authentication
router.use(authenticate, authorize(["admin", "superadmin"]));

/**
 * @swagger
 * /email/process-queue:
 *   post:
 *     summary: Process email queue
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of emails to process
 *     responses:
 *       200:
 *         description: Email queue processed successfully
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
 *                     processed:
 *                       type: integer
 *                       example: 5
 */
router.post("/process-queue", emailController.processEmailQueue);

/**
 * @swagger
 * /email/queue-length:
 *   get:
 *     summary: Get email queue length
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email queue length retrieved successfully
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
 *                     length:
 *                       type: integer
 *                       example: 10
 */
router.get("/queue-length", emailController.getEmailQueueLength);

/**
 * @swagger
 * /email/clear-queue:
 *   delete:
 *     summary: Clear email queue
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Email queue cleared successfully
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
 *                     removed:
 *                       type: integer
 *                       example: 10
 */
router.delete("/clear-queue", emailController.clearEmailQueue);

/**
 * @swagger
 * /email/test:
 *   post:
 *     summary: Send test email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - subject
 *               - html
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               subject:
 *                 type: string
 *                 example: Test Email
 *               html:
 *                 type: string
 *                 example: <p>This is a test email</p>
 *     responses:
 *       200:
 *         description: Test email sent successfully
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
 *                     messageId:
 *                       type: string
 *                       example: <123456789@example.com>
 */
router.post("/test", emailController.sendTestEmail);

/**
 * @swagger
 * /email/welcome:
 *   post:
 *     summary: Send welcome email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Email language
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - storeName
 *               - storeUrl
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               storeName:
 *                 type: string
 *                 example: My Store
 *               storeUrl:
 *                 type: string
 *                 example: https://example.com
 *     responses:
 *       200:
 *         description: Welcome email queued successfully
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
 *                     queueId:
 *                       type: string
 *                       example: email_1234567890_abc123
 */
router.post("/welcome", emailController.sendWelcomeEmail);

/**
 * @swagger
 * /email/order-confirmation:
 *   post:
 *     summary: Send order confirmation email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Email language
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - orderId
 *               - orderDate
 *               - orderItems
 *               - subtotal
 *               - tax
 *               - shipping
 *               - total
 *               - shippingAddress
 *               - orderUrl
 *               - storeName
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               orderId:
 *                 type: string
 *                 example: ORD12345
 *               orderDate:
 *                 type: string
 *                 example: 2023-01-01T12:00:00Z
 *               orderItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Product Name
 *                     price:
 *                       type: number
 *                       example: 99.99
 *                     quantity:
 *                       type: number
 *                       example: 1
 *                     image:
 *                       type: string
 *                       example: product.jpg
 *               subtotal:
 *                 type: number
 *                 example: 99.99
 *               tax:
 *                 type: number
 *                 example: 10.00
 *               shipping:
 *                 type: number
 *                 example: 5.00
 *               total:
 *                 type: number
 *                 example: 114.99
 *               shippingAddress:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                     example: 123 Main St
 *                   city:
 *                     type: string
 *                     example: New York
 *                   state:
 *                     type: string
 *                     example: NY
 *                   postalCode:
 *                     type: string
 *                     example: 10001
 *                   country:
 *                     type: string
 *                     example: USA
 *               orderUrl:
 *                 type: string
 *                 example: https://example.com/orders/ORD12345
 *               storeName:
 *                 type: string
 *                 example: My Store
 *     responses:
 *       200:
 *         description: Order confirmation email queued successfully
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
 *                     queueId:
 *                       type: string
 *                       example: email_1234567890_abc123
 */
router.post("/order-confirmation", emailController.sendOrderConfirmationEmail);

/**
 * @swagger
 * /email/order-shipped:
 *   post:
 *     summary: Send order shipped email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Email language
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - orderId
 *               - trackingNumber
 *               - estimatedDelivery
 *               - trackingUrl
 *               - orderUrl
 *               - storeName
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               orderId:
 *                 type: string
 *                 example: ORD12345
 *               trackingNumber:
 *                 type: string
 *                 example: TRK12345
 *               estimatedDelivery:
 *                 type: string
 *                 example: January 10, 2023
 *               trackingUrl:
 *                 type: string
 *                 example: https://example.com/track/TRK12345
 *               orderUrl:
 *                 type: string
 *                 example: https://example.com/orders/ORD12345
 *               storeName:
 *                 type: string
 *                 example: My Store
 *     responses:
 *       200:
 *         description: Order shipped email queued successfully
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
 *                     queueId:
 *                       type: string
 *                       example: email_1234567890_abc123
 */
router.post("/order-shipped", emailController.sendOrderShippedEmail);

/**
 * @swagger
 * /email/order-delivered:
 *   post:
 *     summary: Send order delivered email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Email language
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - orderId
 *               - reviewUrl
 *               - orderUrl
 *               - storeName
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               orderId:
 *                 type: string
 *                 example: ORD12345
 *               reviewUrl:
 *                 type: string
 *                 example: https://example.com/review/ORD12345
 *               orderUrl:
 *                 type: string
 *                 example: https://example.com/orders/ORD12345
 *               storeName:
 *                 type: string
 *                 example: My Store
 *     responses:
 *       200:
 *         description: Order delivered email queued successfully
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
 *                     queueId:
 *                       type: string
 *                       example: email_1234567890_abc123
 */
router.post("/order-delivered", emailController.sendOrderDeliveredEmail);

/**
 * @swagger
 * /email/password-reset:
 *   post:
 *     summary: Send password reset email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Email language
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - resetUrl
 *               - expiryTime
 *               - storeName
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               resetUrl:
 *                 type: string
 *                 example: https://example.com/reset-password?token=abc123
 *               expiryTime:
 *                 type: string
 *                 example: 1 hour
 *               storeName:
 *                 type: string
 *                 example: My Store
 *     responses:
 *       200:
 *         description: Password reset email sent successfully
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
 *                     messageId:
 *                       type: string
 *                       example: <123456789@example.com>
 */
router.post("/password-reset", emailController.sendPasswordResetEmail);

/**
 * @swagger
 * /email/review-request:
 *   post:
 *     summary: Send review request email
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *           default: en
 *         description: Email language
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to
 *               - firstName
 *               - orderId
 *               - items
 *               - orderUrl
 *               - storeName
 *             properties:
 *               to:
 *                 type: string
 *                 example: user@example.com
 *               firstName:
 *                 type: string
 *                 example: John
 *               orderId:
 *                 type: string
 *                 example: ORD12345
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: Product Name
 *                     image:
 *                       type: string
 *                       example: product.jpg
 *                     reviewUrl:
 *                       type: string
 *                       example: https://example.com/review/product/123
 *               orderUrl:
 *                 type: string
 *                 example: https://example.com/orders/ORD12345
 *               storeName:
 *                 type: string
 *                 example: My Store
 *     responses:
 *       200:
 *         description: Review request email queued successfully
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
 *                     queueId:
 *                       type: string
 *                       example: email_1234567890_abc123
 */
router.post("/review-request", emailController.sendReviewRequestEmail);

export default router;
