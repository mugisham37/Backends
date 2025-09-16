import nodemailer from "nodemailer"
import fs from "fs"
import path from "path"
import Handlebars from "handlebars"
import { createRequestLogger } from "../config/logger"
import { translateEmail } from "../utils/translate"
import { ApiError } from "../utils/api-error"
import redisClient from "../config/redis"

// Email templates directory
const TEMPLATES_DIR = path.join(process.cwd(), "src/templates")

// Email queue key in Redis
const EMAIL_QUEUE_KEY = "email:queue"

// Email types
export enum EmailType {
  WELCOME = "welcome",
  ORDER_CONFIRMATION = "order-confirmation",
  ORDER_SHIPPED = "order-shipped",
  ORDER_DELIVERED = "order-delivered",
  PASSWORD_RESET = "password-reset",
  REVIEW_REQUEST = "review-request",
}

// Email template interface
interface EmailTemplate {
  subject: string
  html: string
}

// Email data interface
interface EmailData {
  to: string
  subject: string
  html: string
  from?: string
  cc?: string
  bcc?: string
  attachments?: any[]
}

// Email queue item interface
interface EmailQueueItem {
  id: string
  data: EmailData
  attempts: number
  createdAt: string
}

/**
 * Create email transport
 * @returns Nodemailer transport
 */
const createTransport = () => {
  // Check if we're using SMTP or a service like SendGrid
  if (process.env.EMAIL_PROVIDER === "smtp") {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })
  } else {
    // Default to SendGrid
    return nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "SendGrid",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    })
  }
}

/**
 * Load email template
 * @param templateName Template name
 * @param language Language code
 * @returns Email template
 */
const loadTemplate = async (templateName: string, language = "en"): Promise<EmailTemplate> => {
  try {
    // Check if template exists
    const templatePath = path.join(TEMPLATES_DIR, `${templateName}.html`)
    if (!fs.existsSync(templatePath)) {
      throw new ApiError(`Email template not found: ${templateName}`, 500)
    }

    // Read template file
    const templateContent = fs.readFileSync(templatePath, "utf-8")

    // Compile template
    const template = Handlebars.compile(templateContent)

    // Get subject from translations
    const subject = translateEmail(`${templateName}.subject`, {}, language)

    return {
      subject,
      html: template,
    }
  } catch (error) {
    throw new ApiError(`Failed to load email template: ${error.message}`, 500)
  }
}

/**
 * Send email
 * @param to Recipient email
 * @param subject Email subject
 * @param html Email HTML content
 * @param options Additional email options
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  options: {
    from?: string
    cc?: string
    bcc?: string
    attachments?: any[]
  } = {},
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending email to: ${to}, subject: ${subject}`)

  try {
    const transport = createTransport()

    const mailOptions = {
      from: options.from || process.env.EMAIL_FROM || "noreply@example.com",
      to,
      subject,
      html,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
    }

    const result = await transport.sendMail(mailOptions)
    logger.info(`Email sent successfully to: ${to}, messageId: ${result.messageId}`)

    return result
  } catch (error) {
    logger.error(`Failed to send email: ${error.message}`)
    throw new ApiError(`Failed to send email: ${error.message}`, 500)
  }
}

/**
 * Queue email for sending
 * @param to Recipient email
 * @param subject Email subject
 * @param html Email HTML content
 * @param options Additional email options
 * @param requestId Request ID for logging
 * @returns Email queue ID
 */
export const queueEmail = async (
  to: string,
  subject: string,
  html: string,
  options: {
    from?: string
    cc?: string
    bcc?: string
    attachments?: any[]
  } = {},
  requestId?: string,
): Promise<string> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Queueing email to: ${to}, subject: ${subject}`)

  try {
    // Create email data
    const emailData: EmailData = {
      to,
      subject,
      html,
      from: options.from || process.env.EMAIL_FROM || "noreply@example.com",
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
    }

    // Create queue item
    const queueItem: EmailQueueItem = {
      id: `email_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
      data: emailData,
      attempts: 0,
      createdAt: new Date().toISOString(),
    }

    // Add to queue
    await redisClient.lPush(EMAIL_QUEUE_KEY, JSON.stringify(queueItem))
    logger.info(`Email queued successfully, id: ${queueItem.id}`)

    return queueItem.id
  } catch (error) {
    logger.error(`Failed to queue email: ${error.message}`)
    throw new ApiError(`Failed to queue email: ${error.message}`, 500)
  }
}

/**
 * Process email queue
 * @param limit Number of emails to process
 * @param requestId Request ID for logging
 * @returns Number of emails processed
 */
export const processEmailQueue = async (limit = 10, requestId?: string): Promise<number> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Processing email queue, limit: ${limit}`)

  let processed = 0

  try {
    // Process emails up to the limit
    for (let i = 0; i < limit; i++) {
      // Get next email from queue
      const queueItemJson = await redisClient.rPop(EMAIL_QUEUE_KEY)

      // If queue is empty, stop processing
      if (!queueItemJson) {
        logger.info(`Email queue is empty, processed: ${processed}`)
        break
      }

      // Parse queue item
      const queueItem: EmailQueueItem = JSON.parse(queueItemJson)
      logger.info(`Processing email from queue, id: ${queueItem.id}`)

      try {
        // Send email
        await sendEmail(
          queueItem.data.to,
          queueItem.data.subject,
          queueItem.data.html,
          {
            from: queueItem.data.from,
            cc: queueItem.data.cc,
            bcc: queueItem.data.bcc,
            attachments: queueItem.data.attachments,
          },
          requestId,
        )

        // Increment processed count
        processed++
      } catch (error) {
        logger.error(`Failed to process email from queue, id: ${queueItem.id}, error: ${error.message}`)

        // Increment attempts
        queueItem.attempts++

        // If max attempts reached, log and continue
        if (queueItem.attempts >= 3) {
          logger.error(`Max attempts reached for email, id: ${queueItem.id}, dropping from queue`)
        } else {
          // Otherwise, add back to queue
          logger.info(`Re-queueing email, id: ${queueItem.id}, attempts: ${queueItem.attempts}`)
          await redisClient.lPush(EMAIL_QUEUE_KEY, JSON.stringify(queueItem))
        }
      }
    }

    logger.info(`Email queue processing completed, processed: ${processed}`)
    return processed
  } catch (error) {
    logger.error(`Error processing email queue: ${error.message}`)
    throw new ApiError(`Error processing email queue: ${error.message}`, 500)
  }
}

/**
 * Get email queue length
 * @param requestId Request ID for logging
 * @returns Queue length
 */
export const getEmailQueueLength = async (requestId?: string): Promise<number> => {
  const logger = createRequestLogger(requestId)

  try {
    const length = await redisClient.lLen(EMAIL_QUEUE_KEY)
    logger.info(`Email queue length: ${length}`)
    return length
  } catch (error) {
    logger.error(`Error getting email queue length: ${error.message}`)
    throw new ApiError(`Error getting email queue length: ${error.message}`, 500)
  }
}

/**
 * Clear email queue
 * @param requestId Request ID for logging
 * @returns Number of emails removed
 */
export const clearEmailQueue = async (requestId?: string): Promise<number> => {
  const logger = createRequestLogger(requestId)
  logger.info("Clearing email queue")

  try {
    const length = await redisClient.lLen(EMAIL_QUEUE_KEY)
    await redisClient.del(EMAIL_QUEUE_KEY)
    logger.info(`Email queue cleared, removed: ${length}`)
    return length
  } catch (error) {
    logger.error(`Error clearing email queue: ${error.message}`)
    throw new ApiError(`Error clearing email queue: ${error.message}`, 500)
  }
}

/**
 * Send welcome email
 * @param to Recipient email
 * @param data Template data
 * @param language Language code
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendWelcomeEmail = async (
  to: string,
  data: {
    firstName: string
    storeName: string
    year: number
    storeUrl: string
  },
  language = "en",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending welcome email to: ${to}`)

  try {
    // Load template
    const template = await loadTemplate(EmailType.WELCOME, language)

    // Compile template with data
    const html = template.html({
      ...data,
      welcomeMessage: translateEmail("welcome.message", {}, language),
      benefits: translateEmail("welcome.benefits", {}, language),
      benefit1: translateEmail("welcome.benefit1", {}, language),
      benefit2: translateEmail("welcome.benefit2", {}, language),
      benefit3: translateEmail("welcome.benefit3", {}, language),
      benefit4: translateEmail("welcome.benefit4", {}, language),
      support: translateEmail("welcome.support", {}, language),
      cta: translateEmail("welcome.cta", {}, language),
    })

    // Get subject from translations
    const subject = translateEmail("welcome.subject", { storeName: data.storeName }, language)

    // Queue email
    return queueEmail(to, subject, html, {}, requestId)
  } catch (error) {
    logger.error(`Failed to send welcome email: ${error.message}`)
    throw error
  }
}

/**
 * Send order confirmation email
 * @param to Recipient email
 * @param data Template data
 * @param language Language code
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendOrderConfirmationEmail = async (
  to: string,
  data: {
    firstName: string
    orderId: string
    orderDate: string
    orderItems: any[]
    subtotal: number
    tax: number
    shipping: number
    total: number
    shippingAddress: any
    orderUrl: string
    storeName: string
    year: number
  },
  language = "en",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending order confirmation email to: ${to}, order ID: ${data.orderId}`)

  try {
    // Load template
    const template = await loadTemplate(EmailType.ORDER_CONFIRMATION, language)

    // Compile template with data
    const html = template.html({
      ...data,
      greeting: translateEmail("orderConfirmation.greeting", { firstName: data.firstName }, language),
      message: translateEmail("orderConfirmation.message", {}, language),
      orderDetails: translateEmail("orderConfirmation.orderDetails", {}, language),
      orderNumber: translateEmail("orderConfirmation.orderNumber", {}, language),
      orderDate: translateEmail("orderConfirmation.orderDate", {}, language),
      itemsOrdered: translateEmail("orderConfirmation.itemsOrdered", {}, language),
      product: translateEmail("orderConfirmation.product", {}, language),
      quantity: translateEmail("orderConfirmation.quantity", {}, language),
      price: translateEmail("orderConfirmation.price", {}, language),
      total: translateEmail("orderConfirmation.total", {}, language),
      subtotal: translateEmail("orderConfirmation.subtotal", {}, language),
      tax: translateEmail("orderConfirmation.tax", {}, language),
      shipping: translateEmail("orderConfirmation.shipping", {}, language),
      totalAmount: translateEmail("orderConfirmation.totalAmount", {}, language),
      shippingAddress: translateEmail("orderConfirmation.shippingAddress", {}, language),
      trackingMessage: translateEmail("orderConfirmation.trackingMessage", {}, language),
      cta: translateEmail("orderConfirmation.cta", {}, language),
    })

    // Get subject from translations
    const subject = translateEmail("orderConfirmation.subject", { orderId: data.orderId }, language)

    // Queue email
    return queueEmail(to, subject, html, {}, requestId)
  } catch (error) {
    logger.error(`Failed to send order confirmation email: ${error.message}`)
    throw error
  }
}

/**
 * Send order shipped email
 * @param to Recipient email
 * @param data Template data
 * @param language Language code
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendOrderShippedEmail = async (
  to: string,
  data: {
    firstName: string
    orderId: string
    trackingNumber: string
    estimatedDelivery: string
    trackingUrl: string
    orderUrl: string
    storeName: string
    year: number
  },
  language = "en",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending order shipped email to: ${to}, order ID: ${data.orderId}`)

  try {
    // Load template
    const template = await loadTemplate(EmailType.ORDER_SHIPPED, language)

    // Compile template with data
    const html = template.html({
      ...data,
      greeting: translateEmail("orderShipped.greeting", { firstName: data.firstName }, language),
      message: translateEmail("orderShipped.message", { orderId: data.orderId }, language),
      trackingInfo: translateEmail("orderShipped.trackingInfo", {}, language),
      trackingNumber: translateEmail("orderShipped.trackingNumber", {}, language),
      estimatedDelivery: translateEmail("orderShipped.estimatedDelivery", {}, language),
      trackingMessage: translateEmail("orderShipped.trackingMessage", {}, language),
      trackCta: translateEmail("orderShipped.trackCta", {}, language),
      support: translateEmail("orderShipped.support", {}, language),
      cta: translateEmail("orderShipped.cta", {}, language),
    })

    // Get subject from translations
    const subject = translateEmail("orderShipped.subject", { orderId: data.orderId }, language)

    // Queue email
    return queueEmail(to, subject, html, {}, requestId)
  } catch (error) {
    logger.error(`Failed to send order shipped email: ${error.message}`)
    throw error
  }
}

/**
 * Send order delivered email
 * @param to Recipient email
 * @param data Template data
 * @param language Language code
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendOrderDeliveredEmail = async (
  to: string,
  data: {
    firstName: string
    orderId: string
    reviewUrl: string
    orderUrl: string
    storeName: string
    year: number
  },
  language = "en",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending order delivered email to: ${to}, order ID: ${data.orderId}`)

  try {
    // Load template
    const template = await loadTemplate(EmailType.ORDER_DELIVERED, language)

    // Compile template with data
    const html = template.html({
      ...data,
      greeting: translateEmail("orderDelivered.greeting", { firstName: data.firstName }, language),
      message: translateEmail("orderDelivered.message", { orderId: data.orderId }, language),
      support: translateEmail("orderDelivered.support", {}, language),
      feedback: translateEmail("orderDelivered.feedback", {}, language),
      feedbackMessage: translateEmail("orderDelivered.feedbackMessage", {}, language),
      reviewCta: translateEmail("orderDelivered.reviewCta", {}, language),
      orderCta: translateEmail("orderDelivered.orderCta", {}, language),
      thanks: translateEmail("orderDelivered.thanks", {}, language),
    })

    // Get subject from translations
    const subject = translateEmail("orderDelivered.subject", { orderId: data.orderId }, language)

    // Queue email
    return queueEmail(to, subject, html, {}, requestId)
  } catch (error) {
    logger.error(`Failed to send order delivered email: ${error.message}`)
    throw error
  }
}

/**
 * Send password reset email
 * @param to Recipient email
 * @param data Template data
 * @param language Language code
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendPasswordResetEmail = async (
  to: string,
  data: {
    firstName: string
    resetUrl: string
    expiryTime: string
    storeName: string
    year: number
  },
  language = "en",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending password reset email to: ${to}`)

  try {
    // Load template
    const template = await loadTemplate(EmailType.PASSWORD_RESET, language)

    // Compile template with data
    const html = template.html({
      ...data,
      greeting: translateEmail("passwordReset.greeting", { firstName: data.firstName }, language),
      message: translateEmail("passwordReset.message", {}, language),
      instruction: translateEmail("passwordReset.instruction", { expiryTime: data.expiryTime }, language),
      cta: translateEmail("passwordReset.cta", {}, language),
      warning: translateEmail("passwordReset.warning", {}, language),
      alternative: translateEmail("passwordReset.alternative", {}, language),
    })

    // Get subject from translations
    const subject = translateEmail("passwordReset.subject", {}, language)

    // Send email immediately (don't queue password reset emails)
    return sendEmail(to, subject, html, {}, requestId)
  } catch (error) {
    logger.error(`Failed to send password reset email: ${error.message}`)
    throw error
  }
}

/**
 * Send review request email
 * @param to Recipient email
 * @param data Template data
 * @param language Language code
 * @param requestId Request ID for logging
 * @returns Email send result
 */
export const sendReviewRequestEmail = async (
  to: string,
  data: {
    firstName: string
    orderId: string
    items: Array<{
      name: string
      image: string
      reviewUrl: string
    }>
    orderUrl: string
    storeName: string
    year: number
  },
  language = "en",
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info(`Sending review request email to: ${to}, order ID: ${data.orderId}`)

  try {
    // Load template
    const template = await loadTemplate(EmailType.REVIEW_REQUEST, language)

    // Compile template with data
    const html = template.html({
      ...data,
      greeting: translateEmail("reviewRequest.greeting", { firstName: data.firstName }, language),
      message: translateEmail("reviewRequest.message", {}, language),
      feedback: translateEmail("reviewRequest.feedback", {}, language),
      recentPurchase: translateEmail("reviewRequest.recentPurchase", { orderId: data.orderId }, language),
      reviewCta: translateEmail("reviewRequest.reviewCta", {}, language),
      orderCta: translateEmail("reviewRequest.orderCta", {}, language),
      thanks: translateEmail("reviewRequest.thanks", {}, language),
    })

    // Get subject from translations
    const subject = translateEmail("reviewRequest.subject", {}, language)

    // Queue email
    return queueEmail(to, subject, html, {}, requestId)
  } catch (error) {
    logger.error(`Failed to send review request email: ${error.message}`)
    throw error
  }
}
