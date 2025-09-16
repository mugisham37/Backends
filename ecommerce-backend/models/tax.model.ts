import mongoose, { type Document, Schema } from "mongoose"

export interface ITaxRate extends Document {
  name: string
  rate: number // Percentage (e.g., 7.5 for 7.5%)
  country: string
  state?: string
  postalCode?: string
  isDefault: boolean
  isActive: boolean
  priority: number // Higher priority rates override lower ones when multiple rates apply
  productCategories?: mongoose.Types.ObjectId[] // Apply to specific product categories only
  createdAt: Date
  updatedAt: Date
}

const taxRateSchema = new Schema<ITaxRate>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    rate: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    postalCode: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    productCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Ensure only one default tax rate
taxRateSchema.pre("save", async function (next) {
  if (this.isDefault) {
    // If this tax rate is being set as default, unset any existing default
    await this.constructor.updateMany({ _id: { $ne: this._id }, isDefault: true }, { isDefault: false })
  }
  next()
})

// Create index for efficient tax lookup
taxRateSchema.index({ country: 1, state: 1, postalCode: 1, priority: -1 })

const TaxRate = mongoose.model<ITaxRate>("TaxRate", taxRateSchema)

export default TaxRate
