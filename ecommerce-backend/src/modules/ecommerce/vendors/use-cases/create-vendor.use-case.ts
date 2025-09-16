/**
 * Create Vendor Use Case
 * Application logic for vendor registration
 */

import { VendorService } from "../vendor.service";
import { CreateVendorInput, VendorOutput } from "../vendor.types";

export interface CreateVendorCommand {
  userId: string;
  vendorData: CreateVendorInput;
}

export class CreateVendorUseCase {
  constructor(private vendorService: VendorService) {}

  async execute(command: CreateVendorCommand): Promise<VendorOutput> {
    const { userId, vendorData } = command;

    // Validate input
    this.validateInput(vendorData);

    // Create vendor through service
    return this.vendorService.createVendor(userId, vendorData);
  }

  private validateInput(input: CreateVendorInput): void {
    if (!input.businessName || input.businessName.trim().length === 0) {
      throw new Error("Business name is required");
    }

    if (input.businessName.length > 255) {
      throw new Error("Business name must be 255 characters or less");
    }

    if (!input.email || input.email.trim().length === 0) {
      throw new Error("Email is required");
    }

    if (!this.isValidEmail(input.email)) {
      throw new Error("Invalid email format");
    }

    if (input.phoneNumber && !this.isValidPhoneNumber(input.phoneNumber)) {
      throw new Error("Invalid phone number format");
    }

    if (input.website && !this.isValidUrl(input.website)) {
      throw new Error("Invalid website URL format");
    }

    if (input.commissionRate !== undefined) {
      if (input.commissionRate < 0 || input.commissionRate > 100) {
        throw new Error("Commission rate must be between 0 and 100");
      }
    }

    if (input.description && input.description.length > 2000) {
      throw new Error("Description must be 2000 characters or less");
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, "").length >= 10;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
