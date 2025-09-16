import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { createRequestLogger } from "../config/logger";
import * as emailService from "../services/email.service";

/**
 * Process email queue
 * @route POST /api/v1/email/process-queue
 * @access Protected (Admin)
 */
export const processEmailQueue = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Processing email queue");

  const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 10;

  const processed = await emailService.processEmailQueue(limit, req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      processed,
    },
  });
});

/**
 * Get email queue length
 * @route GET /api/v1/email/queue-length
 * @access Protected (Admin)
 */
export const getEmailQueueLength = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Getting email queue length");

  const length = await emailService.getEmailQueueLength(req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      length,
    },
  });
});

/**
 * Clear email queue
 * @route DELETE /api/v1/email/clear-queue
 * @access Protected (Admin)
 */
export const clearEmailQueue = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id);
  requestLogger.info("Clearing email queue");

  const removed = await emailService.clearEmailQueue(req.id);

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      removed,
    },
  });
});

/**
 * Send test email
 * @route POST /api/v1/email/test
 * @access Protected (Admin)
 */
export const sendTestEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending test email");

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return next(new ApiError("Missing required fields: to, subject, html", 400));
    }

    const result = await emailService.sendEmail(to, subject, html, {}, req.id);

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        messageId: result.messageId,
      },
    });
  }
);

/**
 * Send welcome email
 * @route POST /api/v1/email/welcome
 * @access Protected (Admin)
 */
export const sendWelcomeEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending welcome email");

    const { to, firstName, storeName, storeUrl } = req.body;
    const language = (req.query.language as string) || req.language || "en";

    if (!to || !firstName || !storeName || !storeUrl) {
      return next(new ApiError("Missing required fields: to, firstName, storeName, storeUrl", 400));
    }

    const result = await emailService.sendWelcomeEmail(
      to,
      {
        firstName,
        storeName,
        year: new Date().getFullYear(),
        storeUrl,
      },
      language,
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        queueId: result,
      },
    });
  }
);

/**
 * Send order confirmation email
 * @route POST /api/v1/email/order-confirmation
 * @access Protected (Admin)
 */
export const sendOrderConfirmationEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending order confirmation email");

    const {
      to,
      firstName,
      orderId,
      orderDate,
      orderItems,
      subtotal,
      tax,
      shipping,
      total,
      shippingAddress,
      orderUrl,
      storeName,
    } = req.body;
    const language = (req.query.language as string) || req.language || "en";

    if (
      !to ||
      !firstName ||
      !orderId ||
      !orderDate ||
      !orderItems ||
      !subtotal ||
      !tax ||
      !shipping ||
      !total ||
      !shippingAddress ||
      !orderUrl ||
      !storeName
    ) {
      return next(new ApiError("Missing required fields", 400));
    }

    const result = await emailService.sendOrderConfirmationEmail(
      to,
      {
        firstName,
        orderId,
        orderDate,
        orderItems,
        subtotal,
        tax,
        shipping,
        total,
        shippingAddress,
        orderUrl,
        storeName,
        year: new Date().getFullYear(),
      },
      language,
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        queueId: result,
      },
    });
  }
);

/**
 * Send order shipped email
 * @route POST /api/v1/email/order-shipped
 * @access Protected (Admin)
 */
export const sendOrderShippedEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending order shipped email");

    const {
      to,
      firstName,
      orderId,
      trackingNumber,
      estimatedDelivery,
      trackingUrl,
      orderUrl,
      storeName,
    } = req.body;
    const language = (req.query.language as string) || req.language || "en";

    if (
      !to ||
      !firstName ||
      !orderId ||
      !trackingNumber ||
      !estimatedDelivery ||
      !trackingUrl ||
      !orderUrl ||
      !storeName
    ) {
      return next(new ApiError("Missing required fields", 400));
    }

    const result = await emailService.sendOrderShippedEmail(
      to,
      {
        firstName,
        orderId,
        trackingNumber,
        estimatedDelivery,
        trackingUrl,
        orderUrl,
        storeName,
        year: new Date().getFullYear(),
      },
      language,
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        queueId: result,
      },
    });
  }
);

/**
 * Send order delivered email
 * @route POST /api/v1/email/order-delivered
 * @access Protected (Admin)
 */
export const sendOrderDeliveredEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending order delivered email");

    const { to, firstName, orderId, reviewUrl, orderUrl, storeName } = req.body;
    const language = (req.query.language as string) || req.language || "en";

    if (!to || !firstName || !orderId || !reviewUrl || !orderUrl || !storeName) {
      return next(new ApiError("Missing required fields", 400));
    }

    const result = await emailService.sendOrderDeliveredEmail(
      to,
      {
        firstName,
        orderId,
        reviewUrl,
        orderUrl,
        storeName,
        year: new Date().getFullYear(),
      },
      language,
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        queueId: result,
      },
    });
  }
);

/**
 * Send password reset email
 * @route POST /api/v1/email/password-reset
 * @access Protected (Admin)
 */
export const sendPasswordResetEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending password reset email");

    const { to, firstName, resetUrl, expiryTime, storeName } = req.body;
    const language = (req.query.language as string) || req.language || "en";

    if (!to || !firstName || !resetUrl || !expiryTime || !storeName) {
      return next(new ApiError("Missing required fields", 400));
    }

    const result = await emailService.sendPasswordResetEmail(
      to,
      {
        firstName,
        resetUrl,
        expiryTime,
        storeName,
        year: new Date().getFullYear(),
      },
      language,
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        messageId: result.messageId,
      },
    });
  }
);

/**
 * Send review request email
 * @route POST /api/v1/email/review-request
 * @access Protected (Admin)
 */
export const sendReviewRequestEmail = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    requestLogger.info("Sending review request email");

    const { to, firstName, orderId, items, orderUrl, storeName } = req.body;
    const language = (req.query.language as string) || req.language || "en";

    if (!to || !firstName || !orderId || !items || !orderUrl || !storeName) {
      return next(new ApiError("Missing required fields", 400));
    }

    const result = await emailService.sendReviewRequestEmail(
      to,
      {
        firstName,
        orderId,
        items,
        orderUrl,
        storeName,
        year: new Date().getFullYear(),
      },
      language,
      req.id
    );

    res.status(200).json({
      status: "success",
      requestId: req.id,
      data: {
        queueId: result,
      },
    });
  }
);
