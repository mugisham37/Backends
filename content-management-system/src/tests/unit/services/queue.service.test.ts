import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  QueueService,
  QueueError,
  JobNotFoundError,
} from "../../../services/queue.service";

// Mock Redis and BullMQ
vi.mock("ioredis", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue("PONG"),
      on: vi.fn(),
    })),
  };
});

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-123" }),
    getJob: vi.fn(),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      completed: 5,
      failed: 1,
      delayed: 0,
      paused: 0,
    }),
    pause: vi.fn().mockResolvedValue(undefined),
    resume: vi.fn().mockResolvedValue(undefined),
    clean: vi.fn().mockResolvedValue([]),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  QueueEvents: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  })),
  Job: vi.fn(),
}));

describe("QueueService", () => {
  let queueService: QueueService;

  beforeEach(() => {
    vi.clearAllMocks();
    queueService = new QueueService();
    // Simulate connection
    (queueService as any).isConnected = true;
  });

  afterEach(async () => {
    await queueService.shutdown();
  });

  describe("addJob", () => {
    it("should add a job to the queue successfully", async () => {
      const jobData = {
        webhookId: "webhook-123",
        event: "content.created",
        payload: { id: "content-123" },
        url: "https://example.com/webhook",
      };

      const result = await queueService.addJob(
        "webhooks",
        "webhook-delivery",
        jobData
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("job-123");
      }
    });

    it("should fail when Redis is not connected", async () => {
      (queueService as any).isConnected = false;

      const jobData = {
        webhookId: "webhook-123",
        event: "content.created",
        payload: { id: "content-123" },
        url: "https://example.com/webhook",
      };

      const result = await queueService.addJob(
        "webhooks",
        "webhook-delivery",
        jobData
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(QueueError);
        expect(result.error.message).toBe("Redis not connected");
      }
    });

    it("should use custom job options", async () => {
      const jobData = {
        webhookId: "webhook-123",
        event: "content.created",
        payload: { id: "content-123" },
        url: "https://example.com/webhook",
      };

      const options = {
        attempts: 5,
        delay: 1000,
        priority: 10,
      };

      const result = await queueService.addJob(
        "webhooks",
        "webhook-delivery",
        jobData,
        options
      );

      expect(result.success).toBe(true);
    });
  });

  describe("processJobs", () => {
    it("should start processing jobs successfully", async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      const result = await queueService.processJobs("webhooks", processor, 3);

      expect(result.success).toBe(true);
    });

    it("should fail when Redis is not connected", async () => {
      (queueService as any).isConnected = false;
      const processor = vi.fn();

      const result = await queueService.processJobs("webhooks", processor);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(QueueError);
      }
    });

    it("should not start duplicate workers", async () => {
      const processor = vi.fn().mockResolvedValue({ success: true });

      // Start first worker
      await queueService.processJobs("webhooks", processor);

      // Try to start second worker for same queue
      const result = await queueService.processJobs("webhooks", processor);

      expect(result.success).toBe(true);
    });
  });

  describe("getJob", () => {
    it("should retrieve a job successfully", async () => {
      const mockJob = { id: "job-123", data: { test: true } };
      const mockQueue = {
        getJob: vi.fn().mockResolvedValue(mockJob),
      };
      (queueService as any).getQueue = vi.fn().mockReturnValue(mockQueue);

      const result = await queueService.getJob("webhooks", "job-123");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockJob);
      }
    });

    it("should return null for non-existent job", async () => {
      const mockQueue = {
        getJob: vi.fn().mockResolvedValue(null),
      };
      (queueService as any).getQueue = vi.fn().mockReturnValue(mockQueue);

      const result = await queueService.getJob("webhooks", "non-existent");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeNull();
      }
    });
  });

  describe("removeJob", () => {
    it("should remove a job successfully", async () => {
      const mockJob = {
        id: "job-123",
        remove: vi.fn().mockResolvedValue(undefined),
      };
      const mockQueue = {
        getJob: vi.fn().mockResolvedValue(mockJob),
      };
      (queueService as any).getQueue = vi.fn().mockReturnValue(mockQueue);

      const result = await queueService.removeJob("webhooks", "job-123");

      expect(result.success).toBe(true);
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it("should fail when job not found", async () => {
      const mockQueue = {
        getJob: vi.fn().mockResolvedValue(null),
      };
      (queueService as any).getQueue = vi.fn().mockReturnValue(mockQueue);

      const result = await queueService.removeJob("webhooks", "non-existent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(JobNotFoundError);
      }
    });
  });

  describe("retryJob", () => {
    it("should retry a job successfully", async () => {
      const mockJob = {
        id: "job-123",
        retry: vi.fn().mockResolvedValue(undefined),
      };
      const mockQueue = {
        getJob: vi.fn().mockResolvedValue(mockJob),
      };
      (queueService as any).getQueue = vi.fn().mockReturnValue(mockQueue);

      const result = await queueService.retryJob("webhooks", "job-123");

      expect(result.success).toBe(true);
      expect(mockJob.retry).toHaveBeenCalled();
    });
  });

  describe("getQueueStats", () => {
    it("should return queue statistics", async () => {
      const result = await queueService.getQueueStats("webhooks");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          waiting: 0,
          active: 0,
          completed: 5,
          failed: 1,
          delayed: 0,
          paused: 0,
        });
      }
    });
  });

  describe("pauseQueue", () => {
    it("should pause a queue successfully", async () => {
      const result = await queueService.pauseQueue("webhooks");

      expect(result.success).toBe(true);
    });
  });

  describe("resumeQueue", () => {
    it("should resume a queue successfully", async () => {
      const result = await queueService.resumeQueue("webhooks");

      expect(result.success).toBe(true);
    });
  });

  describe("cleanQueue", () => {
    it("should clean completed jobs from queue", async () => {
      const mockQueue = {
        clean: vi.fn().mockResolvedValue(["job-1", "job-2"]),
      };
      (queueService as any).getQueue = vi.fn().mockReturnValue(mockQueue);

      const result = await queueService.cleanQueue(
        "webhooks",
        86400000,
        "completed"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(2);
      }
    });
  });

  describe("healthCheck", () => {
    it("should return true when Redis is healthy", async () => {
      const result = await queueService.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false when Redis ping fails", async () => {
      (queueService as any).redis.ping = vi
        .fn()
        .mockRejectedValue(new Error("Connection failed"));

      const result = await queueService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe("getQueueNames", () => {
    it("should return list of queue names", () => {
      // Add some queues
      (queueService as any).queues.set("webhooks", {});
      (queueService as any).queues.set("emails", {});

      const queueNames = queueService.getQueueNames();

      expect(queueNames).toEqual(["webhooks", "emails"]);
    });
  });

  describe("shutdown", () => {
    it("should shutdown all queues and workers gracefully", async () => {
      // Mock some queues and workers
      const mockWorker = { close: vi.fn().mockResolvedValue(undefined) };
      const mockQueue = { close: vi.fn().mockResolvedValue(undefined) };
      const mockEvents = { close: vi.fn().mockResolvedValue(undefined) };

      (queueService as any).workers.set("webhooks", mockWorker);
      (queueService as any).queues.set("webhooks", mockQueue);
      (queueService as any).queueEvents.set("webhooks", mockEvents);

      await queueService.shutdown();

      expect(mockWorker.close).toHaveBeenCalled();
      expect(mockQueue.close).toHaveBeenCalled();
      expect(mockEvents.close).toHaveBeenCalled();
      expect((queueService as any).isConnected).toBe(false);
    });
  });
});
