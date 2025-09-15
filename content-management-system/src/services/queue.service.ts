import { injectable } from "tsyringe";
import { Queue, Worker, Job, QueueEvents } from "bullmq";
import Redis from "ioredis";
import type { Result } from "../core/types/result.types";
import { BaseError } from "../core/errors/base.error";
import { config } from "../config/index";
import { logger } from "../utils/logger";

/**
 * Queue-related errors
 */
export class QueueError extends BaseError {
  readonly code = "QUEUE_ERROR";
  readonly statusCode = 500;
}

export class JobNotFoundError extends BaseError {
  readonly code = "JOB_NOT_FOUND";
  readonly statusCode = 404;
}

/**
 * Job types and their data interfaces
 */
export interface WebhookJobData {
  webhookId: string;
  event: string;
  payload: any;
  url: string;
  secret?: string;
  attempt?: number;
}

export interface EmailJobData {
  to: string;
  subject: string;
  template: string;
  data: Record<string, any>;
}

export interface MediaProcessingJobData {
  mediaId: string;
  transformations: Array<{
    type: "resize" | "crop" | "compress";
    options: Record<string, any>;
  }>;
}

export type JobData = WebhookJobData | EmailJobData | MediaProcessingJobData;

export interface JobOptions {
  delay?: number;
  attempts?: number;
  backoff?: {
    type: "exponential" | "fixed";
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
  priority?: number;
}

/**
 * Background job processing service using Bull Queue with Redis
 * Provides job queue management, retry logic, failure handling, and monitoring
 */
@injectable()
export class QueueService {
  private redis: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private isConnected = false;

  // Default job options
  private readonly defaultJobOptions: JobOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 50,
    removeOnFail: 100,
  };

  constructor() {
    // Redis connection for Bull Queue
    this.redis = new Redis(config.redis.uri, {
      password: config.redis.password,
      db: config.redis.db + 2, // Use different DB for queues
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    this.setupEventHandlers();
    this.connect();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.redis.on("connect", () => {
      logger.info("Redis queue connection established");
      this.isConnected = true;
    });

    this.redis.on("error", (error) => {
      logger.error("Redis queue connection error:", error);
      this.isConnected = false;
    });

    this.redis.on("close", () => {
      logger.warn("Redis queue connection closed");
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  private async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      logger.error("Failed to connect to Redis for queues:", error);
    }
  }

  /**
   * Create or get a queue
   */
  private getQueue(queueName: string): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.redis,
        defaultJobOptions: {
          removeOnComplete: this.defaultJobOptions.removeOnComplete,
          removeOnFail: this.defaultJobOptions.removeOnFail,
        },
      });

      // Setup queue events
      const queueEvents = new QueueEvents(queueName, {
        connection: this.redis,
      });

      queueEvents.on("completed", ({ jobId, returnvalue }) => {
        logger.info(`Job ${jobId} completed in queue ${queueName}`, {
          returnvalue,
        });
      });

      queueEvents.on("failed", ({ jobId, failedReason }) => {
        logger.error(`Job ${jobId} failed in queue ${queueName}`, {
          failedReason,
        });
      });

      queueEvents.on("stalled", ({ jobId }) => {
        logger.warn(`Job ${jobId} stalled in queue ${queueName}`);
      });

      this.queues.set(queueName, queue);
      this.queueEvents.set(queueName, queueEvents);
    }

    return this.queues.get(queueName)!;
  }

  /**
   * Add a job to the queue
   */
  async addJob<T extends JobData>(
    queueName: string,
    jobName: string,
    data: T,
    options?: JobOptions
  ): Promise<Result<string, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      const jobOptions = { ...this.defaultJobOptions, ...options };

      const job = await queue.add(jobName, data, jobOptions);

      logger.info(`Job ${job.id} added to queue ${queueName}`, {
        jobName,
        jobId: job.id,
      });

      return { success: true, data: job.id! };
    } catch (error) {
      logger.error(`Failed to add job to queue ${queueName}:`, error);
      return {
        success: false,
        error: new QueueError("Failed to add job to queue"),
      };
    }
  }

  /**
   * Process jobs in a queue
   */
  async processJobs<T extends JobData>(
    queueName: string,
    processor: (job: Job<T>) => Promise<any>,
    concurrency: number = 1
  ): Promise<Result<void, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      // Check if worker already exists
      if (this.workers.has(queueName)) {
        logger.warn(`Worker for queue ${queueName} already exists`);
        return { success: true, data: undefined };
      }

      const worker = new Worker(
        queueName,
        async (job: Job<T>) => {
          logger.info(`Processing job ${job.id} in queue ${queueName}`, {
            jobName: job.name,
            attempt: job.attemptsMade + 1,
          });

          try {
            const result = await processor(job);
            logger.info(`Job ${job.id} processed successfully`, { result });
            return result;
          } catch (error) {
            logger.error(`Job ${job.id} processing failed:`, error);
            throw error;
          }
        },
        {
          connection: this.redis,
          concurrency,
        }
      );

      // Setup worker event handlers
      worker.on("completed", (job) => {
        logger.info(`Worker completed job ${job.id} in queue ${queueName}`);
      });

      worker.on("failed", (job, err) => {
        logger.error(
          `Worker failed job ${job?.id} in queue ${queueName}:`,
          err
        );
      });

      worker.on("error", (err) => {
        logger.error(`Worker error in queue ${queueName}:`, err);
      });

      this.workers.set(queueName, worker);

      logger.info(
        `Worker started for queue ${queueName} with concurrency ${concurrency}`
      );

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to start worker for queue ${queueName}:`, error);
      return {
        success: false,
        error: new QueueError("Failed to start queue worker"),
      };
    }
  }

  /**
   * Get job by ID
   */
  async getJob(
    queueName: string,
    jobId: string
  ): Promise<Result<Job | null, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      return { success: true, data: job };
    } catch (error) {
      logger.error(
        `Failed to get job ${jobId} from queue ${queueName}:`,
        error
      );
      return {
        success: false,
        error: new QueueError("Failed to get job"),
      };
    }
  }

  /**
   * Remove job from queue
   */
  async removeJob(
    queueName: string,
    jobId: string
  ): Promise<Result<void, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return {
          success: false,
          error: new JobNotFoundError(`Job ${jobId} not found`),
        };
      }

      await job.remove();

      logger.info(`Job ${jobId} removed from queue ${queueName}`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(
        `Failed to remove job ${jobId} from queue ${queueName}:`,
        error
      );
      return {
        success: false,
        error: new QueueError("Failed to remove job"),
      };
    }
  }

  /**
   * Retry failed job
   */
  async retryJob(
    queueName: string,
    jobId: string
  ): Promise<Result<void, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      const job = await queue.getJob(jobId);

      if (!job) {
        return {
          success: false,
          error: new JobNotFoundError(`Job ${jobId} not found`),
        };
      }

      await job.retry();

      logger.info(`Job ${jobId} retried in queue ${queueName}`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(
        `Failed to retry job ${jobId} in queue ${queueName}:`,
        error
      );
      return {
        success: false,
        error: new QueueError("Failed to retry job"),
      };
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: string): Promise<
    Result<
      {
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: number;
      },
      QueueError
    >
  > {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      const counts = await queue.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused"
      );

      return { success: true, data: counts };
    } catch (error) {
      logger.error(`Failed to get stats for queue ${queueName}:`, error);
      return {
        success: false,
        error: new QueueError("Failed to get queue statistics"),
      };
    }
  }

  /**
   * Pause queue
   */
  async pauseQueue(queueName: string): Promise<Result<void, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      await queue.pause();

      logger.info(`Queue ${queueName} paused`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}:`, error);
      return {
        success: false,
        error: new QueueError("Failed to pause queue"),
      };
    }
  }

  /**
   * Resume queue
   */
  async resumeQueue(queueName: string): Promise<Result<void, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      await queue.resume();

      logger.info(`Queue ${queueName} resumed`);

      return { success: true, data: undefined };
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}:`, error);
      return {
        success: false,
        error: new QueueError("Failed to resume queue"),
      };
    }
  }

  /**
   * Clean queue (remove old jobs)
   */
  async cleanQueue(
    queueName: string,
    grace: number = 24 * 60 * 60 * 1000, // 24 hours
    status: "completed" | "failed" = "completed"
  ): Promise<Result<number, QueueError>> {
    try {
      if (!this.isConnected) {
        return {
          success: false,
          error: new QueueError("Redis not connected"),
        };
      }

      const queue = this.getQueue(queueName);
      const jobs = await queue.clean(grace, 0, status);

      logger.info(
        `Cleaned ${jobs.length} ${status} jobs from queue ${queueName}`
      );

      return { success: true, data: jobs.length };
    } catch (error) {
      logger.error(`Failed to clean queue ${queueName}:`, error);
      return {
        success: false,
        error: new QueueError("Failed to clean queue"),
      };
    }
  }

  /**
   * Get all queue names
   */
  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === "PONG";
    } catch (error) {
      logger.error("Queue service health check failed:", error);
      return false;
    }
  }

  /**
   * Shutdown all queues and workers
   */
  async shutdown(): Promise<void> {
    try {
      // Close all workers
      const workerPromises = Array.from(this.workers.values()).map((worker) =>
        worker.close()
      );
      await Promise.all(workerPromises);

      // Close all queue events
      const eventPromises = Array.from(this.queueEvents.values()).map(
        (events) => events.close()
      );
      await Promise.all(eventPromises);

      // Close all queues
      const queuePromises = Array.from(this.queues.values()).map((queue) =>
        queue.close()
      );
      await Promise.all(queuePromises);

      // Disconnect Redis
      await this.redis.disconnect();

      this.workers.clear();
      this.queueEvents.clear();
      this.queues.clear();
      this.isConnected = false;

      logger.info("Queue service shutdown completed");
    } catch (error) {
      logger.error("Error during queue service shutdown:", error);
    }
  }
}
