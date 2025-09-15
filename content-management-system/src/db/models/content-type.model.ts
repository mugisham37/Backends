import mongoose, { type Document, Schema } from "mongoose"

// Field type enum
export enum FieldType {
  STRING = "string",
  TEXT = "text",
  RICH_TEXT = "richText",
  NUMBER = "number",
  BOOLEAN = "boolean",
  DATE = "date",
  DATETIME = "datetime",
  EMAIL = "email",
  URL = "url",
  IMAGE = "image",
  FILE = "file",
  REFERENCE = "reference",
  JSON = "json",
  ARRAY = "array",
}

// Field validation interface
export interface IFieldValidation {
  required?: boolean
  unique?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: string[]
}

// Field interface
export interface IField extends Document {
  name: string
  displayName: string
  type: FieldType
  description?: string
  validation?: IFieldValidation
  defaultValue?: any
  isSystem: boolean
  isLocalized: boolean
  settings?: any
}

// Content type interface
export interface IContentType extends Document {
  name: string
  displayName: string
  description?: string
  fields: IField[]
  isSystem: boolean
  createdAt: Date
  updatedAt: Date
}

// Field validation schema
const fieldValidationSchema = new Schema<IFieldValidation>(
  {
    required: {
      type: Boolean,
      default: false,
    },
    unique: {
      type: Boolean,
      default: false,
    },
    min: {
      type: Number,
    },
    max: {
      type: Number,
    },
    minLength: {
      type: Number,
    },
    maxLength: {
      type: Number,
    },
    pattern: {
      type: String,
    },
    enum: {
      type: [String],
    },
  },
  { _id: false },
)

// Field schema
const fieldSchema = new Schema<IField>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(FieldType),
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    validation: {
      type: fieldValidationSchema,
    },
    defaultValue: {
      type: Schema.Types.Mixed,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isLocalized: {
      type: Boolean,
      default: false,
    },
    settings: {
      type: Schema.Types.Mixed,
    },
  },
  { _id: true },
)

// Content type schema
const contentTypeSchema = new Schema<IContentType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9_-]+$/,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    fields: {
      type: [fieldSchema],
      default: [],
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
)

// Middleware to ensure required system fields
contentTypeSchema.pre("save", function (next) {
  // Ensure id field exists
  const hasIdField = this.fields.some((field) => field.name === "id")
  if (!hasIdField) {
    this.fields.push({
      name: "id",
      displayName: "ID",
      type: FieldType.STRING,
      description: "Unique identifier",
      isSystem: true,
      isLocalized: false,
      validation: {
        required: true,
        unique: true,
      },
    } as IField)
  }

  // Ensure createdAt field exists
  const hasCreatedAtField = this.fields.some((field) => field.name === "createdAt")
  if (!hasCreatedAtField) {
    this.fields.push({
      name: "createdAt",
      displayName: "Created At",
      type: FieldType.DATETIME,
      description: "Creation date",
      isSystem: true,
      isLocalized: false,
      validation: {
        required: true,
      },
    } as IField)
  }

  // Ensure updatedAt field exists
  const hasUpdatedAtField = this.fields.some((field) => field.name === "updatedAt")
  if (!hasUpdatedAtField) {
    this.fields.push({
      name: "updatedAt",
      displayName: "Updated At",
      type: FieldType.DATETIME,
      description: "Last update date",
      isSystem: true,
      isLocalized: false,
      validation: {
        required: true,
      },
    } as IField)
  }

  next()
})

// Create and export the model
export const ContentTypeModel = mongoose.model<IContentType>("ContentType", contentTypeSchema)
