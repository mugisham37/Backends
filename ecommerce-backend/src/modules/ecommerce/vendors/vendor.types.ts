/**
 * Vendor service types
 * Input/Output DTOs for clean interfaces
 */

import {
  vendorStatusEnum,
  verificationStatusEnum,
} from "../../../core/database/schema";

// Input types
export interface CreateVendorInput {
  businessName: string;
  description?: string;
  businessType?: string;
  email: string;
  phoneNumber?: string;
  website?: string;
  taxId?: string;
  businessLicense?: string;
  commissionRate?: number;
  metadata?: {
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
    businessHours?: {
      [key: string]: {
        open: string;
        close: string;
        closed: boolean;
      };
    };
    shippingPolicies?: string;
    returnPolicy?: string;
  };
}

export interface UpdateVendorInput {
  businessName?: string;
  description?: string;
  businessType?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  taxId?: string;
  businessLicense?: string;
  autoApproveProducts?: boolean;
  allowReviews?: boolean;
  metadata?: {
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
    businessHours?: {
      [key: string]: {
        open: string;
        close: string;
        closed: boolean;
      };
    };
    shippingPolicies?: string;
    returnPolicy?: string;
  };
}

// Output types
export interface VendorOutput {
  id: string;
  userId: string;
  businessName: string;
  slug: string;
  description: string | null;
  businessType: string | null;
  email: string;
  phoneNumber: string | null;
  website: string | null;
  taxId: string | null;
  businessLicense: string | null;
  status: (typeof vendorStatusEnum.enumValues)[number];
  verificationStatus: (typeof verificationStatusEnum.enumValues)[number];
  commissionRate: number;
  autoApproveProducts: boolean;
  allowReviews: boolean;
  metadata?: {
    socialMedia?: {
      facebook?: string;
      twitter?: string;
      instagram?: string;
      linkedin?: string;
    };
    businessHours?: {
      [key: string]: {
        open: string;
        close: string;
        closed: boolean;
      };
    };
    shippingPolicies?: string;
    returnPolicy?: string;
  };
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;

  // Optional relations
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}
