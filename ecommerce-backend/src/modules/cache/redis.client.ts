import Redis, { type RedisOptions } from "ioredis";
import { config } from "../../shared/config/env.config.js";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  connectTimeout: number;
  commandTimeout: number;
  lazyConnect: boolean;
  keepAlive: number;
}

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;

  private getRedisConfig(): RedisOptions {
    const redisUrl = config.redis.url;

    if (redisUrl) {
      return {
        ...this.parseRedisUrl(redisUrl),
        maxRetriesPerRequest: config.redis.maxRetries,
        retryDelayOnFailover: 100,
        connectTimeout: 10000,
        commandTimeout: 5000,
        lazyConnect: true,
        keepAlive: 30000,
      };
    }

    return {
      host: config.redis.host || "localhost",
      port: config.redis.port || 6379,
      password: config.redis.password,
      db: config.redis.db || 0,
      maxRetriesPerRequest: config.redis.maxRetries,
      retryDelayOnFailover: 100,
      connectTimeout: 10000,
      commandTimeout: 5000,
      lazyConnect: true,
      keepAlive: 30000,
    };
  }

  private parseRedisUrl(url: string): Partial<RedisOptions> {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: Number(parsed.port) || 6379,
        password: parsed.password || undefined,
        db: parsed.pathname ? Number(parsed.pathname.slice(1)) : 0,
      };
    } catch (error) {
      throw new Error(`Invalid Redis URL: ${url}`);
    }
  }

  async connect(): Promise<Redis> {
    if (this.client && this.isConnected) {
      return this.client;
    }

    const redisConfig = this.getRedisConfig();
    this.client = new Redis(redisConfig);

    this.client.on("connect", () => {
      this.isConnected = true;
      console.log("Redis client connected");
    });

    this.client.on("error", (error) => {
      this.isConnected = false;
      console.error("Redis client error:", error);
    });

    this.client.on("close", () => {
      this.isConnected = false;
      console.log("Redis client disconnected");
    });

    this.client.on("reconnecting", () => {
      console.log("Redis client reconnecting...");
    });

    try {
      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }

  getClient(): Redis {
    if (!this.client || !this.isConnected) {
      throw new Error("Redis client is not connected. Call connect() first.");
    }
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  async ping(): Promise<string> {
    const client = this.getClient();
    return await client.ping();
  }

  async flushAll(): Promise<void> {
    const client = this.getClient();
    await client.flushall();
  }

  async getInfo(): Promise<string> {
    const client = this.getClient();
    return await client.info();
  }
}

// Singleton instance
export const redisClient = new RedisClient();

// Export the Redis instance getter for direct access when needed
export const getRedisClient = (): Redis => redisClient.getClient();

// Helper function to initialize Redis connection
export const initializeRedis = async (): Promise<Redis> => {
  return await redisClient.connect();
};

// Helper function to close Redis connection
export const closeRedis = async (): Promise<void> => {
  await redisClient.disconnect();
};
