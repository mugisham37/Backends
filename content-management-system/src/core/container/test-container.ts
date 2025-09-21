/**
 * Test Container Module
 *
 * This module provides utilities for testing with dependency injection.
 * It creates a test-specific container configuration for unit and integration tests.
 */

import { DependencyContainer, container } from "tsyringe";
import { TOKENS } from "./index.ts";

/**
 * Create a test container with mock services
 */
export async function createTestContainer(): Promise<DependencyContainer> {
  // Dynamic import to avoid loading vitest in production
  const { vi } = await import("vitest");

  // Create a child container for testing
  const testContainer = container.createChildContainer();

  // Register mock database
  testContainer.registerInstance(TOKENS.Database, {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  });

  // Register mock Redis client
  testContainer.registerInstance(TOKENS.RedisClient, {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    quit: vi.fn(),
  });

  return testContainer;
}

/**
 * Reset the test container
 */
export function resetTestContainer(): void {
  container.reset();
}

/**
 * Mock factory for creating test instances
 */
export const testMockFactory = {
  /**
   * Create a mock database instance
   */
  createMockDatabase: async () => {
    const { vi } = await import("vitest");
    return {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    };
  },

  /**
   * Create a mock Redis instance
   */
  createMockRedis: async () => {
    const { vi } = await import("vitest");
    return {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
      exists: vi.fn(),
      expire: vi.fn(),
      quit: vi.fn(),
    };
  },
};
