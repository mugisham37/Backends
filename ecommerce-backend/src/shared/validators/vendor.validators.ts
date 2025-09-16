import { z } from "zod";

// Base schemas
const uuidSchema = z.string().uuid("Invalid UUID format");
const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

// Vendor status and business type enums
const vendorStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "suspended",
  "inactive",
]);
const businessTypeSchema = z.enum([
  "sole_proprietorship",
  "partnership",
  "corporation",
  "llc",
  "other",
]);
const payoutScheduleSchema = z.enum(["daily", "weekly", "biweekly", "monthly"]);
const paymentMethodSchema = z.enum([
  "bank_transfer",
  "paypal",
  "stripe",
  "other",
]);

// Address schema
const addressSchema = z.object({
  id: uuidSchema.optional(),
  type: z.enum(["business", "billing", "shipping"]).default("business"),
  street: z.string().min(1, "Street address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(2, "Country is required").max(3),
  isDefault: z.boolean().default(false),
});

// Bank account schema
const bankAccountSchema = z.object({
  id: uuidSchema.optional(),
  accountName: z.string().min(1, "Account name is required").max(100),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  bankName: z.string().min(1, "Bank name is required").max(100),
  routingNumber: z.string().min(1, "Routing number is required").max(20),
  swiftCode: z.string().max(20).optional(),
  currency: z.string().length(3).default("USD"),
  isDefault: z.boolean().default(false),
});

// Tax information schema
const taxInformationSchema = z.object({
  taxId: z.string().min(1, "Tax ID is required").max(50),
  businessType: businessTypeSchema,
  taxDocuments: z.array(z.string().url()).max(10).default([]),
  vatRegistered: z.boolean().default(false),
  vatNumber: z.string().max(50).optional(),
});

// Contact person schema
const contactPersonSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
  email: z.string().email("Invalid email format"),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number format"),
  position: z.string().min(1, "Position is required").max(100),
});

// Social media schema
const socialMediaSchema = z.object({
  facebook: z.string().url().optional(),
  twitter: z.string().url().optional(),
  instagram: z.string().url().optional(),
  pinterest: z.string().url().optional(),
  youtube: z.string().url().optional(),
  linkedin: z.string().url().optional(),
});

// Create vendor schema
export const createVendorSchema = z.object({
  businessName: z
    .string()
    .min(3, "Business name must be at least 3 characters")
    .max(100),
  slug: slugSchema.optional(),
  email: z.string().email("Invalid email format").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number format"),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  logo: z.string().url("Invalid logo URL").optional(),
  bannerImage: z.string().url("Invalid banner image URL").optional(),
  website: z.string().url("Invalid website URL").optional(),
  socialMedia: socialMediaSchema.optional(),
  addresses: z
    .array(addressSchema)
    .min(1, "At least one address is required")
    .max(5),
  bankAccounts: z
    .array(bankAccountSchema)
    .min(1, "At least one bank account is required")
    .max(3),
  taxInformation: taxInformationSchema,
  contactPerson: contactPersonSchema,
  commissionRate: z.number().min(0).max(100).default(10),
  minimumPayoutAmount: z.number().min(0).default(100),
  payoutSchedule: payoutScheduleSchema.default("monthly"),
  returnPolicy: z.string().max(5000).optional(),
  shippingPolicy: z.string().max(5000).optional(),
  verificationDocuments: z.array(z.string().url()).max(10).default([]),
  verificationNotes: z.string().max(1000).optional(),
  status: vendorStatusSchema.default("pending"),
  active: z.boolean().default(true),
});

// Update vendor schema
export const updateVendorSchema = createVendorSchema
  .omit({ password: true, email: true })
  .partial();

// Update vendor status schema
export const updateVendorStatusSchema = z.object({
  status: vendorStatusSchema,
  notes: z.string().max(1000).optional(),
  rejectionReason: z.string().max(500).optional(),
});

// Vendor filters schema
export const vendorFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  status: vendorStatusSchema.optional(),
  businessType: businessTypeSchema.optional(),
  country: z.string().max(3).optional(),
  commissionRateMin: z.number().min(0).max(100).optional(),
  commissionRateMax: z.number().min(0).max(100).optional(),
  createdAfter: z.date().optional(),
  createdBefore: z.date().optional(),
  sortBy: z
    .enum([
      "businessName",
      "createdAt",
      "updatedAt",
      "commissionRate",
      "status",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Payout schemas
export const calculatePayoutSchema = z.object({
  vendorId: uuidSchema,
  startDate: z.date(),
  endDate: z.date().refine((date, ctx) => {
    const startDate = ctx.parent.startDate;
    return date > startDate;
  }, "End date must be after start date"),
});

export const createPayoutSchema = z.object({
  vendorId: uuidSchema,
  amount: z.number().min(0, "Amount must be non-negative"),
  fee: z.number().min(0, "Fee must be non-negative"),
  netAmount: z.number().min(0, "Net amount must be non-negative"),
  currency: z.string().length(3).default("USD"),
  paymentMethod: paymentMethodSchema,
  paymentDetails: z
    .object({
      accountName: z.string().optional(),
      accountNumber: z.string().optional(),
      bankName: z.string().optional(),
      routingNumber: z.string().optional(),
      swiftCode: z.string().optional(),
      paypalEmail: z.string().email().optional(),
      stripeAccountId: z.string().optional(),
      other: z.record(z.any()).optional(),
    })
    .optional(),
  reference: z.string().min(1, "Reference is required").max(100),
  description: z.string().max(500).optional(),
  periodStart: z.date(),
  periodEnd: z.date(),
  orderIds: z.array(uuidSchema).default([]),
});

export const updatePayoutStatusSchema = z.object({
  status: z.enum(["pending", "processing", "completed", "failed", "cancelled"]),
  transactionId: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  processedAt: z.date().optional(),
});

// Vendor metrics schema
export const vendorMetricsSchema = z.object({
  vendorId: uuidSchema,
  startDate: z.date(),
  endDate: z.date(),
  includeProducts: z.boolean().default(false),
  includeOrders: z.boolean().default(false),
  includeRevenue: z.boolean().default(true),
});

// Type exports
export type CreateVendorInput = z.infer<typeof createVendorSchema>;
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>;
export type UpdateVendorStatusInput = z.infer<typeof updateVendorStatusSchema>;
export type VendorFilters = z.infer<typeof vendorFiltersSchema>;
export type CalculatePayoutInput = z.infer<typeof calculatePayoutSchema>;
export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;
export type UpdatePayoutStatusInput = z.infer<typeof updatePayoutStatusSchema>;
export type VendorMetricsInput = z.infer<typeof vendorMetricsSchema>;
export type VendorStatus = z.infer<typeof vendorStatusSchema>;
export type BusinessType = z.infer<typeof businessTypeSchema>;
export type PayoutSchedule = z.infer<typeof payoutScheduleSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
