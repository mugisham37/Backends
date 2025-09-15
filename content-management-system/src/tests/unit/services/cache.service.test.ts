import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CacheService } from "../../../services/cache.service";

describe("CacheService", () => {
  let cacheService: CacheService;

  beforeEach(() => {
    // Mock Redis for testing
    vi.mock("ioredis", () => ({
      default: vi.fn().mockImplementation(() => ({
        connect: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        setex: vi.fn(),
        del: vi.fn(),
        exists: vi.fn(),
        mget: vi.fn(),
        pipeline: vi.fn(() => ({
          setex: vi.fn().mockReturnThis(),
          exec: vi.fn().mockResolvedValue([]),
        })),
        incrby: vi.fn(),
        expire: vi.fn(),
        ttl: vi.fn(),
        keys: vi.fn(),
        flushdb: vi.fn(),
        info: vi.fn(),
        dbsize: vi.fn(),
        ping: vi.fn(),
        disconnect: vi.fn(),
        on: vi.fn(),
      })),
    }));

    cacheService = new CacheService();
    // Simulate connection
    (cacheService as any).isConnected = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should be defined", () => {
    expect(cacheService).toBeDefined();
  });

  it("should have basic cache methods", () => {
    expect(typeof cacheService.get).toBe("function");
    expect(typeof cacheService.set).toBe("function");
    expect(typeof cacheService.delete).toBe("function");
    expect(typeof cacheService.exists).toBe("function");
  });
});
