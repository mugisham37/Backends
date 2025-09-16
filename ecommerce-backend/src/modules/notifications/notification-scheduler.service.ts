/**
 * Notification Scheduler Service
 * Handles scheduled notifications and periodic cleanup tasks
 */

import { CronJob } from "cron";
import { RealtimeNotificationService } from "./realtime-notification.service.js";
import { NotificationRepository } from "../../core/repositories/notification.repository.js";

export interface SchedulerConfig {
  processScheduledInterval: string; // Cron expression for processing scheduled notifications
  cleanupInterval: string; // Cron expression for cleanup tasks
  cleanupOlderThanDays: number; // Days to keep notifications
  digestInterval: string; // Cron expression for digest notifications
}

export class NotificationSchedulerService {
  private processScheduledJob: CronJob | null = null;
  private cleanupJob: CronJob | null = null;
  private digestJob: CronJob | null = null;
  private isRunning = false;

  constructor(
    private realtimeNotificationService: RealtimeNotificationService,
    private notificationRepo: NotificationRepository,
    private config: SchedulerConfig
  ) {}

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      console.warn("Notification scheduler is already running");
      return;
    }

    this.setupProcessScheduledJob();
    this.setupCleanupJob();
    this.setupDigestJob();

    this.isRunning = true;
    console.log("Notification scheduler started");
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.processScheduledJob) {
      this.processScheduledJob.stop();
      this.processScheduledJob = null;
    }

    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }

    if (this.digestJob) {
      this.digestJob.stop();
      this.digestJob = null;
    }

    this.isRunning = false;
    console.log("Notification scheduler stopped");
  }

  /**
   * Setup job to process scheduled notifications
   */
  private setupProcessScheduledJob(): void {
    this.processScheduledJob = new CronJob(
      this.config.processScheduledInterval,
      async () => {
        try {
          console.log("Processing scheduled notifications...");
          await this.realtimeNotificationService.processScheduledNotifications();
        } catch (error) {
          console.error("Error processing scheduled notifications:", error);
        }
      },
      null,
      true,
      "UTC"
    );
  }

  /**
   * Setup job to cleanup old notifications
   */
  private setupCleanupJob(): void {
    this.cleanupJob = new CronJob(
      this.config.cleanupInterval,
      async () => {
        try {
          console.log("Cleaning up old notifications...");
          const deletedCount =
            await this.realtimeNotificationService.cleanupOldNotifications(
              this.config.cleanupOlderThanDays
            );
          console.log(`Cleaned up ${deletedCount} old notifications`);
        } catch (error) {
          console.error("Error cleaning up old notifications:", error);
        }
      },
      null,
      true,
      "UTC"
    );
  }

  /**
   * Setup job to send digest notifications
   */
  private setupDigestJob(): void {
    this.digestJob = new CronJob(
      this.config.digestInterval,
      async () => {
        try {
          console.log("Processing digest notifications...");
          await this.processDigestNotifications();
        } catch (error) {
          console.error("Error processing digest notifications:", error);
        }
      },
      null,
      true,
      "UTC"
    );
  }

  /**
   * Process digest notifications for users who have them enabled
   */
  private async processDigestNotifications(): Promise<void> {
    try {
      // This is a simplified implementation
      // In a real system, you'd query users with digest preferences enabled
      // and send them a summary of their unread notifications

      console.log("Digest notifications processing completed");
    } catch (error) {
      console.error("Error in digest notification processing:", error);
    }
  }

  /**
   * Manually trigger scheduled notification processing
   */
  async processScheduledNow(): Promise<void> {
    try {
      await this.realtimeNotificationService.processScheduledNotifications();
    } catch (error) {
      console.error(
        "Error in manual scheduled notification processing:",
        error
      );
      throw error;
    }
  }

  /**
   * Manually trigger cleanup
   */
  async cleanupNow(): Promise<number> {
    try {
      return await this.realtimeNotificationService.cleanupOldNotifications(
        this.config.cleanupOlderThanDays
      );
    } catch (error) {
      console.error("Error in manual cleanup:", error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    jobs: {
      processScheduled: { running: boolean; nextRun?: Date };
      cleanup: { running: boolean; nextRun?: Date };
      digest: { running: boolean; nextRun?: Date };
    };
  } {
    return {
      isRunning: this.isRunning,
      jobs: {
        processScheduled: {
          running: this.processScheduledJob?.running || false,
          nextRun: this.processScheduledJob?.nextDate()?.toJSDate(),
        },
        cleanup: {
          running: this.cleanupJob?.running || false,
          nextRun: this.cleanupJob?.nextDate()?.toJSDate(),
        },
        digest: {
          running: this.digestJob?.running || false,
          nextRun: this.digestJob?.nextDate()?.toJSDate(),
        },
      },
    };
  }

  /**
   * Create scheduler from environment variables
   */
  static createFromEnv(
    realtimeNotificationService: RealtimeNotificationService,
    notificationRepo: NotificationRepository
  ): NotificationSchedulerService {
    const config: SchedulerConfig = {
      processScheduledInterval:
        process.env.NOTIFICATION_PROCESS_INTERVAL || "*/5 * * * *", // Every 5 minutes
      cleanupInterval: process.env.NOTIFICATION_CLEANUP_INTERVAL || "0 2 * * *", // Daily at 2 AM
      cleanupOlderThanDays: Number(process.env.NOTIFICATION_CLEANUP_DAYS) || 90,
      digestInterval: process.env.NOTIFICATION_DIGEST_INTERVAL || "0 9 * * *", // Daily at 9 AM
    };

    return new NotificationSchedulerService(
      realtimeNotificationService,
      notificationRepo,
      config
    );
  }
}
