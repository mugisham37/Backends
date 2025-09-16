/**
 * Vendor controller unit tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Request, Response } from "express";
import { VendorController } from "../vendor.routes";
import { VendorService } from "../../../../modules/ecommerce/vendors/vendor.service";
import { HTTP_STATUS } from "../../../../shared/utils/response.utils";

// Mock the VendorService
const mockVendorService = {
  createVendor: vi.fn(),
  getVendor: vi.fn(),
  searchVendors: vi.fn(),
  updateVendor: vi.fn(),
  approveVendor: vi.fn(),
  rejectVendor: vi.fn(),
  suspendVendor: vi.fn(),
  updateVerificationStatus: vi.fn(),
  getVendorStats: vi.fn(),
  getVendorStatistics: vi.fn(),
} as unknown as VendorService;

describe("VendorController", () => {
  let controller: VendorController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new VendorController(mockVendorService);

    mockRequest = {
      id: "test-request-id",
      user: { id: "user-123", role: "admin" },
      params: {},
      query: {},
      body: {},
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  describe("createVendor", () => {
    it("should create vendor successfully", async () => {
      const vendorData = {
        businessName: "Test Business",
        email: "test@example.com",
        businessType: "retail",
        description: "Test description",
      };

      const createdVendor = {
        id: "vendor-123",
        userId: "user-123",
        ...vendorData,
      };

      mockRequest.body = vendorData;
      mockVendorService.createVendor = vi.fn().mockResolvedValue(createdVendor);

      await controller.createVendor(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockVendorService.createVendor).toHaveBeenCalledWith(
        "user-123",
        vendorData
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.CREATED);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: createdVendor,
        })
      );
    });

    it("should return 401 when user is not authenticated", async () => {
      mockRequest.user = undefined;

      await controller.createVendor(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(
        HTTP_STATUS.UNAUTHORIZED
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Authentication required",
            code: "AUTH_REQUIRED",
          }),
        })
      );
    });

    it("should handle service errors", async () => {
      mockRequest.body = { businessName: "Test" };
      mockVendorService.createVendor = vi
        .fn()
        .mockRejectedValue(new Error("Email already exists"));

      await controller.createVendor(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Email already exists",
            code: "CREATE_VENDOR_FAILED",
          }),
        })
      );
    });
  });

  describe("getVendor", () => {
    it("should return vendor successfully", async () => {
      const vendor = {
        id: "vendor-123",
        businessName: "Test Business",
        email: "test@example.com",
      };

      mockRequest.params = { id: "vendor-123" };
      mockVendorService.getVendor = vi.fn().mockResolvedValue(vendor);

      await controller.getVendor(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockVendorService.getVendor).toHaveBeenCalledWith("vendor-123");
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: vendor,
        })
      );
    });

    it("should return 404 when vendor not found", async () => {
      mockRequest.params = { id: "vendor-123" };
      mockVendorService.getVendor = vi.fn().mockResolvedValue(null);

      await controller.getVendor(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Vendor not found",
            code: "VENDOR_NOT_FOUND",
          }),
        })
      );
    });
  });

  describe("updateVendorStatus", () => {
    it("should approve vendor successfully", async () => {
      const vendor = {
        id: "vendor-123",
        status: "approved",
      };

      mockRequest.params = { id: "vendor-123" };
      mockRequest.body = { status: "approved" };
      mockVendorService.approveVendor = vi.fn().mockResolvedValue(vendor);

      await controller.updateVendorStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockVendorService.approveVendor).toHaveBeenCalledWith(
        "vendor-123"
      );
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: vendor,
        })
      );
    });

    it("should return 400 for invalid status", async () => {
      mockRequest.params = { id: "vendor-123" };
      mockRequest.body = { status: "invalid-status" };

      await controller.updateVendorStatus(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            message: "Invalid status",
            code: "INVALID_STATUS",
          }),
        })
      );
    });
  });

  describe("getVendors", () => {
    it("should return vendors with filters", async () => {
      const vendors = [
        { id: "vendor-1", businessName: "Business 1" },
        { id: "vendor-2", businessName: "Business 2" },
      ];

      mockRequest.query = {
        status: "approved",
        search: "business",
        limit: "10",
        page: "1",
      };

      mockVendorService.searchVendors = vi.fn().mockResolvedValue(vendors);

      await controller.getVendors(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockVendorService.searchVendors).toHaveBeenCalledWith({
        status: "approved",
        search: "business",
        limit: 10,
        offset: 0,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: vendors,
        })
      );
    });
  });
});
