import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../../core/errors/app-error.js";

export interface StorageConfig {
  provider: "aws-s3" | "cloudflare-r2" | "local";
  bucket: string;
  region?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  localPath?: string;
}

export interface UploadOptions {
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
  acl?: string;
}

export interface StorageProvider {
  upload(
    path: string,
    buffer: Buffer,
    options?: UploadOptions
  ): Promise<string>;
  delete(path: string): Promise<void>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
  exists(path: string): Promise<boolean>;
}

class S3StorageProvider implements StorageProvider {
  private client: S3Client;

  constructor(private config: StorageConfig) {
    this.client = new S3Client({
      region: config.region || "us-east-1",
      endpoint: config.endpoint,
      credentials:
        config.accessKeyId && config.secretAccessKey
          ? {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            }
          : undefined,
    });
  }

  async upload(
    path: string,
    buffer: Buffer,
    options?: UploadOptions
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: path,
        Body: buffer,
        ContentType: options?.contentType || "application/octet-stream",
        Metadata: options?.metadata,
        CacheControl: options?.cacheControl || "public, max-age=31536000",
        ACL: (options?.acl as ObjectCannedACL) || "public-read",
      });

      await this.client.send(command);

      // Return public URL
      if (this.config.publicUrl) {
        return `${this.config.publicUrl}/${path}`;
      }

      if (this.config.endpoint) {
        return `${this.config.endpoint}/${this.config.bucket}/${path}`;
      }

      return `https://${this.config.bucket}.s3.${
        this.config.region || "us-east-1"
      }.amazonaws.com/${path}`;
    } catch (error) {
      throw new AppError(
        `Failed to upload to S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "S3_UPLOAD_FAILED"
      );
    }
  }

  async delete(path: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: path,
      });

      await this.client.send(command);
    } catch (error) {
      throw new AppError(
        `Failed to delete from S3: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "S3_DELETE_FAILED"
      );
    }
  }

  async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: path,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      throw new AppError(
        `Failed to generate signed URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "SIGNED_URL_FAILED"
      );
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: path,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }
}

class LocalStorageProvider implements StorageProvider {
  private fs = require("fs").promises;
  private path = require("path");

  constructor(private config: StorageConfig) {
    if (!config.localPath) {
      throw new AppError(
        "Local path is required for local storage",
        500,
        "INVALID_CONFIG"
      );
    }
  }

  async upload(
    path: string,
    buffer: Buffer,
    options?: UploadOptions
  ): Promise<string> {
    try {
      const fullPath = this.path.join(this.config.localPath!, path);
      const dir = this.path.dirname(fullPath);

      // Ensure directory exists
      await this.fs.mkdir(dir, { recursive: true });

      // Write file
      await this.fs.writeFile(fullPath, buffer);

      // Return public URL
      return this.config.publicUrl
        ? `${this.config.publicUrl}/${path}`
        : `/uploads/${path}`;
    } catch (error) {
      throw new AppError(
        `Failed to save file locally: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "LOCAL_UPLOAD_FAILED"
      );
    }
  }

  async delete(path: string): Promise<void> {
    try {
      const fullPath = this.path.join(this.config.localPath!, path);
      await this.fs.unlink(fullPath);
    } catch (error) {
      throw new AppError(
        `Failed to delete local file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "LOCAL_DELETE_FAILED"
      );
    }
  }

  async getSignedUrl(path: string, _expiresIn?: number): Promise<string> {
    // For local storage, return the public URL (no signing needed)
    return this.config.publicUrl
      ? `${this.config.publicUrl}/${path}`
      : `/uploads/${path}`;
  }

  async exists(path: string): Promise<boolean> {
    try {
      const fullPath = this.path.join(this.config.localPath!, path);
      await this.fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

export class StorageService {
  private provider: StorageProvider;

  constructor(config: StorageConfig) {
    this.provider = this.createProvider(config);
  }

  private createProvider(config: StorageConfig): StorageProvider {
    switch (config.provider) {
      case "aws-s3":
      case "cloudflare-r2":
        return new S3StorageProvider(config);
      case "local":
        return new LocalStorageProvider(config);
      default:
        throw new AppError(
          `Unsupported storage provider: ${config.provider}`,
          500,
          "INVALID_PROVIDER"
        );
    }
  }

  async upload(
    path: string,
    buffer: Buffer,
    options?: UploadOptions
  ): Promise<string> {
    return this.provider.upload(path, buffer, options);
  }

  async delete(path: string): Promise<void> {
    return this.provider.delete(path);
  }

  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    return this.provider.getSignedUrl(path, expiresIn);
  }

  async exists(path: string): Promise<boolean> {
    return this.provider.exists(path);
  }

  // Utility methods
  static createFromEnv(): StorageService {
    const provider =
      (process.env.STORAGE_PROVIDER as StorageConfig["provider"]) || "local";

    const config: StorageConfig = {
      provider,
      bucket: process.env.STORAGE_BUCKET || "uploads",
      region: process.env.STORAGE_REGION,
      endpoint: process.env.STORAGE_ENDPOINT,
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
      publicUrl: process.env.STORAGE_PUBLIC_URL,
      localPath: process.env.STORAGE_LOCAL_PATH || "./uploads",
    };

    return new StorageService(config);
  }

  // Batch operations
  async uploadMultiple(
    files: Array<{ path: string; buffer: Buffer; options?: UploadOptions }>
  ): Promise<string[]> {
    const uploadPromises = files.map((file) =>
      this.upload(file.path, file.buffer, file.options)
    );
    return Promise.all(uploadPromises);
  }

  async deleteMultiple(paths: string[]): Promise<void> {
    const deletePromises = paths.map((path) => this.delete(path));
    await Promise.all(deletePromises);
  }

  // File management utilities
  async copyFile(
    _sourcePath: string,
    _destinationPath: string
  ): Promise<string> {
    // This is a simplified implementation - in production you might want to use provider-specific copy operations
    throw new AppError(
      "Copy operation not implemented",
      501,
      "NOT_IMPLEMENTED"
    );
  }

  async moveFile(
    _sourcePath: string,
    _destinationPath: string
  ): Promise<string> {
    // This is a simplified implementation - in production you might want to use provider-specific move operations
    throw new AppError(
      "Move operation not implemented",
      501,
      "NOT_IMPLEMENTED"
    );
  }
}
