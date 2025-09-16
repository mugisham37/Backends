import "reflect-metadata";
import { vi } from "vitest";

// Mock the config module
vi.mock("../config", () => ({
  config: {
    port: 3000,
    env: "test",
    environment: "test",
    isDevelopment: false,
    isProduction: false,
    isTest: true,
    database: {
      url: "postgresql://localhost:5432/cms_test",
      host: "localhost",
      port: 5432,
      name: "cms_test",
      user: "postgres",
      password: "",
      ssl: false,
      maxConnections: 20,
    },
    mongodb: {
      uri: "",
      options: {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    },
    redis: {
      enabled: false,
      uri: "redis://localhost:6379",
      password: undefined,
      db: 0,
      maxRetriesPerRequest: 3,
    },
    jwt: {
      secret: "test-secret",
      expiresIn: "1d",
      refreshExpiresIn: "7d",
      algorithm: "HS256",
    },
    search: {
      enabled: false,
      node: "http://localhost:9200",
      auth: undefined,
      index: "cms_content",
    },
    logging: {
      level: "error",
      silent: true,
      prettyPrint: false,
    },
    cors: {
      origin: true,
      methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Tenant-ID",
        "X-API-Key",
        "X-Request-ID",
      ],
      credentials: true,
    },
    rateLimit: {
      windowMs: 900000,
      max: 100,
      standardHeaders: true,
      legacyHeaders: false,
    },
    upload: {
      maxSize: 10485760,
      allowedMimeTypes: ["image/*", "application/pdf"],
      destination: "./uploads",
    },
    security: {
      bcryptRounds: 12,
      sessionSecret: "test-session-secret",
      csrfEnabled: false,
    },
    cache: {
      ttl: 3600,
      maxSize: 100,
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

// Mock database functions
export const resetDatabase = async () => {
  // Mock database reset
  return Promise.resolve();
};

export const seedTestData = async () => {
  // Mock test data seeding
  return {
    user: {
      id: "test-user-id",
      email: "test@example.com",
      role: "admin",
      tenantId: "test-tenant-id",
    },
    tenant: {
      id: "test-tenant-id",
      name: "Test Tenant",
      slug: "test-tenant",
    },
    authToken: "test-auth-token",
  };
};

// Mock services
vi.mock("../core/container/bootstrap", () => ({
  initializeApplication: vi.fn().mockResolvedValue(undefined),
  getApplicationStatus: vi.fn().mockReturnValue({
    initialized: true,
    containerReady: true,
    serviceCount: 8,
  }),
}));

vi.mock("../core/database/connection", () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  isDatabaseConnected: vi.fn().mockReturnValue(true),
  checkDatabaseHealth: vi.fn().mockResolvedValue("healthy"),
}));

// Mock tsyringe container
vi.mock("tsyringe", () => ({
  container: {
    resolve: vi.fn().mockImplementation((token: string) => {
      // Return mock services based on token
      const mockService = {
        authenticate: vi.fn().mockResolvedValue({
          success: true,
          data: {
            user: {
              id: "test-user-id",
              email: "test@example.com",
              role: "admin",
            },
            accessToken: "test-access-token",
            refreshToken: "test-refresh-token",
            expiresIn: 3600,
          },
        }),
        validateToken: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-user-id",
            email: "test@example.com",
            role: "admin",
            tenantId: "test-tenant-id",
          },
        }),
        refreshToken: vi.fn().mockResolvedValue({
          success: true,
          data: {
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresIn: 3600,
          },
        }),
        getTenant: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-tenant-id",
            name: "Test Tenant",
            slug: "test-tenant",
          },
        }),
        createTenant: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "new-tenant-id",
            name: "New Test Tenant",
            slug: "new-test-tenant",
          },
        }),
        updateTenant: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-tenant-id",
            name: "Updated Tenant",
          },
        }),
        deleteTenant: vi.fn().mockResolvedValue({
          success: true,
        }),
        getUserTenants: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
        createContent: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-content-id",
            title: "Test Content",
            slug: "test-content",
            body: "Test content body",
            status: "DRAFT",
            version: 1,
            authorId: "test-user-id",
            tenantId: "test-tenant-id",
          },
        }),
        getContent: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-content-id",
            title: "Test Content",
            slug: "test-content",
            body: "Test content body",
            status: "DRAFT",
            version: 1,
            authorId: "test-user-id",
            tenantId: "test-tenant-id",
          },
        }),
        updateContent: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-content-id",
            title: "Updated Title",
            body: "Updated content body",
            version: 2,
          },
        }),
        deleteContent: vi.fn().mockResolvedValue({
          success: true,
        }),
        publishContent: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-content-id",
            status: "PUBLISHED",
            publishedAt: new Date().toISOString(),
          },
        }),
        getContentsByTenant: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
        getContentVersions: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
        getFile: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-media-id",
            filename: "test-file.jpg",
            originalName: "test-file.jpg",
            mimeType: "image/jpeg",
            size: 1024,
            url: "/uploads/test-file.jpg",
          },
        }),
        uploadFile: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-media-id",
            filename: "test-file.jpg",
            originalName: "test-file.jpg",
            mimeType: "image/jpeg",
            size: 1024,
            url: "/uploads/test-file.jpg",
          },
        }),
        deleteFile: vi.fn().mockResolvedValue({
          success: true,
        }),
        getMediaByTenant: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
        search: vi.fn().mockResolvedValue({
          success: true,
          data: {
            items: [],
            total: 0,
            hasMore: false,
          },
        }),
        getUser: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: "test-user-id",
            email: "test@example.com",
            role: "admin",
          },
        }),
        getUsersByTenant: vi.fn().mockResolvedValue({
          success: true,
          data: [],
        }),
      };

      return mockService;
    }),
    register: vi.fn(),
  },
}));
