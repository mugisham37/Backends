/**
 * User repository unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserRepository } from "../user.repository";

// Mock database
const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

describe("UserRepository", () => {
  let repository: UserRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new UserRepository(mockDb as any);
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        firstName: "John",
        lastName: "Doe",
        role: "customer" as const,
        status: "active" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findByEmail("test@example.com");

      expect(result).toEqual(mockUser);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return null when user not found", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findByRole", () => {
    it("should find users by role", async () => {
      const mockUsers = [
        {
          id: "user1",
          email: "admin1@example.com",
          role: "admin" as const,
          status: "active" as const,
        },
        {
          id: "user2",
          email: "admin2@example.com",
          role: "admin" as const,
          status: "active" as const,
        },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockUsers),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findByRole("admin");

      expect(result).toEqual(mockUsers);
    });
  });

  describe("emailExists", () => {
    it("should return true when email exists", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ id: "user-id" }]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.emailExists("existing@example.com");

      expect(result).toBe(true);
    });

    it("should return false when email does not exist", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.emailExists("nonexistent@example.com");

      expect(result).toBe(false);
    });

    it("should exclude specific id when checking email existence", async () => {
      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.emailExists(
        "test@example.com",
        "exclude-id"
      );

      expect(result).toBe(false);
      expect(mockQuery.where).toHaveBeenCalled();
    });
  });

  describe("updateLastLogin", () => {
    it("should update last login timestamp", async () => {
      const mockQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      };

      mockDb.update.mockReturnValue(mockQuery);

      await repository.updateLastLogin("user-id");

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockQuery.set).toHaveBeenCalledWith({
        lastLoginAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("verifyEmail", () => {
    it("should verify user email", async () => {
      const verifiedUser = {
        id: "user-id",
        email: "test@example.com",
        emailVerified: true,
        emailVerificationToken: null,
      };

      const mockQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([verifiedUser]),
      };

      mockDb.update.mockReturnValue(mockQuery);

      const result = await repository.verifyEmail("user-id");

      expect(result).toEqual(verifiedUser);
      expect(mockQuery.set).toHaveBeenCalledWith({
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("setPasswordResetToken", () => {
    it("should set password reset token", async () => {
      const token = "reset-token";
      const expires = new Date();

      const mockQuery = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([{ id: "user-id" }]),
      };

      mockDb.update.mockReturnValue(mockQuery);

      const result = await repository.setPasswordResetToken(
        "test@example.com",
        token,
        expires
      );

      expect(result).toBe(true);
      expect(mockQuery.set).toHaveBeenCalledWith({
        passwordResetToken: token,
        passwordResetExpires: expires,
        updatedAt: expect.any(Date),
      });
    });
  });

  describe("findByPasswordResetToken", () => {
    it("should find user by valid password reset token", async () => {
      const mockUser = {
        id: "user-id",
        email: "test@example.com",
        passwordResetToken: "valid-token",
        passwordResetExpires: new Date(Date.now() + 3600000), // 1 hour from now
      };

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([mockUser]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findByPasswordResetToken("valid-token");

      expect(result).toEqual(mockUser);
    });
  });

  describe("getStatistics", () => {
    it("should return user statistics", async () => {
      const mockTotalResult = 100;
      const mockRoleStats = [
        { role: "customer", count: 80 },
        { role: "vendor", count: 15 },
        { role: "admin", count: 5 },
      ];
      const mockStatusStats = [
        { status: "active", count: 90 },
        { status: "inactive", count: 10 },
      ];
      const mockVerifiedStats = [
        { verified: true, count: 85 },
        { verified: false, count: 15 },
      ];

      // Mock count method
      vi.spyOn(repository, "count").mockResolvedValue(mockTotalResult);

      // Mock the Promise.all results
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      // Mock each query result
      mockQuery.groupBy
        .mockResolvedValueOnce(mockRoleStats)
        .mockResolvedValueOnce(mockStatusStats)
        .mockResolvedValueOnce(mockVerifiedStats);

      const result = await repository.getStatistics();

      expect(result).toEqual({
        total: 100,
        byRole: {
          customer: 80,
          vendor: 15,
          admin: 5,
        },
        byStatus: {
          active: 90,
          inactive: 10,
        },
        verified: 85,
        unverified: 15,
      });
    });
  });

  describe("findWithFilters", () => {
    it("should find users with email filter", async () => {
      const mockUsers = [
        {
          id: "user-id",
          email: "test@example.com",
          role: "customer" as const,
          status: "active" as const,
        },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockUsers),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findWithFilters({
        email: "test@example.com",
      });

      expect(result).toEqual(mockUsers);
    });

    it("should find users with search filter", async () => {
      const mockUsers = [
        {
          id: "user-id",
          email: "john@example.com",
          firstName: "John",
          lastName: "Doe",
        },
      ];

      const mockQuery = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(mockUsers),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await repository.findWithFilters({
        search: "john",
      });

      expect(result).toEqual(mockUsers);
    });
  });
});
