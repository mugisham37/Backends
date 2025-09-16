import { MultipartFile } from "@fastify/multipart";
import sharp from "sharp";
import { z } from "zod";
import { StorageService } from "./storage.service.js";
import { AppError } from "../../core/errors/app-error.js";

export interface UploadConfig {
  maxFileSize: number;
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  imageOptimization?: {
    quality: number;
    maxWidth: number;
    maxHeight: number;
    formats: string[];
  };
}

export interface UploadResult {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
  };
}

const uploadConfigSchema = z.object({
  maxFileSize: z.number().positive(),
  allowedMimeTypes: z.array(z.string()),
  allowedExtensions: z.array(z.string()),
  imageOptimization: z
    .object({
      quality: z.number().min(1).max(100),
      maxWidth: z.number().positive(),
      maxHeight: z.number().positive(),
      formats: z.array(z.string()),
    })
    .optional(),
});

export class UploadService {
  private readonly defaultConfig: UploadConfig = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
      "text/plain",
      "application/json",
    ],
    allowedExtensions: [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif",
      ".pdf",
      ".txt",
      ".json",
    ],
    imageOptimization: {
      quality: 85,
      maxWidth: 2048,
      maxHeight: 2048,
      formats: ["webp", "jpeg"],
    },
  };

  constructor(
    private readonly storageService: StorageService,
    private readonly config: Partial<UploadConfig> = {}
  ) {
    this.validateConfig();
  }

  private validateConfig(): void {
    const mergedConfig = { ...this.defaultConfig, ...this.config };
    uploadConfigSchema.parse(mergedConfig);
  }

  private getConfig(): UploadConfig {
    return { ...this.defaultConfig, ...this.config };
  }

  async uploadSingle(
    file: MultipartFile,
    options?: { folder?: string }
  ): Promise<UploadResult> {
    const config = this.getConfig();

    // Validate file
    this.validateFile(file, config);

    // Generate unique filename
    const fileId = this.generateFileId();
    const extension = this.getFileExtension(file.filename);
    const filename = `${fileId}${extension}`;
    const folder = options?.folder || "uploads";

    try {
      let processedBuffer: Buffer;
      let metadata: UploadResult["metadata"] = {};

      // Process file based on type
      if (this.isImage(file.mimetype)) {
        const result = await this.processImage(await file.toBuffer(), config);
        processedBuffer = result.buffer;
        metadata = result.metadata;
      } else {
        processedBuffer = await file.toBuffer();
      }

      // Upload to storage
      const uploadPath = `${folder}/${filename}`;
      const url = await this.storageService.upload(
        uploadPath,
        processedBuffer,
        {
          contentType: file.mimetype,
          metadata: {
            originalName: file.filename,
            uploadedAt: new Date().toISOString(),
          },
        }
      );

      return {
        id: fileId,
        filename,
        originalName: file.filename,
        mimeType: file.mimetype,
        size: processedBuffer.length,
        url,
        metadata,
      };
    } catch (error) {
      throw new AppError(
        `Failed to upload file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "UPLOAD_FAILED"
      );
    }
  }

  async uploadMultiple(
    files: MultipartFile[],
    options?: { folder?: string; maxFiles?: number }
  ): Promise<UploadResult[]> {
    const maxFiles = options?.maxFiles || 10;

    if (files.length > maxFiles) {
      throw new AppError(
        `Too many files. Maximum allowed: ${maxFiles}`,
        400,
        "TOO_MANY_FILES"
      );
    }

    const uploadPromises = files.map((file) =>
      this.uploadSingle(file, options)
    );
    return Promise.all(uploadPromises);
  }

  private validateFile(file: MultipartFile, config: UploadConfig): void {
    // Validate filename first
    if (!file.filename || file.filename.trim() === "") {
      throw new AppError("Filename is required", 400, "INVALID_FILENAME");
    }

    // Check for potentially dangerous filenames
    if (this.isDangerousFilename(file.filename)) {
      throw new AppError("Invalid filename", 400, "DANGEROUS_FILENAME");
    }

    // Check file size
    if (file.file.bytesRead > config.maxFileSize) {
      throw new AppError(
        `File too large. Maximum size: ${this.formatBytes(config.maxFileSize)}`,
        400,
        "FILE_TOO_LARGE"
      );
    }

    // Check MIME type
    if (!config.allowedMimeTypes.includes(file.mimetype)) {
      throw new AppError(
        `Invalid file type. Allowed types: ${config.allowedMimeTypes.join(
          ", "
        )}`,
        400,
        "INVALID_FILE_TYPE"
      );
    }

    // Check file extension
    const extension = this.getFileExtension(file.filename);
    if (!config.allowedExtensions.includes(extension.toLowerCase())) {
      throw new AppError(
        `Invalid file extension. Allowed extensions: ${config.allowedExtensions.join(
          ", "
        )}`,
        400,
        "INVALID_FILE_EXTENSION"
      );
    }
  }

  private async processImage(
    buffer: Buffer,
    config: UploadConfig
  ): Promise<{ buffer: Buffer; metadata: UploadResult["metadata"] }> {
    if (!config.imageOptimization) {
      return { buffer, metadata: {} };
    }

    try {
      const image = sharp(buffer);
      const imageMetadata = await image.metadata();

      // Resize if necessary
      let processedImage = image;
      if (
        imageMetadata.width &&
        imageMetadata.height &&
        (imageMetadata.width > config.imageOptimization.maxWidth ||
          imageMetadata.height > config.imageOptimization.maxHeight)
      ) {
        processedImage = image.resize(
          config.imageOptimization.maxWidth,
          config.imageOptimization.maxHeight,
          { fit: "inside", withoutEnlargement: true }
        );
      }

      // Optimize and convert format
      const optimizedBuffer = await processedImage
        .webp({ quality: config.imageOptimization.quality })
        .toBuffer();

      const finalMetadata = await sharp(optimizedBuffer).metadata();

      return {
        buffer: optimizedBuffer,
        metadata: {
          width: finalMetadata.width,
          height: finalMetadata.height,
          format: finalMetadata.format,
        },
      };
    } catch (error) {
      throw new AppError(
        `Failed to process image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "IMAGE_PROCESSING_FAILED"
      );
    }
  }

  private isImage(mimeType: string): boolean {
    return mimeType.startsWith("image/");
  }

  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : "";
  }

  private generateFileId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${randomStr}`;
  }

  private isDangerousFilename(filename: string): boolean {
    const dangerousPatterns = [
      /\.\./, // Directory traversal
      /[<>:"|?*]/, // Invalid characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i, // Windows reserved names
      /^\./, // Hidden files
      /\s+$/, // Trailing whitespace
    ];

    return dangerousPatterns.some((pattern) => pattern.test(filename));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  async deleteFile(fileId: string, folder?: string): Promise<void> {
    try {
      const path = folder ? `${folder}/${fileId}` : `uploads/${fileId}`;
      await this.storageService.delete(path);
    } catch (error) {
      throw new AppError(
        `Failed to delete file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "DELETE_FAILED"
      );
    }
  }

  async getFileUrl(
    fileId: string,
    folder?: string,
    expiresIn?: number
  ): Promise<string> {
    try {
      const path = folder ? `${folder}/${fileId}` : `uploads/${fileId}`;
      return await this.storageService.getSignedUrl(path, expiresIn);
    } catch (error) {
      throw new AppError(
        `Failed to get file URL: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        500,
        "URL_GENERATION_FAILED"
      );
    }
  }
}
