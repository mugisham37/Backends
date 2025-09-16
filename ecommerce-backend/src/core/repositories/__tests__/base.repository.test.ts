/**
 * Base repository unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { BaseRepository } from "../base.repository";
import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";

// Mock table for testing
const testTable = pgTable("test_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

type TestEntity = typeof testTable.$inferSelect;
type NewTestEntity = typeof testTable.$inferInsert;

// Concrete implementation for testing
class TestRepository extends BaseRepository<TestEntity, NewTestEntity> {
  protected table = testTable;
  protected idColumn = testTable.id;
}

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe("BaseRepository", () => {
  let repository: TestRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new TestRepository(mockDb as any);
  });

  describe("findById", () => {
    it("should find entity by id", async () => {
      const mockEntity = {
        id: "test-id",
        name: "Test Entity",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockEntity]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findById("test-id");

      expect(result).toEqual(mockEntity);
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockQuery.from).toHaveBeenCalledWith(testTable);
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it("should return null when entity not found", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create new entity", async () => {
      const newEntity = {
        name: "New Entity",
      };

      const createdEntity = {
        id: "new-id",
        name: "New Entity",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([createdEntity]),
      };

      mockDb.insert.mockReturnValue(mockQuery);

      const result = await repository.create(newEntity);

      expect(result).toEqual(createdEntity);
      expect(mockDb.insert).toHaveBeenCalledWith(testTable);
      expect(mockQuery.values).toHaveBeenCalledWith(newEntity);
      expect(mockQuery.returning).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should update entity", async () => {
      const updateData = {
        name: "Updated Entity",
      };

      const updatedEntity = {
        id: "test-id",
        name: "Updated Entity",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([updatedEntity]),
      };

      mockDb.update.mockReturnValue(mockQuery);

      const result = await repository.update("test-id", updateData);

      expect(result).toEqual(updatedEntity);
      expect(mockDb.update).toHaveBeenCalledWith(testTable);
      expect(mockQuery.set).toHaveBeenCalledWith({
        ...updateData,
        updatedAt: expect.any(Date),
      });
      expect(mockQuery.returning).toHaveBeenCalled();
    });

    it("should return null when entity not found for update", async () => {
      const mockQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      mockDb.update.mockReturnValue(mockQuery);

      const result = await repository.update("non-existent-id", {
        name: "Updated",
      });

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("should delete entity and return true", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      };

      mockDb.delete.mockReturnValue(mockQuery);

      const result = await repository.delete("test-id");

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledWith(testTable);
    });

    it("should return false when entity not found for deletion", async () => {
      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };

      mockDb.delete.mockReturnValue(mockQuery);

      const result = await repository.delete("non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("exists", () => {
    it("should return true when entity exists", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.exists("test-id");

      expect(result).toBe(true);
    });

    it("should return false when entity does not exist", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.exists("non-existent-id");

      expect(result).toBe(false);
    });
  });

  describe("findByIds", () => {
    it("should find entities by multiple ids", async () => {
      const mockEntities = [
        { id: "id1", name: "Entity 1" },
        { id: "id2", name: "Entity 2" },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockEntities),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findByIds(["id1", "id2"]);

      expect(result).toEqual(mockEntities);
    });

    it("should return empty array for empty ids array", async () => {
      const result = await repository.findByIds([]);

      expect(result).toEqual([]);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  describe("createMany", () => {
    it("should create multiple entities", async () => {
      const newEntities = [{ name: "Entity 1" }, { name: "Entity 2" }];

      const createdEntities = [
        {
          id: "id1",
          name: "Entity 1",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "id2",
          name: "Entity 2",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockQuery = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue(createdEntities),
      };

      mockDb.insert.mockReturnValue(mockQuery);

      const result = await repository.createMany(newEntities);

      expect(result).toEqual(createdEntities);
      expect(mockQuery.values).toHaveBeenCalledWith(newEntities);
    });

    it("should return empty array for empty data array", async () => {
      const result = await repository.createMany([]);

      expect(result).toEqual([]);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
