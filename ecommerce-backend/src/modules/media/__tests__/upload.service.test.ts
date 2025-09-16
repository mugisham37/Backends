import { describe, it, expect, beforeEach, vi } from "vitest";
import { UploadService } from "../upload.service.js";
import { StorageService } from "../storage.service.js";
import { AppError } from "../../../core/errors/app-error.js";

// Mock sharp
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 800,
      height: 600,
      format: "jpeg",
    }),
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("optimized-image-data")),
  }));
  return { default: mockSharp };
});

// Mock the storage service
const mockStorageService = {
  upload: vi.fn(),
  delete: vi.fn(),
  getSignedUrl: vi.fn(),
  exists: vi.fn(),
} as unknown as StorageService;

// Create a simple JPEG header for testing
const createJpegBuffer = () => {
  const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
  const jpegData = Buffer.alloc(1000);
  return Buffer.concat([jpegHeader, jpegData]);
};

// Mock multipart file
const createMockFile = (overrides = {}) => ({
  filename: "test.jpg",
  mimetype: "image/jpeg",
  type: "file",
  fieldname: "file",
  encoding: "7bit",
  file: { bytesRead: 1024 },
  fields: {},
  toBuffer: vi.fn().mockResolvedValue(createJpegBuffer()),
  ...overrides,
});

describe("UploadService", () => {
  let uploadService: UploadService;

  beforeEach(() => {
    vi.clearAllMocks();
    uploadService = new UploadService(mockStorageService);
  });

  describe("uploadSingle", () => {
    it("should upload a valid image file successfully", async () => {
      const mockFile = createMockFile();
      const expectedUrl = "https://example.com/uploads/test-file.jpg";

      vi.mocked(mockStorageService.upload).mockResolvedValue(expectedUrl);

      const result = await uploadService.uploadSingle(mockFile);

      expect(result).toMatchObject({
        filename: expect.stringMatching(/\.jpg$/),
        originalName: "test.jpg",
        mimeType: "image/jpeg",
        size: expect.any(Number),
        url: expectedUrl,
        metadata: expect.any(Object),
      });
      expect(mockStorageService.upload).toHaveBeenCalledOnce();
    });

    it("should reject files that are too large", async () => {
      const mockFile = createMockFile({
        file: { bytesRead: 20 * 1024 * 1024 }, // 20MB (exceeds default 10MB limit)
      });

      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        AppError
      );
      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        "File too large"
      );
    });

    it("should reject invalid file types", async () => {
      const mockFile = createMockFile({
        mimetype: "application/x-executable",
        filename: "malware.exe",
      });

      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        AppError
      );
      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        "Invalid file type"
      );
    });

    it("should reject dangerous filenames", async () => {
      const mockFile = createMockFile({
        filename: "../../../etc/passwd",
      });

      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        AppError
      );
      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        "Invalid filename"
      );
    });

    it("should reject empty filenames", async () => {
      const mockFile = createMockFile({
        filename: "",
      });

      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        AppError
      );
      await expect(uploadService.uploadSingle(mockFile)).rejects.toThrow(
        "Filename is required"
      );
    });

    it("should upload to specified folder", async () => {
      const mockFile = createMockFile();
      const expectedUrl = "https://example.com/custom-folder/test-file.jpg";

      vi.mocked(mockStorageService.upload).mockResolvedValue(expectedUrl);

      await uploadService.uploadSingle(mockFile, { folder: "custom-folder" });

      expect(mockStorageService.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^custom-folder\//),
        expect.any(Buffer),
        expect.any(Object)
      );
    });
  });

  describe("uploadMultiple", () => {
    it("should upload multiple valid files", async () => {
      const mockFiles = [
        createMockFile({ filename: "file1.jpg" }),
        createMockFile({ filename: "file2.png", mimetype: "image/png" }),
      ];

      vi.mocked(mockStorageService.upload).mockResolvedValue(
        "https://example.com/test.jpg"
      );

      const results = await uploadService.uploadMultiple(mockFiles);

      expect(results).toHaveLength(2);
      expect(mockStorageService.upload).toHaveBeenCalledTimes(2);
    });

    it("should reject when too many files are provided", async () => {
      const mockFiles = Array(15)
        .fill(null)
        .map((_, i) => createMockFile({ filename: `file${i}.jpg` }));

      await expect(uploadService.uploadMultiple(mockFiles)).rejects.toThrow(
        AppError
      );
      await expect(uploadService.uploadMultiple(mockFiles)).rejects.toThrow(
        "Too many files"
      );
    });

    it("should respect custom maxFiles limit", async () => {
      const mockFiles = Array(3)
        .fill(null)
        .map((_, i) => createMockFile({ filename: `file${i}.jpg` }));

      await expect(
        uploadService.uploadMultiple(mockFiles, { maxFiles: 2 })
      ).rejects.toThrow(AppError);
    });
  });

  describe("deleteFile", () => {
    it("should delete a file successfully", async () => {
      vi.mocked(mockStorageService.delete).mockResolvedValue();

      await uploadService.deleteFile("test-file-id");

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "uploads/test-file-id"
      );
    });

    it("should delete from specified folder", async () => {
      vi.mocked(mockStorageService.delete).mockResolvedValue();

      await uploadService.deleteFile("test-file-id", "custom-folder");

      expect(mockStorageService.delete).toHaveBeenCalledWith(
        "custom-folder/test-file-id"
      );
    });

    it("should handle deletion errors", async () => {
      vi.mocked(mockStorageService.delete).mockRejectedValue(
        new Error("Delete failed")
      );

      await expect(uploadService.deleteFile("test-file-id")).rejects.toThrow(
        AppError
      );
      await expect(uploadService.deleteFile("test-file-id")).rejects.toThrow(
        "Failed to delete file"
      );
    });
  });

  describe("getFileUrl", () => {
    it("should generate a signed URL", async () => {
      const expectedUrl = "https://example.com/signed-url";
      vi.mocked(mockStorageService.getSignedUrl).mockResolvedValue(expectedUrl);

      const url = await uploadService.getFileUrl("test-file-id");

      expect(url).toBe(expectedUrl);
      expect(mockStorageService.getSignedUrl).toHaveBeenCalledWith(
        "uploads/test-file-id",
        undefined
      );
    });

    it("should generate URL with custom expiration", async () => {
      const expectedUrl = "https://example.com/signed-url";
      vi.mocked(mockStorageService.getSignedUrl).mockResolvedValue(expectedUrl);

      await uploadService.getFileUrl("test-file-id", "custom-folder", 7200);

      expect(mockStorageService.getSignedUrl).toHaveBeenCalledWith(
        "custom-folder/test-file-id",
        7200
      );
    });
  });

  describe("configuration validation", () => {
    it("should use custom configuration", () => {
      const customConfig = {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        allowedMimeTypes: ["image/jpeg"],
        allowedExtensions: [".jpg"],
      };

      expect(
        () => new UploadService(mockStorageService, customConfig)
      ).not.toThrow();
    });

    it("should validate configuration on creation", () => {
      const invalidConfig = {
        maxFileSize: -1, // Invalid negative size
      };

      expect(
        () => new UploadService(mockStorageService, invalidConfig)
      ).toThrow();
    });
  });
});
