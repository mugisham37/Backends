import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import "reflect-metadata";

import {
  Auth,
  RequireRoles,
  AllowAnonymous,
  AuthMetadataUtils,
  Cache,
  CacheUtils,
  CacheKeyGenerator,
  Validate,
  ValidateBody,
  ValidationUtils,
  CommonSchemas,
} from "./index";

describe("Decorators Integration", () => {
  describe("Auth Decorator", () => {
    class TestService {
      @Auth()
      authenticatedMethod(): string {
        return "authenticated";
      }

      @RequireRoles("admin")
      adminMethod(): string {
        return "admin only";
      }

      @AllowAnonymous()
      publicMethod(): string {
        return "public";
      }
    }

    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    it("should set auth metadata correctly", () => {
      const metadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "authenticatedMethod"
      );

      expect(metadata).toBeDefined();
      expect(metadata?.required).toBe(true);
    });

    it("should set role metadata correctly", () => {
      const metadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "adminMethod"
      );

      expect(metadata).toBeDefined();
      expect(metadata?.roles).toEqual(["admin"]);
    });

    it("should set anonymous metadata correctly", () => {
      const metadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "publicMethod"
      );

      expect(metadata).toBeDefined();
      expect(metadata?.allowAnonymous).toBe(true);
    });
  });

  describe("Cache Decorator", () => {
    class TestService {
      @Cache({ ttl: 300 })
      cachedMethod(): string {
        return "cached result";
      }

      @Cache({ ttl: 600, key: "custom-key" })
      customKeyMethod(): string {
        return "custom key result";
      }
    }

    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    it("should set cache metadata correctly", () => {
      const metadata = CacheUtils.getCacheMetadata(service, "cachedMethod");

      expect(metadata).toBeDefined();
      expect(metadata?.ttl).toBe(300);
    });

    it("should handle custom key metadata", () => {
      const metadata = CacheUtils.getCacheMetadata(service, "customKeyMethod");

      expect(metadata).toBeDefined();
      expect(metadata?.key).toBe("custom-key");
      expect(metadata?.ttl).toBe(600);
    });
  });

  describe("Validation Decorator", () => {
    const userSchema = z.object({
      name: z.string(),
      email: z.string().email(),
      age: z.number().min(0).max(120),
    });

    class TestService {
      @ValidateBody(userSchema)
      createUser(userData: { name: string; email: string; age: number }): {
        name: string;
        email: string;
        age: number;
        id: string;
      } {
        return { ...userData, id: "123" };
      }

      @Validate({
        params: z.object({ id: z.string() }),
        query: z.object({ include: z.string().optional() }),
      })
      getUser(
        id: string,
        query: { include?: string }
      ): { id: string; include?: string } {
        return { id, ...query };
      }
    }

    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    it("should set validation metadata for body", () => {
      const metadata = ValidationUtils.getValidationMetadata(
        service,
        "createUser"
      );

      expect(metadata).toBeDefined();
      expect(metadata?.body).toBe(userSchema);
    });

    it("should set validation metadata for params and query", () => {
      const metadata = ValidationUtils.getValidationMetadata(
        service,
        "getUser"
      );

      expect(metadata).toBeDefined();
      expect(metadata?.params).toBeDefined();
      expect(metadata?.query).toBeDefined();
    });
  });

  describe("Combined Decorators", () => {
    const contentSchema = z.object({
      title: z.string(),
      body: z.string(),
      status: z.enum(["draft", "published", "archived"]),
    });

    class ContentService {
      @Auth()
      @ValidateBody(contentSchema)
      async createContent(data: {
        title: string;
        body: string;
        status: "draft" | "published" | "archived";
      }): Promise<{
        id: string;
        title: string;
        body: string;
        status: "draft" | "published" | "archived";
        createdAt: Date;
      }> {
        return {
          ...data,
          id: "content-123",
          createdAt: new Date(),
        };
      }

      @RequireRoles("admin")
      @Cache({ ttl: 300, tags: ["content"] })
      async getContentList(): Promise<
        { id: string; title: string; status: string }[]
      > {
        return [{ id: "1", title: "Test", status: "published" }];
      }

      @Auth()
      @ValidateBody(contentSchema.partial())
      @Cache({
        ttl: 60,
        keyGenerator: (id: string) => `content:${id}`,
      })
      async updateContent(
        id: string,
        data: Partial<{
          title: string;
          body: string;
          status: "draft" | "published" | "archived";
        }>
      ): Promise<{
        id: string;
        title?: string;
        body?: string;
        status?: "draft" | "published" | "archived";
        updatedAt: Date;
      }> {
        return {
          id,
          ...data,
          updatedAt: new Date(),
        };
      }
    }

    let service: ContentService;

    beforeEach(() => {
      service = new ContentService();
    });

    it("should combine auth and validation decorators", () => {
      const authMetadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "createContent"
      );
      const validationMetadata = ValidationUtils.getValidationMetadata(
        service,
        "createContent"
      );

      expect(authMetadata).toBeDefined();
      expect(authMetadata?.required).toBe(true);
      expect(validationMetadata).toBeDefined();
      expect(validationMetadata?.body).toBe(contentSchema);
    });

    it("should combine role and cache decorators", () => {
      const authMetadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "getContentList"
      );
      const cacheMetadata = CacheUtils.getCacheMetadata(
        service,
        "getContentList"
      );

      expect(authMetadata).toBeDefined();
      expect(authMetadata?.roles).toEqual(["admin"]);
      expect(cacheMetadata).toBeDefined();
      expect(cacheMetadata?.ttl).toBe(300);
      expect(cacheMetadata?.tags).toEqual(["content"]);
    });

    it("should combine all three decorator types", () => {
      const authMetadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "updateContent"
      );
      const validationMetadata = ValidationUtils.getValidationMetadata(
        service,
        "updateContent"
      );
      const cacheMetadata = CacheUtils.getCacheMetadata(
        service,
        "updateContent"
      );

      expect(authMetadata).toBeDefined();
      expect(authMetadata?.required).toBe(true);
      expect(validationMetadata).toBeDefined();
      expect(cacheMetadata).toBeDefined();
      expect(cacheMetadata?.keyGenerator).toBeDefined();
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent keys from method and args", () => {
      const key1 = CacheKeyGenerator.fromMethodAndArgs(
        "UserService",
        "getUser",
        ["123"]
      );
      const key2 = CacheKeyGenerator.fromMethodAndArgs(
        "UserService",
        "getUser",
        ["123"]
      );

      expect(key1).toBe(key2);
      expect(key1).toContain("UserService");
      expect(key1).toContain("getUser");
    });

    it("should generate user-specific keys", () => {
      const key = CacheKeyGenerator.fromUser("user-123", "profile", {
        include: "posts",
      });

      expect(key).toContain("user:user-123:profile");
    });

    it("should generate tenant-specific keys", () => {
      const key = CacheKeyGenerator.fromTenant("tenant-456", "settings", {
        feature: "auth",
      });

      expect(key).toContain("tenant:tenant-456:settings");
    });

    it("should generate entity keys", () => {
      const key = CacheKeyGenerator.forEntity("User", "123");

      expect(key).toBe("entity:User:123");
    });

    it("should generate list keys with filters", () => {
      const key = CacheKeyGenerator.forList(
        "User",
        { status: "active" },
        { page: 1, limit: 10 }
      );

      expect(key).toContain("list:User:");
    });

    it("should generate search keys", () => {
      const key = CacheKeyGenerator.forSearch(
        "john",
        { type: "user" },
        { page: 1 }
      );

      expect(key).toContain("search:");
    });
  });

  describe("Common Validation Schemas", () => {
    it("should validate pagination schema", () => {
      const validData = { page: 1, limit: 10 };
      const result = CommonSchemas.pagination.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it("should validate sort schema", () => {
      const validData = { sortBy: "createdAt", sortOrder: "desc" as const };
      const result = CommonSchemas.sort.safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sortBy).toBe("createdAt");
        expect(result.data.sortOrder).toBe("desc");
      }
    });

    it("should validate ID params", () => {
      const validData = { id: "123" };
      const result = z.object({ id: CommonSchemas.id }).safeParse(validData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe("123");
      }
    });
  });
});
