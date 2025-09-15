import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  WebhookService,
  WebhookEvent,
  WebhookStatus,
  WebhookError,
  WebhookValidationError,
} from "../../../services/webhook.service";
import { QueueService } from "../../../services/queue.service";

// Mock QueueService
const mockQueueService = {
  addJob: vi.fn(),
  processJobs: vi.fn(),
  getQueueStats: vi.fn(),
  healthCheck: vi.fn(),
} as unknown as QueueService;

// Mock fetch
global.fetch = vi.fn();

describe("WebhookService", () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    vi.clearAllMocks();
    webhookService = new WebhookService(mockQueueService);
  });

  describe("createWebhook", () => {
    it("should create a webhook successfully", async () => {
      const webhookData = {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        secret: "secret123",
        events: [WebhookEvent.CONTENT_CREATED],
        tenantId: "tenant-123",
      };

      const result = await webhookService.createWebhook(webhookData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe(webhookData.name);
        expect(result.data.url).toBe(webhookData.url);
        expect(result.data.events).toEqual(webhookData.events);
        expect(result.data.status).toBe(WebhookStatus.ACTIVE);
        expect(result.data.id).toBeDefined();
      }
    });

    it("should fail with invalid URL", async () => {
      const webhookData = {
        name: "Test Webhook",
        url: "invalid-url",
        events: [WebhookEvent.CONTENT_CREATED],
      };

      const result = await webhookService.createWebhook(webhookData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
      }
    });

    it("should fail with no events", async () => {
      const webhookData = {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: [],
      };

      const result = await webhookService.createWebhook(webhookData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toBe(
          "At least one event must be specified"
        );
      }
    });

    it("should reject localhost URLs in production", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const webhookData = {
        name: "Test Webhook",
        url: "http://localhost:3000/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      };

      const result = await webhookService.createWebhook(webhookData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
        expect(result.error.message).toBe(
          "Localhost URLs not allowed in production"
        );
      }

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("getWebhookById", () => {
    it("should retrieve a webhook by ID", async () => {
      // First create a webhook
      const webhookData = {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      };

      const createResult = await webhookService.createWebhook(webhookData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const result = await webhookService.getWebhookById(
          createResult.data.id
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(createResult.data.id);
          expect(result.data.name).toBe(webhookData.name);
        }
      }
    });

    it("should fail for non-existent webhook", async () => {
      const result = await webhookService.getWebhookById("non-existent");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookError);
      }
    });
  });

  describe("updateWebhook", () => {
    it("should update a webhook successfully", async () => {
      // First create a webhook
      const webhookData = {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      };

      const createResult = await webhookService.createWebhook(webhookData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const updateData = {
          name: "Updated Webhook",
          status: WebhookStatus.INACTIVE,
        };

        const result = await webhookService.updateWebhook(
          createResult.data.id,
          updateData
        );

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.name).toBe(updateData.name);
          expect(result.data.status).toBe(updateData.status);
          expect(result.data.updatedAt).toBeInstanceOf(Date);
        }
      }
    });

    it("should fail for non-existent webhook", async () => {
      const result = await webhookService.updateWebhook("non-existent", {
        name: "Updated",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookError);
      }
    });
  });

  describe("deleteWebhook", () => {
    it("should delete a webhook successfully", async () => {
      // First create a webhook
      const webhookData = {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      };

      const createResult = await webhookService.createWebhook(webhookData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const result = await webhookService.deleteWebhook(createResult.data.id);

        expect(result.success).toBe(true);

        // Verify webhook is deleted
        const getResult = await webhookService.getWebhookById(
          createResult.data.id
        );
        expect(getResult.success).toBe(false);
      }
    });
  });

  describe("getAllWebhooks", () => {
    beforeEach(async () => {
      // Create test webhooks
      await webhookService.createWebhook({
        name: "Webhook 1",
        url: "https://example.com/webhook1",
        events: [WebhookEvent.CONTENT_CREATED],
        tenantId: "tenant-1",
      });

      await webhookService.createWebhook({
        name: "Webhook 2",
        url: "https://example.com/webhook2",
        events: [WebhookEvent.CONTENT_UPDATED],
        tenantId: "tenant-2",
      });
    });

    it("should return all webhooks", async () => {
      const result = await webhookService.getAllWebhooks();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.webhooks).toHaveLength(2);
        expect(result.data.totalCount).toBe(2);
        expect(result.data.page).toBe(1);
      }
    });

    it("should filter webhooks by search term", async () => {
      const result = await webhookService.getAllWebhooks({
        search: "Webhook 1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.webhooks).toHaveLength(1);
        expect(result.data.webhooks[0].name).toBe("Webhook 1");
      }
    });

    it("should filter webhooks by event", async () => {
      const result = await webhookService.getAllWebhooks({
        event: WebhookEvent.CONTENT_CREATED,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.webhooks).toHaveLength(1);
        expect(result.data.webhooks[0].events).toContain(
          WebhookEvent.CONTENT_CREATED
        );
      }
    });

    it("should filter webhooks by tenant", async () => {
      const result = await webhookService.getAllWebhooks({
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.webhooks).toHaveLength(1);
        expect(result.data.webhooks[0].tenantId).toBe("tenant-1");
      }
    });

    it("should paginate results", async () => {
      const result = await webhookService.getAllWebhooks(
        {},
        {
          page: 1,
          limit: 1,
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.webhooks).toHaveLength(1);
        expect(result.data.totalCount).toBe(2);
        expect(result.data.totalPages).toBe(2);
      }
    });
  });

  describe("testWebhook", () => {
    it("should queue a test webhook successfully", async () => {
      mockQueueService.addJob = vi.fn().mockResolvedValue({
        success: true,
        data: "job-123",
      });

      // First create a webhook
      const webhookData = {
        name: "Test Webhook",
        url: "https://example.com/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      };

      const createResult = await webhookService.createWebhook(webhookData);
      expect(createResult.success).toBe(true);

      if (createResult.success) {
        const result = await webhookService.testWebhook(createResult.data.id);

        expect(result.success).toBe(true);
        expect(mockQueueService.addJob).toHaveBeenCalledWith(
          "webhooks",
          "test-webhook",
          expect.objectContaining({
            webhookId: createResult.data.id,
            event: "test",
            url: webhookData.url,
          }),
          expect.objectContaining({
            attempts: 1,
            priority: 10,
          })
        );
      }
    });
  });

  describe("triggerWebhook", () => {
    it("should trigger webhooks for an event", async () => {
      mockQueueService.addJob = vi.fn().mockResolvedValue({
        success: true,
        data: "job-123",
      });

      // Create active webhook
      await webhookService.createWebhook({
        name: "Active Webhook",
        url: "https://example.com/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      });

      // Create inactive webhook (should not be triggered)
      const inactiveResult = await webhookService.createWebhook({
        name: "Inactive Webhook",
        url: "https://example.com/webhook2",
        events: [WebhookEvent.CONTENT_CREATED],
      });

      if (inactiveResult.success) {
        await webhookService.updateWebhook(inactiveResult.data.id, {
          status: WebhookStatus.INACTIVE,
        });
      }

      const result = await webhookService.triggerWebhook(
        WebhookEvent.CONTENT_CREATED,
        { id: "content-123" }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(1);
        expect(result.data.failed).toBe(0);
      }

      expect(mockQueueService.addJob).toHaveBeenCalledTimes(1);
    });

    it("should return zero counts when no webhooks match", async () => {
      const result = await webhookService.triggerWebhook(
        WebhookEvent.MEDIA_UPLOADED,
        { id: "media-123" }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(0);
        expect(result.data.failed).toBe(0);
      }
    });
  });

  describe("getWebhookStats", () => {
    it("should return webhook statistics", async () => {
      mockQueueService.getQueueStats = vi.fn().mockResolvedValue({
        success: true,
        data: { waiting: 5, active: 2 },
      });

      // Create some webhooks and deliveries
      await webhookService.createWebhook({
        name: "Webhook 1",
        url: "https://example.com/webhook",
        events: [WebhookEvent.CONTENT_CREATED],
      });

      const result = await webhookService.getWebhookStats();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalWebhooks).toBe(1);
        expect(result.data.activeWebhooks).toBe(1);
        expect(result.data.queueStats).toEqual({ waiting: 5, active: 2 });
      }
    });
  });

  describe("healthCheck", () => {
    it("should return queue service health status", async () => {
      mockQueueService.healthCheck = vi.fn().mockResolvedValue(true);

      const result = await webhookService.healthCheck();

      expect(result).toBe(true);
      expect(mockQueueService.healthCheck).toHaveBeenCalled();
    });
  });

  describe("generateSignature", () => {
    it("should generate correct HMAC signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const secret = "secret123";

      // Access private method for testing
      const signature = (webhookService as any).generateSignature(
        payload,
        secret
      );

      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature.length).toBe(64); // SHA256 hex string length
    });
  });

  describe("validateUrl", () => {
    it("should validate HTTP URLs", () => {
      const result = (webhookService as any).validateUrl("http://example.com");

      expect(result.success).toBe(true);
    });

    it("should validate HTTPS URLs", () => {
      const result = (webhookService as any).validateUrl("https://example.com");

      expect(result.success).toBe(true);
    });

    it("should reject non-HTTP protocols", () => {
      const result = (webhookService as any).validateUrl("ftp://example.com");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
      }
    });

    it("should reject malformed URLs", () => {
      const result = (webhookService as any).validateUrl("not-a-url");

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(WebhookValidationError);
      }
    });
  });
});
