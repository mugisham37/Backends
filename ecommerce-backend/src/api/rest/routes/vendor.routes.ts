/**
 * Vendor REST API routes
 * Clean controller with minimal complexity
 */

import { Router, Request, Response } from "express";
import { VendorService } from "../../../modules/ecommerce/vendors/vendor.service";
import {
  ResponseBuilder,
  HTTP_STATUS,
} from "../../../shared/utils/response.utils";
import {
  CreateVendorInput,
  UpdateVendorInput,
} from "../../../modules/ecommerce/vendors/vendor.types";

export class VendorController {
  private router = Router();

  constructor(private vendorService: VendorService) {
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post("/", this.createVendor.bind(this));
    this.router.get("/", this.getVendors.bind(this));
    this.router.get("/stats", this.getVendorStatistics.bind(this));
    this.router.get("/:id", this.getVendor.bind(this));
    this.router.put("/:id", this.updateVendor.bind(this));
    this.router.patch("/:id/status", this.updateVendorStatus.bind(this));
    this.router.patch(
      "/:id/verification",
      this.updateVerificationStatus.bind(this)
    );
    this.router.get("/:id/stats", this.getVendorStats.bind(this));
  }

  async createVendor(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id; // Assuming auth middleware sets req.user
      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const input: CreateVendorInput = req.body;
      const vendor = await this.vendorService.createVendor(userId, input);

      res
        .status(HTTP_STATUS.CREATED)
        .json(ResponseBuilder.success(vendor, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create vendor";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "CREATE_VENDOR_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getVendors(req: Request, res: Response): Promise<void> {
    try {
      const { status, search, limit = "20", page = "1" } = req.query;

      const filters = {
        ...(status && { status: status as string }),
        ...(search && { search: search as string }),
        limit: parseInt(limit as string),
        offset: (parseInt(page as string) - 1) * parseInt(limit as string),
      };

      const vendors = await this.vendorService.searchVendors(filters);

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(vendors, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch vendors";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_VENDORS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getVendor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const vendor = await this.vendorService.getVendor(id);

      if (!vendor) {
        res
          .status(HTTP_STATUS.NOT_FOUND)
          .json(
            ResponseBuilder.error(
              "Vendor not found",
              "VENDOR_NOT_FOUND",
              undefined,
              { requestId: req.id }
            )
          );
        return;
      }

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(vendor, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch vendor";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_VENDOR_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateVendor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res
          .status(HTTP_STATUS.UNAUTHORIZED)
          .json(
            ResponseBuilder.error("Authentication required", "AUTH_REQUIRED")
          );
        return;
      }

      const input: UpdateVendorInput = req.body;
      const vendor = await this.vendorService.updateVendor(id, userId, input);

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(vendor, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update vendor";
      const status = message.includes("not found")
        ? HTTP_STATUS.NOT_FOUND
        : message.includes("Not authorized")
        ? HTTP_STATUS.FORBIDDEN
        : HTTP_STATUS.BAD_REQUEST;

      res
        .status(status)
        .json(
          ResponseBuilder.error(message, "UPDATE_VENDOR_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateVendorStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (
        !["pending", "approved", "rejected", "suspended", "inactive"].includes(
          status
        )
      ) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(ResponseBuilder.error("Invalid status", "INVALID_STATUS"));
        return;
      }

      let vendor;
      switch (status) {
        case "approved":
          vendor = await this.vendorService.approveVendor(id);
          break;
        case "rejected":
          vendor = await this.vendorService.rejectVendor(id);
          break;
        case "suspended":
          vendor = await this.vendorService.suspendVendor(id);
          break;
        default:
          throw new Error("Status update not implemented");
      }

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(vendor, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update vendor status";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(message, "UPDATE_STATUS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async updateVerificationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!["unverified", "pending", "verified", "rejected"].includes(status)) {
        res
          .status(HTTP_STATUS.BAD_REQUEST)
          .json(
            ResponseBuilder.error(
              "Invalid verification status",
              "INVALID_VERIFICATION_STATUS"
            )
          );
        return;
      }

      const vendor = await this.vendorService.updateVerificationStatus(
        id,
        status
      );

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(vendor, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update verification status";
      res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json(
          ResponseBuilder.error(
            message,
            "UPDATE_VERIFICATION_FAILED",
            undefined,
            { requestId: req.id }
          )
        );
    }
  }

  async getVendorStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const stats = await this.vendorService.getVendorStats(id);

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(stats, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch vendor stats";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_STATS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  async getVendorStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.vendorService.getVendorStatistics();

      res
        .status(HTTP_STATUS.OK)
        .json(ResponseBuilder.success(statistics, { requestId: req.id }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to fetch vendor statistics";
      res
        .status(HTTP_STATUS.INTERNAL_SERVER_ERROR)
        .json(
          ResponseBuilder.error(message, "FETCH_STATISTICS_FAILED", undefined, {
            requestId: req.id,
          })
        );
    }
  }

  getRouter(): Router {
    return this.router;
  }
}
