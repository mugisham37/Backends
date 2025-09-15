import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BaseRepository } from "./base.repository.js";
import { getDatabase } from "../database/connection.js";
import { users } from "../database/schema/index.js";
import type { User } from "../database/schema/index.js";

// Mock the database connection
vi.mock("../database/connection.js", () => ({
  getDatabase: vi.fn(),
}));

// Test implementation of BaseRepository
class TestUserRepository extends BaseRepository<User> {
  constructor() {
    super(users);
  }
}

describe("BaseRepository", () => {
  let repository: TestUserRepository;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      returning: vi.fn(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
    };

    (getDatabase as any).mockReturnValue(mockDb);
    repository = new TestUserRepository();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a new record successfully", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword",
        tenantId: "tenant-1",
      };

      const expectedUser = {
        id: "user-1",
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([expectedUser]);

      const result = await repository.create(userData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedUser);
      expect(mockDb.insert).toHaveBeenCalledWith(users);
      expect(mockDb.values).toHaveBeenCalledWith(userData);
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("should handle creation errors", async () => {
      const userData = {
        email: "test@example.com",
        passwordHash: "hashedpassword",
        tenantId: "tenant-1",
      };

      mockDb.returning.mockRejectedValue(new Error("Database error"));

      const result = await repository.create(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Failed to create record");
    });
  });

  describe("findById", () => {
    it("should find a record by ID successfully", async () => {
      const userId = "user-1";
      const expectedUser = {
        id: userId,
        email: "test@example.com",
        passwordHash: "hashedpassword",
        tenantId: "tenant-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.limit.mockResolvedValue([expectedUser]);

      const result = await repository.findById(userId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedUser);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(users);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it("should return null when record not found", async () => {
      const userId = "non-existent";

      mockDb.limit.mockResolvedValue([]);

      const result = await repository.findById(userId);

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should handle find errors", async () => {
      const userId = "user-1";

      mockDb.limit.mockRejectedValue(new Error("Database error"));

      const result = await repository.findById(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Failed to find record by ID");
    });
  });

  describe("findMany", () => {
    it("should find multiple records successfully", async () => {
      const expectedUsers = [
        {
          id: "user-1",
          email: "test1@example.com",
          passwordHash: "hash1",
          tenantId: "tenant-1",
        },
        {
          id: "user-2",
          email: "test2@example.com",
          passwordHash: "hash2",
          tenantId: "tenant-1",
        },
      ];

      // Mock the query chain
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockResolvedValue(expectedUsers);

      const result = await repository.findMany({
        where: { tenantId: "tenant-1" },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedUsers);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(users);
    });

    it("should handle find many errors", async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockRejectedValue(new Error("Database error"));

      const result = await repository.findMany();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Failed to find records");
    });
  });

  describe("update", () => {
    it("should update a record successfully", async () => {
      const userId = "user-1";
      const updateData = { email: "updated@example.com" };
      const expectedUser = {
        id: userId,
        email: "updated@example.com",
        passwordHash: "hashedpassword",
        tenantId: "tenant-1",
        updatedAt: new Date(),
      };

      mockDb.returning.mockResolvedValue([expectedUser]);

      const result = await repository.update(userId, updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(expectedUser);
      expect(mockDb.update).toHaveBeenCalledWith(users);
      expect(mockDb.set).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("should handle record not found during update", async () => {
      const userId = "non-existent";
      const updateData = { email: "updated@example.com" };

      mockDb.returning.mockResolvedValue([]);

      const result = await repository.update(userId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Record not found for update");
    });

    it("should handle update errors", async () => {
      const userId = "user-1";
      const updateData = { email: "updated@example.com" };

      mockDb.returning.mockRejectedValue(new Error("Database error"));

      const result = await repository.update(userId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Failed to update record");
    });
  });

  describe("delete", () => {
    it("should delete a record successfully", async () => {
      const userId = "user-1";

      mockDb.returning.mockResolvedValue([{ id: userId }]);

      const result = await repository.delete(userId);

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
      expect(mockDb.delete).toHaveBeenCalledWith(users);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.returning).toHaveBeenCalled();
    });

    it("should handle record not found during delete", async () => {
      const userId = "non-existent";

      mockDb.returning.mockResolvedValue([]);

      const result = await repository.delete(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Record not found for deletion");
    });

    it("should handle delete errors", async () => {
      const userId = "user-1";

      mockDb.returning.mockRejectedValue(new Error("Database error"));

      const result = await repository.delete(userId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Failed to delete record");
    });
  });

  describe("count", () => {
    it("should count records successfully", async () => {
      const expectedCount = 5;

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockResolvedValue([{ count: expectedCount }]);

      const result = await repository.count({ tenantId: "tenant-1" });

      expect(result.success).toBe(true);
      expect(result.data).toBe(expectedCount);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockDb.from).toHaveBeenCalledWith(users);
    });

    it("should handle count errors", async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockRejectedValue(new Error("Database error"));

      const result = await repository.count();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain("Failed to count records");
    });
  });

  describe("exists", () => {
    it("should return true when record exists", async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockResolvedValue([{ count: 1 }]);

      const result = await repository.exists({ email: "test@example.com" });

      expect(result.success).toBe(true);
      expect(result.data).toBe(true);
    });

    it("should return false when record does not exist", async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockResolvedValue([{ count: 0 }]);

      const result = await repository.exists({
        email: "nonexistent@example.com",
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(false);
    });

    it("should handle exists errors", async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where = vi.fn().mockRejectedValue(new Error("Database error"));

      const result = await repository.exists({ email: "test@example.com" });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain(
        "Failed to check record existence"
      );
    });
  });
});
