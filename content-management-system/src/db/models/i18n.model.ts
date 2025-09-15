import mongoose, { type Document, Schema } from "mongoose"

// Translation interface
export interface ITranslation extends Document {
  locale: string
  namespace: string
  key: string
  value: string
  tenantId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

// Translation schema
const translationSchema = new Schema<ITranslation>(
  {
    locale: {
      type: String,
      required: true,
      trim: true,
    },
    namespace: {
      type: String,
      required: true,
      trim: true,
      default: "common",
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: String,
      required: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: "Tenant",
    },
  },
  {
    timestamps: true,
  },
)

// Compound index for uniqueness
translationSchema.index({ locale: 1, namespace: 1, key: 1, tenantId: 1 }, { unique: true, sparse: true })

// Create and export the model
export const TranslationModel = mongoose.model<ITranslation>("Translation", translationSchema)
