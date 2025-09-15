import "reflect-metadata";
import { vi } from "vitest";

// Mock the config module
vi.mock("../config", () => ({
  config: {
    cache: {
      ttl: 3600,
    },
    redis: {
      uri: "redis://localhost:6379",
      password: undefined,
      db: 0,
      maxRetriesPerRequest: 3,
    },
  },
}));

// Mock the logger
vi.mock("../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
