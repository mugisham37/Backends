import { describe, it, expect, beforeEach, vi } from "vitest";
import { SearchService } from "../../../services/search.service";

// Mock CacheService
const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  invalidatePattern: vi.fn(),
  healthCheck: vi.fn(),
} as any;

describe("SearchService", () => {
  let searchService: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue({ success: true, data: undefined });
    mockCacheService.invalidatePattern.mockResolvedValue({
      success: true,
      data: 0,
    });
    mockCacheService.healthCheck.mockResolvedValue(true);

    searchService = new SearchService(mockCacheService);
  });

  it("should be defined", () => {
    expect(searchService).toBeDefined();
  });

  it("should have search methods", () => {
    expect(typeof searchService.search).toBe("function");
    expect(typeof searchService.indexContent).toBe("function");
    expect(typeof searchService.indexMedia).toBe("function");
    expect(typeof searchService.getSuggestions).toBe("function");
  });
});
