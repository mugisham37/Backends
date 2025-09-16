import mongoose, { type Document, Schema } from "mongoose";

export interface ICountry extends Document {
  code: string;
  name: string;
  isActive: boolean;
  phoneCode: string;
  currency: mongoose.Types.ObjectId;
  defaultLanguage: string;
  states?: {
    code: string;
    name: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const countrySchema = new Schema<ICountry>(
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
    isActive: {
      type: Boolean,
      default: true,
    },
    phoneCode: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: Schema.Types.ObjectId,
      ref: "Currency",
      required: true,
    },
    defaultLanguage: {
      type: String,
      required: true,
      trim: true,
      default: "en",
    },
    states: [
      {
        code: {
          type: String,
          required: true,
          trim: true,
          uppercase: true,
        },
        name: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Create index for efficient country lookup
countrySchema.index({ code: 1 });
countrySchema.index({ name: "text" });

const Country = mongoose.model<ICountry>("Country", countrySchema);

export default Country;
