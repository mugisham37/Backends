import { Queue, Worker, Job } from "bullmq";
import { Redis } from "ioredis";
import { EmailService, EmailData, SendEmailOptions } from "./email.service.js";
import { AppError } from "../../core/errors/app-error.js";

export interface NotificationConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  queue: {
    name: string;
    defaultJobOptions?: {
      removeOnComplete?: number;
      removeOnFail?: number;
      attempts?: number;
      backoff?: {
        type: string;
        delay: number;
      };
    };
  };
}

export interface EmailJobData {
  templateName: string;
  data: EmailData;
  options: SendEmailOptions;
  priority?: number;
  delay?: number;
}

export interface BulkEmailJobData {
  templateName: string;
  recipients: Array<{
    email: string;
    data: EmailData;
  }>;
  commonOptions?: Partial<SendEmailOptions>;
  batchSize?: number;
}

export interface NotificationJobData {
  type: "email" | "sms" | "push" | "webhook";
  payload: any;
  userId?: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  private emailQueue: Queue<EmailJobData>;
  private bulkEmailQueue: Queue<BulkEmailJobData>;
  private notificationQueue: Queue<NotificationJobData>;
  private worker: Worker<EmailJobData>;
  private bulkWorker: Worker<BulkEmailJobData>;
  private notificationWorker: Worker<NotificationJobData>;
  private redis: Redis;

  constructor(
    private emailService: EmailService,
    private config: NotificationConfig
  ) {
    this.setupRedis();
    this.setupQueues();
    this.setupWorkers();
  }

  private setupRedis(): void {
    this.redis = new Redis({
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db || 0,
      maxRetriesPerRequest: 3,
    });
  }

  private setupQueues(): void {
    const connection = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db || 0,
    };

    this.emailQueue = new Queue<EmailJobData>(
      `${this.config.queue.name}:email`,
      {
        connection,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          ...this.config.queue.defaultJobOptions,
        },
      }
    );

    this.bulkEmailQueue = new Queue<BulkEmailJobData>(
      `${this.config.queue.name}:bulk-email`,
      {
        connection,
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 25,
          attempts: 2,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          ...this.config.queue.defaultJobOptions,
        },
      }
    );

    this.notificationQueue = new Queue<NotificationJobData>(
      `${this.config.queue.name}:notification`,
      {
        connection,
        defaultJobOptions: {
          removeOnComplete: 200,
          removeOnFail: 100,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          ...this.config.queue.defaultJobOptions,
        },
      }
    );
  }

  private setupWorkers(): void {
    const connection = {
      host: this.config.redis.host,
      port: this.config.redis.port,
      password: this.config.redis.password,
      db: this.config.redis.db || 0,
    };

    // Email worker
    this.worker = new Worker<EmailJobData>(
      `${this.config.queue.name}:email`,
      async (job: Job<EmailJobData>) => {
        const { templateName, data, options } = job.data;
        await this.emailService.sendEmail(templateName, data, options);
        return { success: true, sentAt: new Date().toISOString() };
      },
      {
        connection,
        concurrency: 5,
      }
    );

    // Bulk email worker
    this.bulkWorker = new Worker<BulkEmailJobData>(
      `${this.config.queue.name}:bulk-email`,
      async (job: Job<BulkEmailJobData>) => {
        const {
          templateName,
          recipients,
          commonOptions,
          batchSize = 10,
        } = job.data;

        // Process in batches to avoid overwhelming the email service
        const batches = this.chunkArray(recipients, batchSize);
        let processedCount = 0;

        for (const batch of batches) {
          await this.emailService.sendBulkEmails(
            templateName,
            batch,
            commonOptions
          );
          processedCount += batch.length;

          // Update job progress
          await job.updateProgress((processedCount / recipients.length) * 100);

          // Small delay between batches
          if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        return {
          success: true,
          processedCount,
          totalCount: recipients.length,
          sentAt: new Date().toISOString(),
        };
      },
      {
        connection,
        concurrency: 2,
      }
    );

    // General notification worker
    this.notificationWorker = new Worker<NotificationJobData>(
      `${this.config.queue.name}:notification`,
      async (job: Job<NotificationJobData>) => {
        const { type, payload, userId, metadata } = job.data;

        switch (type) {
          case "email":
            await this.emailService.sendEmail(
              payload.templateName,
              payload.data,
              payload.options
            );
            break;
          case "sms":
            // Implement SMS sending logic
            throw new AppError(
              "SMS notifications not implemented",
              501,
              "NOT_IMPLEMENTED"
            );
          case "push":
            // Implement push notification logic
            throw new AppError(
              "Push notifications not implemented",
              501,
              "NOT_IMPLEMENTED"
            );
          case "webhook":
            // Implement webhook logic
            throw new AppError(
              "Webhook notifications not implemented",
              501,
              "NOT_IMPLEMENTED"
            );
          default:
            throw new AppError(
              `Unknown notification type: ${type}`,
              400,
              "INVALID_TYPE"
            );
        }

        return {
          success: true,
          type,
          userId,
          metadata,
          processedAt: new Date().toISOString(),
        };
      },
      {
        connection,
        concurrency: 10,
      }
    );

    // Error handling
    this.worker.on("failed", (job, err) => {
      console.error(`Email job ${job?.id} failed:`, err);
    });

    this.bulkWorker.on("failed", (job, err) => {
      console.error(`Bulk email job ${job?.id} failed:`, err);
    });

    this.notificationWorker.on("failed", (job, err) => {
      console.error(`Notification job ${job?.id} failed:`, err);
    });
  }

  // Queue email for sending
  async queueEmail(
    templateName: string,
    data: EmailData,
    options: SendEmailOptions,
    jobOptions?: {
      priority?: number;
      delay?: number;
      attempts?: number;
    }
  ): Promise<string> {
    try {
      const job = await this.emailQueue.add(
        "send-email",
        { templateName, data, options },
        {
          priority: jobOptions?.priority || 0,
          delay: jobOptions?.delay || 0,
          attempts: jobOptions?.attempts || 3,
        }
      );

      return job.id!;
    } catch (error) {
      throw new AppError(
        `Failed to queue email: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "QUEUE_FAILED"
      );
    }
  }

  // Queue bulk emails
  async queueBulkEmails(
    templateName: string,
    recipients: Array<{
      email: string;
      data: EmailData;
    }>,
    commonOptions?: Partial<SendEmailOptions>,
    jobOptions?: {
      priority?: number;
      delay?: number;
      batchSize?: number;
    }
  ): Promise<string> {
    try {
      const job = await this.bulkEmailQueue.add(
        "send-bulk-emails",
        {
          templateName,
          recipients,
          commonOptions,
          batchSize: jobOptions?.batchSize || 10,
        },
        {
          priority: jobOptions?.priority || 0,
          delay: jobOptions?.delay || 0,
        }
      );

      return job.id!;
    } catch (error) {
      throw new AppError(
        `Failed to queue bulk emails: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "QUEUE_FAILED"
      );
    }
  }

  // Queue general notification
  async queueNotification(
    type: NotificationJobData["type"],
    payload: any,
    userId?: string,
    metadata?: Record<string, any>,
    jobOptions?: {
      priority?: number;
      delay?: number;
    }
  ): Promise<string> {
    try {
      const job = await this.notificationQueue.add(
        "send-notification",
        { type, payload, userId, metadata },
        {
          priority: jobOptions?.priority || 0,
          delay: jobOptions?.delay || 0,
        }
      );

      return job.id!;
    } catch (error) {
      throw new AppError(
        `Failed to queue notification: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "QUEUE_FAILED"
      );
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  // Convenience methods for common email types
  async queueWelcomeEmail(
    userEmail: string,
    userData: {
      firstName: string;
      lastName: string;
      activationUrl?: string;
    }
  ): Promise<string> {
    return this.queueEmail("welcome", userData, { to: userEmail });
  }

  async queuePasswordResetEmail(
    userEmail: string,
    resetData: {
      firstName: string;
      resetUrl: string;
      expiryTime: string;
    }
  ): Promise<string> {
    return this.queueEmail("password-reset", resetData, { to: userEmail });
  }

  async queueOrderConfirmationEmail(
    userEmail: string,
    orderData: {
      firstName: string;
      orderId: string;
      orderTotal: number;
      currency: string;
      items: Array<{
        name: string;
        quantity: number;
        price: number;
      }>;
      orderUrl: string;
    }
  ): Promise<string> {
    return this.queueEmail("order-confirmation", orderData, { to: userEmail });
  }

  // Queue management methods
  async getQueueStats(): Promise<{
    email: any;
    bulkEmail: any;
    notification: any;
  }> {
    const [emailStats, bulkEmailStats, notificationStats] = await Promise.all([
      this.emailQueue.getJobCounts(),
      this.bulkEmailQueue.getJobCounts(),
      this.notificationQueue.getJobCounts(),
    ]);

    return {
      email: emailStats,
      bulkEmail: bulkEmailStats,
      notification: notificationStats,
    };
  }

  async pauseQueues(): Promise<void> {
    await Promise.all([
      this.emailQueue.pause(),
      this.bulkEmailQueue.pause(),
      this.notificationQueue.pause(),
    ]);
  }

  async resumeQueues(): Promise<void> {
    await Promise.all([
      this.emailQueue.resume(),
      this.bulkEmailQueue.resume(),
      this.notificationQueue.resume(),
    ]);
  }

  async clearQueues(): Promise<void> {
    await Promise.all([
      this.emailQueue.drain(),
      this.bulkEmailQueue.drain(),
      this.notificationQueue.drain(),
    ]);
  }

  // Cleanup method
  async close(): Promise<void> {
    await Promise.all([
      this.worker.close(),
      this.bulkWorker.close(),
      this.notificationWorker.close(),
      this.emailQueue.close(),
      this.bulkEmailQueue.close(),
      this.notificationQueue.close(),
      this.redis.disconnect(),
    ]);
  }

  // Factory method
  static createFromEnv(emailService: EmailService): NotificationService {
    const config: NotificationConfig = {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
        db: Number(process.env.REDIS_DB) || 0,
      },
      queue: {
        name: process.env.QUEUE_NAME || "notifications",
        defaultJobOptions: {
          removeOnComplete: Number(process.env.QUEUE_REMOVE_ON_COMPLETE) || 100,
          removeOnFail: Number(process.env.QUEUE_REMOVE_ON_FAIL) || 50,
          attempts: Number(process.env.QUEUE_ATTEMPTS) || 3,
          backoff: {
            type: "exponential",
            delay: Number(process.env.QUEUE_BACKOFF_DELAY) || 2000,
          },
        },
      },
    };

    return new NotificationService(emailService, config);
  }
}
