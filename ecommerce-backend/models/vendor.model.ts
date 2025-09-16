import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";
import validator from "validator";
import { ApiError } from "../utils/api-error";

export interface IVendorAddress {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface IBankAccount {
  accountName: string;
  accountNumber: string;
  bankName: string;
  routingNumber: string;
  swiftCode?: string;
  isDefault: boolean;
}

export interface ITaxInformation {
  taxId: string;
  businessType: string;
  taxDocuments: string[];
  vatRegistered: boolean;
  vatNumber?: string;
}

export interface IVendorDocument extends Document {
  businessName: string;
  slug: string;
  email: string;
  password: string;
  phone: string;
  description: string;
  logo?: string;
  bannerImage?: string;
  website?: string;
  socialMedia: {
    facebook?: string;
    twitter?: string;
    instagram?: string;
    pinterest?: string;
    youtube?: string;
  };
  addresses: IVendorAddress[];
  bankAccounts: IBankAccount[];
  taxInformation: ITaxInformation;
  commissionRate: number;
  minimumPayoutAmount: number;
  payoutSchedule: "daily" | "weekly" | "biweekly" | "monthly";
  status: "pending" | "approved" | "rejected" | "suspended";
  verificationDocuments: string[];
  verificationNotes?: string;
  returnPolicy?: string;
  shippingPolicy?: string;
  rating: {
    average: number;
    count: number;
  };
  metrics: {
    totalSales: number;
    totalOrders: number;
    totalProducts: number;
    conversionRate: number;
    averageOrderValue: number;
  };
  contactPerson: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
  };
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createPasswordResetToken(): string;
}

export interface IVendorModel extends Model<IVendorDocument> {
  findByEmail(email: string): Promise<IVendorDocument>;
}

const vendorSchema = new Schema<IVendorDocument>(
  {
    businessName: {
      type: String,
      required: [true, "Business name is required"],
      trim: true,
      minlength: [3, "Business name must be at least 3 characters"],
      maxlength: [100, "Business name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: (value: string) => validator.isMobilePhone(value),
        message: "Please provide a valid phone number",
      },
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    logo: {
      type: String,
      validate: {
        validator: (value: string) => validator.isURL(value),
        message: "Please provide a valid URL for the logo",
      },
    },
    bannerImage: {
      type: String,
      validate: {
        validator: (value: string) => validator.isURL(value),
        message: "Please provide a valid URL for the banner image",
      },
    },
    website: {
      type: String,
      validate: {
        validator: (value: string) => validator.isURL(value),
        message: "Please provide a valid URL for the website",
      },
    },
    socialMedia: {
      facebook: {
        type: String,
        validate: {
          validator: (value: string) => validator.isURL(value),
          message: "Please provide a valid URL for Facebook",
        },
      },
      twitter: {
        type: String,
        validate: {
          validator: (value: string) => validator.isURL(value),
          message: "Please provide a valid URL for Twitter",
        },
      },
      instagram: {
        type: String,
        validate: {
          validator: (value: string) => validator.isURL(value),
          message: "Please provide a valid URL for Instagram",
        },
      },
      pinterest: {
        type: String,
        validate: {
          validator: (value: string) => validator.isURL(value),
          message: "Please provide a valid URL for Pinterest",
        },
      },
      youtube: {
        type: String,
        validate: {
          validator: (value: string) => validator.isURL(value),
          message: "Please provide a valid URL for YouTube",
        },
      },
    },
    addresses: [
      {
        street: {
          type: String,
          required: [true, "Street address is required"],
          trim: true,
        },
        city: {
          type: String,
          required: [true, "City is required"],
          trim: true,
        },
        state: {
          type: String,
          required: [true, "State is required"],
          trim: true,
        },
        postalCode: {
          type: String,
          required: [true, "Postal code is required"],
          trim: true,
        },
        country: {
          type: String,
          required: [true, "Country is required"],
          trim: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    bankAccounts: [
      {
        accountName: {
          type: String,
          required: [true, "Account name is required"],
          trim: true,
        },
        accountNumber: {
          type: String,
          required: [true, "Account number is required"],
          trim: true,
        },
        bankName: {
          type: String,
          required: [true, "Bank name is required"],
          trim: true,
        },
        routingNumber: {
          type: String,
          required: [true, "Routing number is required"],
          trim: true,
        },
        swiftCode: {
          type: String,
          trim: true,
        },
        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],
    taxInformation: {
      taxId: {
        type: String,
        required: [true, "Tax ID is required"],
        trim: true,
      },
      businessType: {
        type: String,
        required: [true, "Business type is required"],
        enum: ["sole_proprietorship", "partnership", "corporation", "llc", "other"],
      },
      taxDocuments: [
        {
          type: String,
          validate: {
            validator: (value: string) => validator.isURL(value),
            message: "Please provide a valid URL for the tax document",
          },
        },
      ],
      vatRegistered: {
        type: Boolean,
        default: false,
      },
      vatNumber: {
        type: String,
        trim: true,
      },
    },
    commissionRate: {
      type: Number,
      required: [true, "Commission rate is required"],
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
      default: 10,
    },
    minimumPayoutAmount: {
      type: Number,
      required: [true, "Minimum payout amount is required"],
      min: [0, "Minimum payout amount cannot be negative"],
      default: 100,
    },
    payoutSchedule: {
      type: String,
      required: [true, "Payout schedule is required"],
      enum: ["daily", "weekly", "biweekly", "monthly"],
      default: "monthly",
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: ["pending", "approved", "rejected", "suspended"],
      default: "pending",
    },
    verificationDocuments: [
      {
        type: String,
        validate: {
          validator: (value: string) => validator.isURL(value),
          message: "Please provide a valid URL for the verification document",
        },
      },
    ],
    verificationNotes: {
      type: String,
      trim: true,
    },
    returnPolicy: {
      type: String,
      trim: true,
      maxlength: [5000, "Return policy cannot exceed 5000 characters"],
    },
    shippingPolicy: {
      type: String,
      trim: true,
      maxlength: [5000, "Shipping policy cannot exceed 5000 characters"],
    },
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    metrics: {
      totalSales: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalOrders: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalProducts: {
        type: Number,
        default: 0,
        min: 0,
      },
      conversionRate: {
        type: Number,
        default: 0,
        min: 0,
      },
      averageOrderValue: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    contactPerson: {
      firstName: {
        type: String,
        required: [true, "First name is required"],
        trim: true,
      },
      lastName: {
        type: String,
        required: [true, "Last name is required"],
        trim: true,
      },
      email: {
        type: String,
        required: [true, "Email is required"],
        trim: true,
        validate: [validator.isEmail, "Please provide a valid email"],
      },
      phone: {
        type: String,
        required: [true, "Phone number is required"],
        trim: true,
        validate: {
          validator: (value: string) => validator.isMobilePhone(value),
          message: "Please provide a valid phone number",
        },
      },
      position: {
        type: String,
        required: [true, "Position is required"],
        trim: true,
      },
    },
    active: {
      type: Boolean,
      default: true,
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    lastLogin: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for products
vendorSchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "vendor",
});

// Virtual for payouts
vendorSchema.virtual("payouts", {
  ref: "Payout",
  localField: "_id",
  foreignField: "vendor",
});

// Indexes
vendorSchema.index({ businessName: 1 });
vendorSchema.index({ email: 1 });
vendorSchema.index({ status: 1 });
vendorSchema.index({ "rating.average": -1 });
vendorSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
vendorSchema.pre("save", async function (next) {
  // Only hash the password if it's modified or new
  if (!this.isModified("password")) return next();

  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);

    // Update passwordChangedAt if not a new document
    if (!this.isNew) {
      this.passwordChangedAt = new Date(Date.now() - 1000); // Subtract 1 second to account for delay
    }

    next();
  } catch (error: any) {
    next(new ApiError(`Error hashing password: ${error.message}`, 500));
  }
});

// Method to compare passwords
vendorSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to check if password was changed after JWT was issued
vendorSchema.methods.changedPasswordAfter = function (JWTTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Method to create password reset token
vendorSchema.methods.createPasswordResetToken = function (): string {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest("hex");
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

// Static method to find vendor by email
vendorSchema.statics.findByEmail = async function (email: string): Promise<IVendorDocument> {
  return this.findOne({ email });
};

const Vendor = mongoose.model<IVendorDocument, IVendorModel>("Vendor", vendorSchema);

export default Vendor;
