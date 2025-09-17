/**
 * Vendor service
 * Clean business logic for vendor management
 */

import {
  VendorRepository,
  VendorFilters,
} from "../../../core/repositories/vendor.repository";
import { UserRepository } from "../../../core/repositories/user.repository";
import { Vendor, NewVendor } from "../../../core/database/schema";
import {
  CreateVendorInput,
  UpdateVendorInput,
  VendorOutput,
} from "./vendor.types";
import { NotificationService } from "../../notifications/notification.service";
import { WebhookService } from "../../webhook/webhook.service";
import { AnalyticsService } from "../../analytics/analytics.service";
import { CacheService } from "../../cache/cache.service";

export class VendorService {
  constructor(
    private vendorRepo: VendorRepository,
    private userRepo: UserRepository,
    private notificationService?: NotificationService,
    private webhookService?: WebhookService,
    private analyticsService?: AnalyticsService,
    private cacheService?: CacheService
  ) {}

  async createVendor(
    userId: string,
    input: CreateVendorInput
  ): Promise<VendorOutput> {
    // Verify user exists and doesn't already have a vendor account
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const existingVendor = await this.vendorRepo.findByUserId(userId);
    if (existingVendor) {
      throw new Error("User already has a vendor account");
    }

    // Check if email is already used by another vendor
    if (await this.vendorRepo.emailExists(input.email)) {
      throw new Error("Email is already registered by another vendor");
    }

    // Generate unique slug
    const slug = await this.generateUniqueSlug(input.businessName);

    const vendorData: NewVendor = {
      userId,
      businessName: input.businessName,
      slug,
      description: input.description,
      businessType: input.businessType,
      email: input.email,
      phoneNumber: input.phoneNumber,
      website: input.website,
      taxId: input.taxId,
      businessLicense: input.businessLicense,
      commissionRate: input.commissionRate?.toString() ?? "10.00",
      metadata: input.metadata,
    };

    const vendor = await this.vendorRepo.create(vendorData);
    const finalVendor = this.mapToOutput(vendor);

    // Trigger integrations after vendor creation
    await this.handleVendorCreatedIntegrations(finalVendor, userId);

    return finalVendor;
  }

  private async handleVendorCreatedIntegrations(
    vendor: VendorOutput,
    userId: string
  ): Promise<void> {
    try {
      // Analytics tracking
      if (this.analyticsService) {
        await this.analyticsService.trackEvent({
          eventType: "vendor",
          eventName: "vendor_application_submitted",
          userId: userId,
          properties: {
            vendorId: vendor.id,
            businessName: vendor.businessName,
            businessType: vendor.businessType,
          },
        });
      }

      // Send vendor application notification
      if (this.notificationService) {
        const user = await this.userRepo.findById(userId);
        if (user) {
          await this.notificationService.queueEmail(
            "vendor-application",
            {
              businessName: vendor.businessName,
              contactPerson: `${user.firstName} ${user.lastName}`,
              applicationId: vendor.id,
              dashboardUrl: `${process.env.FRONTEND_URL}/vendor/dashboard`,
            },
            { to: vendor.email }
          );
        }
      }

      // Dispatch webhook event
      if (this.webhookService) {
        await this.webhookService.dispatchEvent({
          eventType: "vendor.created",
          eventId: `vendor_${vendor.id}_created`,
          payload: { vendor },
          sourceId: vendor.id,
          sourceType: "vendor",
          userId: userId,
        });
      }

      // Clear vendor statistics cache
      if (this.cacheService) {
        await this.cacheService.delete("vendor_statistics");
      }
    } catch (error) {
      console.error("Vendor creation integration error:", error);
    }
  }

  async updateVendor(
    id: string,
    userId: string,
    input: UpdateVendorInput
  ): Promise<VendorOutput> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    if (vendor.userId !== userId) {
      throw new Error("Not authorized to update this vendor");
    }

    const updateData: Partial<Vendor> = {};

    if (input.businessName !== undefined) {
      updateData.businessName = input.businessName;
      if (input.businessName !== vendor.businessName) {
        updateData.slug = await this.generateUniqueSlug(input.businessName, id);
      }
    }

    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.businessType !== undefined)
      updateData.businessType = input.businessType;
    if (input.email !== undefined) {
      if (
        input.email !== vendor.email &&
        (await this.vendorRepo.emailExists(input.email, id))
      ) {
        throw new Error("Email is already registered by another vendor");
      }
      updateData.email = input.email;
    }
    if (input.phoneNumber !== undefined)
      updateData.phoneNumber = input.phoneNumber;
    if (input.website !== undefined) updateData.website = input.website;
    if (input.taxId !== undefined) updateData.taxId = input.taxId;
    if (input.businessLicense !== undefined)
      updateData.businessLicense = input.businessLicense;
    if (input.autoApproveProducts !== undefined)
      updateData.autoApproveProducts = input.autoApproveProducts;
    if (input.allowReviews !== undefined)
      updateData.allowReviews = input.allowReviews;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;

    const updatedVendor = await this.vendorRepo.update(id, updateData);
    if (!updatedVendor) {
      throw new Error("Failed to update vendor");
    }

    return this.mapToOutput(updatedVendor);
  }

  async getVendor(id: string): Promise<VendorOutput | null> {
    const vendor = await this.vendorRepo.findWithUser(id);
    return vendor ? this.mapToOutputWithUser(vendor) : null;
  }

  async getVendorBySlug(slug: string): Promise<VendorOutput | null> {
    const vendor = await this.vendorRepo.findBySlug(slug);
    return vendor ? this.mapToOutput(vendor) : null;
  }

  async getVendorByUserId(userId: string): Promise<VendorOutput | null> {
    const vendor = await this.vendorRepo.findByUserId(userId);
    return vendor ? this.mapToOutput(vendor) : null;
  }

  async searchVendors(filters: VendorFilters): Promise<VendorOutput[]> {
    const vendors = await this.vendorRepo.findWithFilters(filters);
    return vendors.map((vendor) => this.mapToOutput(vendor));
  }

  async getVendorsByStatus(
    status: "pending" | "approved" | "rejected" | "suspended" | "inactive"
  ): Promise<VendorOutput[]> {
    const vendors = await this.vendorRepo.findByStatus(status);
    return vendors.map((vendor) => this.mapToOutput(vendor));
  }

  async approveVendor(id: string): Promise<VendorOutput> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    if (vendor.status === "approved") {
      throw new Error("Vendor is already approved");
    }

    const updatedVendor = await this.vendorRepo.updateStatus(id, "approved");
    if (!updatedVendor) {
      throw new Error("Failed to approve vendor");
    }

    const finalVendor = this.mapToOutput(updatedVendor);

    // Trigger integrations after vendor approval
    await this.handleVendorApprovedIntegrations(finalVendor);

    return finalVendor;
  }

  private async handleVendorApprovedIntegrations(
    vendor: VendorOutput
  ): Promise<void> {
    try {
      // Analytics tracking
      if (this.analyticsService) {
        await this.analyticsService.trackEvent({
          eventType: "vendor",
          eventName: "vendor_approved",
          userId: vendor.userId,
          properties: {
            vendorId: vendor.id,
            businessName: vendor.businessName,
            approvalDate: new Date().toISOString(),
          },
        });
      }

      // Send vendor approval notification
      if (this.notificationService) {
        const user = await this.userRepo.findById(vendor.userId);
        if (user) {
          await this.notificationService.queueEmail(
            "vendor-approval",
            {
              businessName: vendor.businessName,
              contactPerson: `${user.firstName} ${user.lastName}`,
              dashboardUrl: `${process.env.FRONTEND_URL}/vendor/dashboard`,
              onboardingUrl: `${process.env.FRONTEND_URL}/vendor/onboarding`,
            },
            { to: vendor.email }
          );
        }
      }

      // Dispatch webhook event
      if (this.webhookService) {
        await this.webhookService.dispatchEvent({
          eventType: "vendor.approved",
          eventId: `vendor_${vendor.id}_approved`,
          payload: { vendor },
          sourceId: vendor.id,
          sourceType: "vendor",
          userId: vendor.userId,
        });
      }

      // Clear vendor caches
      if (this.cacheService) {
        await Promise.all([
          this.cacheService.delete("vendor_statistics"),
          this.cacheService.delete("approved_vendors"),
          this.cacheService.delete(`vendor:${vendor.id}`),
        ]);
      }
    } catch (error) {
      console.error("Vendor approval integration error:", error);
    }
  }

  async rejectVendor(id: string): Promise<VendorOutput> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const updatedVendor = await this.vendorRepo.updateStatus(id, "rejected");
    if (!updatedVendor) {
      throw new Error("Failed to reject vendor");
    }

    return this.mapToOutput(updatedVendor);
  }

  async suspendVendor(id: string): Promise<VendorOutput> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const updatedVendor = await this.vendorRepo.updateStatus(id, "suspended");
    if (!updatedVendor) {
      throw new Error("Failed to suspend vendor");
    }

    return this.mapToOutput(updatedVendor);
  }

  async updateVerificationStatus(
    id: string,
    status: "unverified" | "pending" | "verified" | "rejected"
  ): Promise<VendorOutput> {
    const vendor = await this.vendorRepo.findById(id);
    if (!vendor) {
      throw new Error("Vendor not found");
    }

    const updatedVendor = await this.vendorRepo.updateVerificationStatus(
      id,
      status
    );
    if (!updatedVendor) {
      throw new Error("Failed to update verification status");
    }

    return this.mapToOutput(updatedVendor);
  }

  async getVendorStats(vendorId: string): Promise<{
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    totalRevenue: string;
  }> {
    return this.vendorRepo.getVendorStats(vendorId);
  }

  async getVendorStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byVerificationStatus: Record<string, number>;
    approved: number;
    pending: number;
  }> {
    return this.vendorRepo.getStatistics();
  }

  async getRecentVendors(limit: number = 10): Promise<VendorOutput[]> {
    const vendors = await this.vendorRepo.getRecentVendors(limit);
    return vendors.map((vendor) => this.mapToOutput(vendor));
  }

  async getTopVendors(
    limit: number = 10
  ): Promise<Array<VendorOutput & { productCount: number }>> {
    const vendors = await this.vendorRepo.getTopVendorsByProducts(limit);
    return vendors.map((vendor) => ({
      ...this.mapToOutput(vendor),
      productCount: vendor.productCount,
    }));
  }

  private async generateUniqueSlug(
    businessName: string,
    excludeId?: string
  ): Promise<string> {
    let baseSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await this.vendorRepo.slugExists(slug, excludeId)) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  private mapToOutput(vendor: Vendor): VendorOutput {
    return {
      id: vendor.id,
      userId: vendor.userId,
      businessName: vendor.businessName,
      slug: vendor.slug,
      description: vendor.description,
      businessType: vendor.businessType,
      email: vendor.email,
      phoneNumber: vendor.phoneNumber,
      website: vendor.website,
      taxId: vendor.taxId,
      businessLicense: vendor.businessLicense,
      status: vendor.status,
      verificationStatus: vendor.verificationStatus,
      commissionRate: Number(vendor.commissionRate),
      autoApproveProducts: vendor.autoApproveProducts ?? false,
      allowReviews: vendor.allowReviews ?? true,
      metadata: vendor.metadata ?? undefined,
      approvedAt: vendor.approvedAt,
      createdAt: vendor.createdAt,
      updatedAt: vendor.updatedAt,
    };
  }

  private mapToOutputWithUser(vendor: any): VendorOutput {
    const output = this.mapToOutput(vendor);

    return {
      ...output,
      user: vendor.user
        ? {
            id: vendor.user.id,
            email: vendor.user.email,
            firstName: vendor.user.firstName,
            lastName: vendor.user.lastName,
          }
        : undefined,
    };
  }
}
