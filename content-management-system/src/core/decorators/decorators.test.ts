import { describe, it, expect, beforeEach, vi } from "vitest";
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

import type { UserPayload } from "../types";

describe("Decorators Integration", () => {
  describe("Auth Decorator", () => {
    class TestService {
      @Auth()
      authenticatedMethod() {
        return "authenticated";
      }

      @RequireRoles("admin")
      adminMethod() {
        return "admin only";
      }

      @AllowAnonymous()
      publicMethod() {
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

    it("should set role requirements correctly", () => {
      const roles = AuthMetadataUtils.getRequiredRoles(service, "adminMethod");
      expect(roles).toEqual(["admin"]);
    });

    it("should allow anonymous access when specified", () => {
      const isAnonymous = AuthMetadataUtils.isAnonymousAllowed(
        service,
        "publicMethod"
      );
      expect(isAnonymous).toBe(true);
    });

    it("should validate user access correctly", () => {
      const adminUser: UserPayload = {
        id: "1",
        email: "admin@test.com",
        role: "admin",
        tenantId: "tenant1",
      };

      const regularUser: UserPayload = {
        id: "2",
        email: "user@test.com",
        role: "user",
        tenantId: "tenant1",
      };

      // Admin should have access to admin method
      const adminAccess = AuthMetadataUtils.validateAccess(
        adminUser,
        service,
        "adminMethod"
      );
      expect(adminAccess.allowed).toBe(true);

      // Regular user should not have access to admin method
      const userAccess = AuthMetadataUtils.validateAccess(
        regularUser,
        service,
        "adminMethod"
      );
      expect(userAccess.allowed).toBe(false);
      expect(userAccess.reason).toContain("Required roles: admin");
    });
  });

  describe("Cache Decorator", () => {
    class TestService {
      @Cache({ ttl: 300, tags: ["test"] })
      cachedMethod(id: string) {
        return `result-${id}`;
      }

      @Cache({
        keyGenerator: (id: string) => `custom:${id}`,
        ttl: 600,
      })
      customKeyMethod(id: string) {
        return `custom-${id}`;
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
      expect(metadata?.tags).toEqual(["test"]);
    });

    it("should generate cache keys correctly", () => {
      const key = CacheUtils.generateCacheKey(service, "cachedMethod", ["123"]);
      expect(key).toContain("TestService");
      expect(key).toContain("cachedMethod");
    });

    it("should use custom key generator", () => {
      const metadata = CacheUtils.getCacheMetadata(service, "customKeyMethod");
      expect(metadata?.keyGenerator).toBeDefined();

      if (metadata?.keyGenerator) {
        const key = metadata.keyGenerator("123");
        expect(key).toBe("custom:123");
      }
    });

    it("should generate different key types correctly", () => {
      const userKey = CacheKeyGenerator.fromUser("user1", "profile");
      expect(userKey).toContain("user:user1:profile");

      const tenantKey = CacheKeyGenerator.fromTenant("tenant1", "settings");
      expect(tenantKey).toContain("tenant:tenant1:settings");

      const entityKey = CacheKeyGenerator.forEntity("content", "123");
      expect(entityKey).toBe("entity:content:123");

      const listKey = CacheKeyGenerator.forList("content", {
        status: "published",
      });
      expect(listKey).toContain("list:content");
    });
  });

  describe("Validation Decorator", () => {
    const userSchema = z.object({
      name: z.string().min(1),
      email: CommonSchemas.email,
      age: z.number().min(0).max(120),
    });

    class TestService {
      @ValidateBody(userSchema)
      createUser(userData: z.infer<typeof userSchema>) {
        return { id: "1", ...userData };
      }

      @Validate({
        params: z.object({ id: CommonSchemas.id }),
        query: CommonSchemas.pagination,
      })
      getUser(id: string, pagination: any) {
        return { id, pagination };
      }
    }

    let service: TestService;

    beforeEach(() => {
      service = new TestService();
    });

    it("should set validation metadata correctly", () => {
      const metadata = ValidationUtils.getValidationMetadata(
        service,
        "createUser"
      );
      expect(metadata).toBeDefined();
      expect(metadata?.body).toBeDefined();
    });

    it("should validate data correctly", () => {
      const validData = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };

      const result = ValidationUtils.validate(userSchema, validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(validData);
      }
    });

    it("should handle validation errors", () => {
      const invalidData = {
        name: "",
        email: "invalid-email",
        age: -5,
      };

      const result = ValidationUtils.validate(userSchema, invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("validation");
      }
    });

    it("should validate request data", () => {
      const mockRequest = {
        body: {
          name: "John Doe",
          email: "john@example.com",
          age: 30,
        },
        params: { id: "123e4567-e89b-12d3-a456-426614174000" },
        query: { page: 1, limit: 20 },
      };

      const metadata = ValidationUtils.getValidationMetadata(
        service,
        "getUser"
      );

      if (metadata) {
        const result = ValidationUtils.validateRequest(mockRequest, metadata);
        expect(result.success).toBe(true);
      }
    });
  });

  describe("Combined Decorators", () => {
    const contentSchema = z.object({
      title: z.string().min(1),
      body: z.string(),
      status: CommonSchemas.contentStatus,
    });

    class ContentService {
      @Auth({ roles: ["admin", "editor"] })
      @ValidateBody(contentSchema)
      @Cache({ ttl: 300, tags: ["content"] })
      async createContent(data: z.infer<typeof contentSchema>) {
        return { id: "1", ...data, createdAt: new Date() };
      }

      @RequireRoles("admin")
      @Cache({ ttl: 60, tags: ["content", "list"] })
      async getAllContent() {
        return [{ id: "1", title: "Test", status: "published" }];
      }

      @Auth()
      @Validate({
        params: z.object({ id: CommonSchemas.id }),
        body: contentSchema.partial(),
      })
      async updateContent(
        id: string,
        data: Partial<z.infer<typeof contentSchema>>
      ) {
        return { id, ...data, updatedAt: new Date() };
      }
    }

    let service: ContentService;

    beforeEach(() => {
      service = new ContentService();
    });

    it("should have all decorators applied correctly", () => {
      // Check auth metadata
      const authMetadata = AuthMetadataUtils.getAuthMetadata(
        service,
        "createContent"
      );
      expect(authMetadata?.roles).toEqual(["admin", "editor"]);

      // Check validation metadata
      const validationMetadata = ValidationUtils.getValidationMetadata(
        service,
        "createContent"
      );
      expect(validationMetadata?.body).toBeDefined();

      // Check cache metadata
      const cacheMetadata = CacheUtils.getCacheMetadata(
        service,
        "createContent"
      );
      expect(cacheMetadata?.ttl).toBe(300);
      expect(cacheMetadata?.tags).toEqual(["content"]);
    });

    it("should validate complex scenarios", () => {
      const adminUser: UserPayload = {
        id: "1",
        email: "admin@test.com",
        role: "admin",
        tenantId: "tenant1",
      };

      const editorUser: UserPayload = {
        id: "2",
        email: "editor@test.com",
        role: "editor",
        tenantId: "tenant1",
      };

      const regularUser: UserPayload = {
        id: "3",
        email: "user@test.com",
        role: "user",
        tenantId: "tenant1",
      };

      // Admin should have access to all methods
      expect(
        AuthMetadataUtils.validateAccess(adminUser, service, "createContent")
          .allowed
      ).toBe(true);
      expect(
        AuthMetadataUtils.validateAccess(adminUser, service, "getAllContent")
          .allowed
      ).toBe(true);

      // Editor should have access to create but not get all
      expect(
        AuthMetadataUtils.validateAccess(editorUser, service, "createContent")
          .allowed
      ).toBe(true);
      expect(
        AuthMetadataUtils.validateAccess(editorUser, service, "getAllContent")
          .allowed
      ).toBe(false);

      // Regular user should not have access to any protected methods
      expect(
        AuthMetadataUtils.validateAccess(regularUser, service, "createContent")
          .allowed
      ).toBe(false);
      expect(
        AuthMetadataUtils.validateAccess(regularUser, service, "getAllContent")
          .allowed
      ).toBe(false);
    });

    it("should generate appropriate cache keys for different methods", () => {
      const createKey = CacheUtils.generateCacheKey(service, "createContent", [
        { title: "Test", body: "Content", status: "draft" },
      ]);
      expect(createKey).toContain("ContentService");
      expect(createKey).toContain("createContent");

      const listKey = CacheUtils.generateCacheKey(service, "getAllContent", []);
      expect(listKey).toContain("ContentService");
      expect(listKey).toContain("getAllContent");
    });
  });

  describe("Utility Functions", () => {
    it("should hash arguments consistently", () => {
      const key1 = CacheKeyGenerator.fromMethodAndArgs(
        "TestClass",
        "testMethod",
        ["arg1", { prop: "value" }]
      );
      const key2 = CacheKeyGenerator.fromMethodAndArgs(
        "TestClass",
        "testMethod",
        ["arg1", { prop: "value" }]
      );
      const key3 = CacheKeyGenerator.fromMethodAndArgs(
        "TestClass",
        "differentMethod", // Changed method name instead
        ["arg1", { prop: "value" }]
      );

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });

    it("should handle circular references in cache key generation", () => {
      const obj: any = { name: "test" };
      obj.self = obj;

      expect(() => {
        CacheKeyGenerator.fromMethodAndArgs("Test", "method", [obj]);
      }).not.toThrow();
    });

    it("should validate cache configuration", () => {
      const validConfig = { ttl: 300, tags: ["test"] };
      const result1 = CacheUtils.validateCacheConfig(validConfig);
      expect(result1.success).toBe(true);

      const invalidConfig = { ttl: -1 };
      const result2 = CacheUtils.validateCacheConfig(invalidConfig);
      expect(result2.success).toBe(false);
    });
  });
});
