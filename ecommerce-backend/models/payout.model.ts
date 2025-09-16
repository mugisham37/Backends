import mongoose, { Schema, type Document } from "mongoose";

export interface IPayout extends Document {
  vendor: mongoose.Types.ObjectId;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  paymentMethod: "bank_transfer" | "paypal" | "stripe" | "other";
  paymentDetails: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    routingNumber?: string;
    swiftCode?: string;
    paypalEmail?: string;
    stripeAccountId?: string;
    other?: Record<string, any>;
  };
  reference: string;
  description?: string;
  periodStart: Date;
  periodEnd: Date;
  orders: mongoose.Types.ObjectId[];
  transactionId?: string;
  processedAt?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    fee: {
      type: Number,
      required: [true, "Fee is required"],
      min: [0, "Fee cannot be negative"],
      default: 0,
    },
    netAmount: {
      type: Number,
      required: [true, "Net amount is required"],
      min: [0, "Net amount cannot be negative"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      default: "USD",
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    status: {
      type: String,
      required: [true, "Status is required"],
      enum: ["pending", "processing", "completed", "failed", "cancelled"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      enum: ["bank_transfer", "paypal", "stripe", "other"],
    },
    paymentDetails: {
      accountName: String,
      accountNumber: String,
      bankName: String,
      routingNumber: String,
      swiftCode: String,
      paypalEmail: String,
      stripeAccountId: String,
      other: Schema.Types.Mixed,
    },
    reference: {
      type: String,
      required: [true, "Reference is required"],
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    periodStart: {
      type: Date,
      required: [true, "Period start date is required"],
    },
    periodEnd: {
      type: Date,
      required: [true, "Period end date is required"],
    },
    orders: [
      {
        type: Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    transactionId: {
      type: String,
      trim: true,
    },
    processedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
payoutSchema.index({ vendor: 1 });
payoutSchema.index({ status: 1 });
payoutSchema.index({ createdAt: -1 });
payoutSchema.index({ reference: 1 }, { unique: true });
payoutSchema.index({ periodStart: 1, periodEnd: 1 });

const Payout = mongoose.model<IPayout>("Payout", payoutSchema);

export default Payout;
