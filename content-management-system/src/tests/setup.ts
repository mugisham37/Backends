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
  checkDatabaseHealth: vi.fn().mockResolvedV