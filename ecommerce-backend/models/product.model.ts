import mongoose, { Schema, type Document } from "mongoose";
import slugify from "slugify";

export interface IProductVariant {
  sku: string;
  attributes: Array<{
    name: string;
    value: string;
  }>;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  images?: string[];
}

export interface IProductDocument extends Document {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  quantity: number;
  sku?: string;
  barcode?: string;
  images: string[];
  category: mongoose.Types.ObjectId;
  subcategories?: mongoose.Types.ObjectId[];
  tags?: string[];
  attributes?: Array<{
    name: string;
    value: string;
  }>;
  variants: IProductVariant[];
  featured: boolean;
  active: boolean;
  ratings: {
    average: number;
    count: number;
  };
  seo: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: string;
  };
  weight?: {
    value: number;
    unit: string;
  };
  shippingClass?: string;
  taxClass?: string;
  vendor: mongoose.Types.ObjectId;
  commission?: number;
  warrantyInformation?: string;
  returnPolicy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: [500, "Short description cannot exceed 500 characters"],
    },
    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [0, "Price cannot be negative"],
    },
    compareAtPrice: {
      type: Number,
      min: [0, "Compare at price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Product quantity is required"],
      min: [0, "Quantity cannot be negative"],
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
      sparse: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
    },
    images: [
      {
        type: String,
        validate: {
          validator: (v: string) => {
            // Simple URL validation
            return /^(http|https):\/\/[^ "]+$/.test(v);
          },
          message: (props: any) => `${props.value} is not a valid URL!`,
        },
      },
    ],
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
    },
    subcategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    attributes: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        value: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],
    variants: [
      {
        sku: {
          type: String,
          required: true,
          trim: true,
        },
        attributes: [
          {
            name: {
              type: String,
              required: true,
              trim: true,
            },
            value: {
              type: String,
              required: true,
              trim: true,
            },
          },
        ],
        price: {
          type: Number,
          required: true,
          min: [0, "Price cannot be negative"],
        },
        compareAtPrice: {
          type: Number,
          min: [0, "Compare at price cannot be negative"],
        },
        quantity: {
          type: Number,
          required: true,
          min: [0, "Quantity cannot be negative"],
          default: 0,
        },
        images: [
          {
            type: String,
            validate: {
              validator: (v: string) => {
                // Simple URL validation
                return /^(http|https):\/\/[^ "]+$/.test(v);
              },
              message: (props: any) => `${props.value} is not a valid URL!`,
            },
          },
        ],
      },
    ],
    featured: {
      type: Boolean,
      default: false,
    },
    active: {
      type: Boolean,
      default: true,
    },
    ratings: {
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
    seo: {
      title: {
        type: String,
        trim: true,
        maxlength: [100, "SEO title cannot exceed 100 characters"],
      },
      description: {
        type: String,
        trim: true,
        maxlength: [160, "SEO description cannot exceed 160 characters"],
      },
      keywords: [
        {
          type: String,
          trim: true,
        },
      ],
    },
    dimensions: {
      length: {
        type: Number,
        min: [0, "Length cannot be negative"],
      },
      width: {
        type: Number,
        min: [0, "Width cannot be negative"],
      },
      height: {
        type: Number,
        min: [0, "Height cannot be negative"],
      },
      unit: {
        type: String,
        enum: ["cm", "in", "mm", "m", "ft"],
        default: "cm",
      },
    },
    weight: {
      value: {
        type: Number,
        min: [0, "Weight cannot be negative"],
      },
      unit: {
        type: String,
        enum: ["kg", "g", "lb", "oz"],
        default: "kg",
      },
    },
    shippingClass: {
      type: String,
      trim: true,
    },
    taxClass: {
      type: String,
      trim: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: "Vendor",
      required: [true, "Vendor is required"],
    },
    commission: {
      type: Number,
      min: [0, "Commission cannot be negative"],
      max: [100, "Commission cannot exceed 100%"],
    },
    warrantyInformation: {
      type: String,
      trim: true,
    },
    returnPolicy: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for reviews
productSchema.virtual("reviews", {
  ref: "Review",
  localField: "_id",
  foreignField: "product",
});

// Pre-save middleware to create slug
productSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

// Indexes
productSchema.index({
  name: "text",
  description: "text",
  "attributes.value": "text",
  tags: "text",
});
productSchema.index({ price: 1 });
productSchema.index({ category: 1 });
productSchema.index({ vendor: 1 });
productSchema.index({ "ratings.average": -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ featured: 1 });
productSchema.index({ active: 1 });

const Product = mongoose.model<IProductDocument>("Product", productSchema);

export default Product;
