import mongoose, { Schema, type Document } from "mongoose"

export enum FieldDataType {
  STRING = "string",
  TEXT = "text",
  RICH_TEXT = "richText",
  NUMBER = "number",
  INTEGER = "integer",
  FLOAT = "float",
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
  COMPONENT = "component",
  ENUM = "enum",
  COLOR = "color",
  GEO_POINT = "geoPoint",
  RELATION = "relation",
  CUSTOM = "custom",
}

export enum FieldUIType {
  TEXT_INPUT = "textInput",
  TEXT_AREA = "textArea",
  RICH_TEXT_EDITOR = "richTextEditor",
  NUMBER_INPUT = "numberInput",
  CHECKBOX = "checkbox",
  TOGGLE = "toggle",
  DATE_PICKER = "datePicker",
  DATE_TIME_PICKER = "dateTimePicker",
  EMAIL_INPUT = "emailInput",
  URL_INPUT = "urlInput",
  IMAGE_UPLOADER = "imageUploader",
  FILE_UPLOADER = "fileUploader",
  REFERENCE_SELECTOR = "referenceSelector",
  JSON_EDITOR = "jsonEditor",
  ARRAY_EDITOR = "arrayEditor",
  COMPONENT_EDITOR = "componentEditor",
  SELECT = "select",
  MULTI_SELECT = "multiSelect",
  RADIO_GROUP = "radioGroup",
  COLOR_PICKER = "colorPicker",
  MAP = "map",
  RELATION_EDITOR = "relationEditor",
  CUSTOM_UI = "customUI",
}

export interface IFieldValidation {
  required?: boolean
  unique?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: string[]
  message?: string
}

export interface IFieldType extends Document {
  name: string
  displayName: string
  description?: string
  dataType: FieldDataType
  uiType: FieldUIType
  isSystem: boolean
  isBuiltIn: boolean
  validations: IFieldValidation[]
  settings: Record<string, any>
  pluginId?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const fieldValidationSchema = new Schema<IFieldValidation>(
  {
    required: Boolean,
    unique: Boolean,
    min: Number,
    max: Number,
    minLength: Number,
    maxLength: Number,
    pattern: String,
    enum: [String],
    message: String,
  },
  { _id: false },
)

const fieldTypeSchema = new Schema<IFieldType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
    dataType: {
      type: String,
      enum: Object.values(FieldDataType),
      required: true,
    },
    uiType: {
      type: String,
      enum: Object.values(FieldUIType),
      required: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    isBuiltIn: {
      type: Boolean,
      default: false,
    },
    validations: {
      type: [fieldValidationSchema],
      default: [],
    },
    settings: {
      type: Schema.Types.Mixed,
      default: {},
    },
    pluginId: {
      type: Schema.Types.ObjectId,
      ref: "Plugin",
    },
  },
  {
    timestamps: true,
  },
)

export const FieldTypeModel = mongoose.model<IFieldType>("FieldType", fieldTypeSchema)
