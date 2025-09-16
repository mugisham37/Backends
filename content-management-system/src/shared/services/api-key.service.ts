import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { inject, injectable } from "tsyringe";
import { apiKeys } from "../../core/database/schema/api-key.schema";
import type { DrizzleDatabase } from "../../core/database/connection";
import { ApiKeyModel } from "../db/models/api-key.model";
import { logger } from "../utils/logger";

@injectable()
export class ApiKeyService {
  constructor(@inject("DrizzleDatabase") private db: DrizzleDatabase) {}

  /**
   * Validate an API key
   */
  async validateApiKey(key: string): Promise<ApiKeyModel> {
    try {
      // Extract prefix and hash from the key
      const [prefix, keyValue] = key.split("_", 2);
      if (!prefix || !keyValue) {
        throw new Error("Invalid API key format");
      }

      // Hash the key value for comparison
      const keyHash = this.hashApiKey(keyValue);

      // Find the API key in the database
      const [apiKey] = await this.db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.keyPrefix, prefix),
            eq(apiKeys.keyHash, keyHash),
            eq(apiKeys.isActive, true)
          )
        )
        .limit(1);

      if (!apiKey) {
        throw new Error("Invalid API key");
      }

      // Check if the key has expired
      if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
        throw new Error("API key has expired");
      }

      // Update last used timestamp and usage count
      await this.db
        .update(apiKeys)
        .set({
          lastUsedAt: new Date(),
          usageCount: apiKey.usageCount + 1,
        })
        .where(eq(apiKeys.id, apiKey.id));

      // Return in legacy format
      return {
        _id: apiKey.id,
        name: apiKey.name,
        scopes: apiKey.scopes as string[],
        tenantId: apiKey.tenantId ?? undefined,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt ?? undefined,
        lastUsedAt: apiKey.lastUsedAt ?? undefined,
        usageCount: apiKey.usageCount,
        createdAt: apiKey.createdAt,
        updatedAt: apiKey.updatedAt,
      } as ApiKeyModel;
    } catch (error) {
      logger.error("Failed to validate API key:", error);
      throw error;
    }
  }

  /**
   * Hash an API key for storage
   */
  private hashApiKey(key: string): string {
    return crypto.createHash("sha256").update(key).digest("hex");
  }

  /**
   * Generate a new API key
   */
  async generateApiKey(data: {
    name: string;
    scopes: string[];
    tenantId?: string;
    expiresAt?: Date;
    createdBy: string;
  }): Promise<{ apiKey: string; keyId: string }> {
    try {
      // Generate a random key
      const keyValue = crypto.randomBytes(32).toString("hex");
      const prefix = crypto.randomBytes(4).toString("hex");
      const fullKey = `${prefix}_${keyValue}`;

      // Hash the key for storage
      const keyHash = this.hashApiKey(keyValue);

      // Insert into database
      const [newApiKey] = await this.db
        .insert(apiKeys)
        .values({
          name: data.name,
          keyHash,
          keyPrefix: prefix,
          scopes: data.scopes,
          tenantId: data.tenantId ?? null,
          expiresAt: data.expiresAt ?? null,
          createdBy: data.createdBy,
        })
        .returning();

      if (!newApiKey) {
        throw new Error("Failed to create API key");
      }

      return {
        apiKey: fullKey,
        keyId: newApiKey.id,
      };
    } catch (error) {
      logger.error("Failed to generate API key:", error);
      throw error;
    }
  }

  /**
   * Revoke an API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    try {
      await this.db
        .update(apiKeys)
        .set({ isActive: false })
        .where(eq(apiKeys.id, keyId));
    } catch (error) {
      logger.error("Failed to revoke API key:", error);
      throw error;
    }
  }

  /**
   * List API keys for a tenant
   */
  async listApiKeys(tenantId?: string): Promise<ApiKeyModel[]> {
    try {
      const query = this.db.select().from(apiKeys);

      if (tenantId) {
        query.where(eq(apiKeys.tenantId, tenantId));
      }

      const results = await query;

      return results.map(
        (apiKey: any) =>
          ({
            _id: apiKey.id,
            name: apiKey.name,
            scopes: apiKey.scopes as string[],
            tenantId: apiKey.tenantId ?? undefined,
            isActive: apiKey.isActive,
            expiresAt: apiKey.expiresAt ?? undefined,
            lastUsedAt: apiKey.lastUsedAt ?? undefined,
            usageCount: apiKey.usageCount,
            createdAt: apiKey.createdAt,
            updatedAt: apiKey.updatedAt,
          } as ApiKeyModel)
      );
    } catch (error) {
      logger.error("Failed to list API keys:", error);
      throw error;
    }
  }
}
