import mongoose, { type Document, Schema } from "mongoose";
import { createRequestLogger } from "../config/logger";

export interface ICurrency extends Document {
  code: string;
  name: string;
  symbol: string;
  rate: number; // Exchange rate relative to base currency
  isBase: boolean;
  isActive: boolean;
  decimalPlaces: number;
  createdAt: Date;
  updatedAt: Date;
}

const currencySchema = new Schema<ICurrency>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    isBase: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    decimalPlaces: {
      type: Number,
      required: true,
      default: 2,
      min: 0,
      max: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one base currency
currencySchema.pre("save", async function (next) {
  const logger = createRequestLogger();

  try {
    if (this.isBase) {
      // If this currency is being set as base, unset any existing base currency
      await this.constructor.updateMany(
        { _id: { $ne: this._id }, isBase: true },
        { isBase: false }
      );
      logger.info(`Set ${this.code} as base currency and unset any previous base currencies`);
    }
    next();
  } catch (error) {
    logger.error(`Error in currency pre-save hook: ${error.message}`);
    next(error);
  }
});

// Format currency amount
currencySchema.methods.format = function (amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: this.code,
    minimumFractionDigits: this.decimalPlaces,
    maximumFractionDigits: this.decimalPlaces,
  }).format(amount);
};

// Convert amount from base currency to this currency
currencySchema.methods.fromBase = function (amount: number): number {
  return amount * this.rate;
};

// Convert amount from this currency to base currency
currencySchema.methods.toBase = function (amount: number): number {
  return amount / this.rate;
};

const Currency = mongoose.model<ICurrency>("Currency", currencySchema);

export default Currency;
