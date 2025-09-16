/**
 * Approve Vendor Use Case
 * Application logic for vendor approval process
 */

import { VendorService } from "../vendor.service";
import { VendorOutput } from "../vendor.types";

export interface ApproveVendorCommand {
  vendorId: string;
  approvedBy: string; // Admin user ID
}

export class ApproveVendorUseCase {
  constructor(private vendorService: VendorService) {}

  async execute(command: ApproveVendorCommand): Promise<VendorOutput> {
    const { vendorId, approvedBy } = command;

    // Validate input
    if (!vendorId || vendorId.trim().length === 0) {
      throw new Error("Vendor ID is required");
    }

    if (!approvedBy || approvedBy.trim().length === 0) {
      throw new Error("Approver ID is required");
    }

    // Get current vendor to validate state
    const currentVendor = await this.vendorService.getVendor(vendorId);
    if (!currentVendor) {
      throw new Error("Vendor not found");
    }

    // Business rules for approval
    this.validateApprovalEligibility(currentVendor);

    // Approve vendor through service
    const approvedVendor = await this.vendorService.approveVendor(vendorId);

    // TODO: Send approval notification email
    // TODO: Log approval action for audit trail

    return approvedVendor;
  }

  private validateApprovalEligibility(vendor: VendorOutput): void {
    if (vendor.status === "approved") {
      throw new Error("Vendor is already approved");
    }

    if (vendor.status === "suspended") {
      throw new Error("Cannot approve a suspended vendor");
    }

    if (vendor.status === "rejected") {
      throw new Error(
        "Cannot approve a rejected vendor. Please create a new application."
      );
    }

    // Validate required information is complete
    if (!vendor.businessName || vendor.businessName.trim().length === 0) {
      throw new Error("Business name is required for approval");
    }

    if (!vendor.email || vendor.email.trim().length === 0) {
      throw new Error("Email is required for approval");
    }

    if (!vendor.taxId || vendor.taxId.trim().length === 0) {
      throw new Error("Tax ID is required for approval");
    }

    if (!vendor.businessLicense || vendor.businessLicense.trim().length === 0) {
      throw new Error("Business license is required for approval");
    }
  }
}
