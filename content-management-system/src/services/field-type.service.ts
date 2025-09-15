import {
  FieldTypeModel,
  FieldDataType,
  FieldUIType,
  type IFieldType,
  type IFieldValidation,
} from "../db/models/field-type.model"
import { ApiError } from "../utils/errors"
import { logger } from "../utils/logger"
import type { Types } from "mongoose"

export class FieldTypeService {
  /**
   * Initialize built-in field types
   */
  public async initializeBuiltInFieldTypes(): Promise<void> {
    try {
      const builtInFieldTypes = [
        {
          name: "string",
          displayName: "String",
          description: "Single line text field",
          dataType: FieldDataType.STRING,
          uiType: FieldUIType.TEXT_INPUT,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }, { minLength: 0 }, { maxLength: 255 }],
          settings: {
            placeholder: "",
            defaultValue: "",
          },
        },
        {
          name: "text",
          displayName: "Text",
          description: "Multi-line text field",
          dataType: FieldDataType.TEXT,
          uiType: FieldUIType.TEXT_AREA,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            placeholder: "",
            defaultValue: "",
            rows: 4,
          },
        },
        {
          name: "richText",
          displayName: "Rich Text",
          description: "Rich text editor with formatting options",
          dataType: FieldDataType.RICH_TEXT,
          uiType: FieldUIType.RICH_TEXT_EDITOR,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: "",
            toolbar: ["bold", "italic", "underline", "link", "bulletList", "orderedList"],
          },
        },
        {
          name: "number",
          displayName: "Number",
          description: "Numeric field",
          dataType: FieldDataType.NUMBER,
          uiType: FieldUIType.NUMBER_INPUT,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }, { min: null }, { max: null }],
          settings: {
            placeholder: "",
            defaultValue: null,
            step: 1,
          },
        },
        {
          name: "boolean",
          displayName: "Boolean",
          description: "True/false field",
          dataType: FieldDataType.BOOLEAN,
          uiType: FieldUIType.TOGGLE,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: false,
            labelOn: "Yes",
            labelOff: "No",
          },
        },
        {
          name: "date",
          displayName: "Date",
          description: "Date picker",
          dataType: FieldDataType.DATE,
          uiType: FieldUIType.DATE_PICKER,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: null,
            format: "YYYY-MM-DD",
          },
        },
        {
          name: "datetime",
          displayName: "Date & Time",
          description: "Date and time picker",
          dataType: FieldDataType.DATETIME,
          uiType: FieldUIType.DATE_TIME_PICKER,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: null,
            format: "YYYY-MM-DD HH:mm",
          },
        },
        {
          name: "email",
          displayName: "Email",
          description: "Email address field",
          dataType: FieldDataType.EMAIL,
          uiType: FieldUIType.EMAIL_INPUT,
          isSystem: true,
          isBuiltIn: true,
          validations: [
            { required: false },
            {
              pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
              message: "Please enter a valid email address",
            },
          ],
          settings: {
            placeholder: "",
            defaultValue: "",
          },
        },
        {
          name: "url",
          displayName: "URL",
          description: "URL field",
          dataType: FieldDataType.URL,
          uiType: FieldUIType.URL_INPUT,
          isSystem: true,
          isBuiltIn: true,
          validations: [
            { required: false },
            {
              pattern: "^(https?:\\/\\/)?([\\da-z.-]+)\\.([a-z.]{2,6})([\\/\\w .-]*)*\\/?$",
              message: "Please enter a valid URL",
            },
          ],
          settings: {
            placeholder: "",
            defaultValue: "",
          },
        },
        {
          name: "image",
          displayName: "Image",
          description: "Image upload field",
          dataType: FieldDataType.IMAGE,
          uiType: FieldUIType.IMAGE_UPLOADER,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            maxSize: 5242880, // 5MB
            allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
            dimensions: {
              width: null,
              height: null,
              aspectRatio: null,
            },
          },
        },
        {
          name: "file",
          displayName: "File",
          description: "File upload field",
          dataType: FieldDataType.FILE,
          uiType: FieldUIType.FILE_UPLOADER,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            maxSize: 10485760, // 10MB
            allowedTypes: ["*/*"],
          },
        },
        {
          name: "reference",
          displayName: "Reference",
          description: "Reference to another content type",
          dataType: FieldDataType.REFERENCE,
          uiType: FieldUIType.REFERENCE_SELECTOR,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            contentTypeId: null,
            displayField: "title",
          },
        },
        {
          name: "json",
          displayName: "JSON",
          description: "JSON data field",
          dataType: FieldDataType.JSON,
          uiType: FieldUIType.JSON_EDITOR,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: {},
          },
        },
        {
          name: "array",
          displayName: "Array",
          description: "Array of values",
          dataType: FieldDataType.ARRAY,
          uiType: FieldUIType.ARRAY_EDITOR,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }, { minLength: 0 }, { maxLength: null }],
          settings: {
            itemType: "string",
            defaultValue: [],
          },
        },
        {
          name: "component",
          displayName: "Component",
          description: "Reusable component",
          dataType: FieldDataType.COMPONENT,
          uiType: FieldUIType.COMPONENT_EDITOR,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            componentId: null,
            allowMultiple: false,
          },
        },
        {
          name: "enum",
          displayName: "Enumeration",
          description: "Select from predefined options",
          dataType: FieldDataType.ENUM,
          uiType: FieldUIType.SELECT,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }, { enum: [] }],
          settings: {
            options: [],
            defaultValue: null,
            allowMultiple: false,
          },
        },
        {
          name: "color",
          displayName: "Color",
          description: "Color picker",
          dataType: FieldDataType.COLOR,
          uiType: FieldUIType.COLOR_PICKER,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: null,
            format: "hex", // hex, rgb, rgba
          },
        },
        {
          name: "geoPoint",
          displayName: "Geographic Point",
          description: "Geographic coordinates",
          dataType: FieldDataType.GEO_POINT,
          uiType: FieldUIType.MAP,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            defaultValue: null,
          },
        },
        {
          name: "relation",
          displayName: "Relation",
          description: "Relation to other content types",
          dataType: FieldDataType.RELATION,
          uiType: FieldUIType.RELATION_EDITOR,
          isSystem: true,
          isBuiltIn: true,
          validations: [{ required: false }],
          settings: {
            contentTypeId: null,
            relationType: "oneToMany", // oneToOne, oneToMany, manyToMany
            inversedBy: null,
          },
        },
      ]

      // Check if built-in field types already exist
      const existingCount = await FieldTypeModel.countDocuments({ isBuiltIn: true })

      if (existingCount === builtInFieldTypes.length) {
        logger.info("Built-in field types already initialized")
        return
      }

      // Delete existing built-in field types
      await FieldTypeModel.deleteMany({ isBuiltIn: true })

      // Create built-in field types
      await FieldTypeModel.insertMany(builtInFieldTypes)

      logger.info(`Initialized ${builtInFieldTypes.length} built-in field types`)
    } catch (error) {
      logger.error("Failed to initialize built-in field types:", error)
      throw new ApiError(500, "Failed to initialize built-in field types")
    }
  }

  /**
   * Get all field types
   */
  public async getAllFieldTypes(): Promise<IFieldType[]> {
    try {
      return await FieldTypeModel.find().sort({ name: 1 })
    } catch (error) {
      logger.error("Failed to get field types:", error)
      throw new ApiError(500, "Failed to get field types")
    }
  }

  /**
   * Get field type by ID
   */
  public async getFieldTypeById(id: string): Promise<IFieldType> {
    try {
      const fieldType = await FieldTypeModel.findById(id)
      if (!fieldType) {
        throw new ApiError(404, "Field type not found")
      }
      return fieldType
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to get field type:", error)
      throw new ApiError(500, "Failed to get field type")
    }
  }

  /**
   * Get field type by name
   */
  public async getFieldTypeByName(name: string): Promise<IFieldType> {
    try {
      const fieldType = await FieldTypeModel.findOne({ name })
      if (!fieldType) {
        throw new ApiError(404, "Field type not found")
      }
      return fieldType
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to get field type:", error)
      throw new ApiError(500, "Failed to get field type")
    }
  }

  /**
   * Create a new field type
   */
  public async createFieldType(
    name: string,
    displayName: string,
    dataType: FieldDataType,
    uiType: FieldUIType,
    description?: string,
    validations: IFieldValidation[] = [],
    settings: Record<string, any> = {},
    pluginId?: Types.ObjectId,
  ): Promise<IFieldType> {
    try {
      // Check if field type already exists
      const existingFieldType = await FieldTypeModel.findOne({ name })
      if (existingFieldType) {
        throw new ApiError(409, `Field type with name '${name}' already exists`)
      }

      // Create field type
      const fieldType = new FieldTypeModel({
        name,
        displayName,
        description,
        dataType,
        uiType,
        isSystem: false,
        isBuiltIn: false,
        validations,
        settings,
        pluginId,
      })

      await fieldType.save()
      return fieldType
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to create field type:", error)
      throw new ApiError(500, "Failed to create field type")
    }
  }

  /**
   * Update a field type
   */
  public async updateFieldType(
    id: string,
    updates: {
      displayName?: string
      description?: string
      uiType?: FieldUIType
      validations?: IFieldValidation[]
      settings?: Record<string, any>
    },
  ): Promise<IFieldType> {
    try {
      const fieldType = await this.getFieldTypeById(id)

      // Prevent updating built-in field types
      if (fieldType.isBuiltIn) {
        throw new ApiError(403, "Cannot update built-in field types")
      }

      // Update fields
      if (updates.displayName !== undefined) fieldType.displayName = updates.displayName
      if (updates.description !== undefined) fieldType.description = updates.description
      if (updates.uiType !== undefined) fieldType.uiType = updates.uiType
      if (updates.validations !== undefined) fieldType.validations = updates.validations
      if (updates.settings !== undefined) fieldType.settings = updates.settings

      await fieldType.save()
      return fieldType
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to update field type:", error)
      throw new ApiError(500, "Failed to update field type")
    }
  }

  /**
   * Delete a field type
   */
  public async deleteFieldType(id: string): Promise<void> {
    try {
      const fieldType = await this.getFieldTypeById(id)

      // Prevent deleting built-in field types
      if (fieldType.isBuiltIn) {
        throw new ApiError(403, "Cannot delete built-in field types")
      }

      // Prevent deleting system field types
      if (fieldType.isSystem) {
        throw new ApiError(403, "Cannot delete system field types")
      }

      // TODO: Check if field type is in use by any content types

      await FieldTypeModel.findByIdAndDelete(id)
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to delete field type:", error)
      throw new ApiError(500, "Failed to delete field type")
    }
  }

  /**
   * Validate field value against field type  "Failed to delete field type")
    }
  }

  /**
   * Validate field value against field type
   */
  public async validateFieldValue(fieldTypeId: string, value: any): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const fieldType = await this.getFieldTypeById(fieldTypeId)
      const errors: string[] = []

      // Skip validation if value is null or undefined
      if (value === null || value === undefined) {
        // Check if field is required
        const requiredValidation = fieldType.validations.find((v) => v.required)
        if (requiredValidation && requiredValidation.required) {
          errors.push("This field is required")
        }
        return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
      }

      // Validate based on data type
      switch (fieldType.dataType) {
        case FieldDataType.STRING:
        case FieldDataType.TEXT:
        case FieldDataType.RICH_TEXT:
        case FieldDataType.EMAIL:
        case FieldDataType.URL:
          if (typeof value !== "string") {
            errors.push(`Value must be a string`)
          } else {
            // Check min length
            const minLengthValidation = fieldType.validations.find((v) => v.minLength !== undefined)
            if (
              minLengthValidation &&
              minLengthValidation.minLength !== undefined &&
              value.length < minLengthValidation.minLength
            ) {
              errors.push(`Minimum length is ${minLengthValidation.minLength} characters`)
            }

            // Check max length
            const maxLengthValidation = fieldType.validations.find((v) => v.maxLength !== undefined)
            if (
              maxLengthValidation &&
              maxLengthValidation.maxLength !== undefined &&
              value.length > maxLengthValidation.maxLength
            ) {
              errors.push(`Maximum length is ${maxLengthValidation.maxLength} characters`)
            }

            // Check pattern
            const patternValidation = fieldType.validations.find((v) => v.pattern !== undefined)
            if (patternValidation && patternValidation.pattern) {
              const regex = new RegExp(patternValidation.pattern)
              if (!regex.test(value)) {
                errors.push(patternValidation.message || "Value does not match the required pattern")
              }
            }
          }
          break

        case FieldDataType.NUMBER:
        case FieldDataType.INTEGER:
        case FieldDataType.FLOAT:
          if (typeof value !== "number") {
            errors.push(`Value must be a number`)
          } else {
            // Check if integer
            if (fieldType.dataType === FieldDataType.INTEGER && !Number.isInteger(value)) {
              errors.push("Value must be an integer")
            }

            // Check min value
            const minValidation = fieldType.validations.find((v) => v.min !== undefined)
            if (minValidation && minValidation.min !== undefined && value < minValidation.min) {
              errors.push(`Minimum value is ${minValidation.min}`)
            }

            // Check max value
            const maxValidation = fieldType.validations.find((v) => v.max !== undefined)
            if (maxValidation && maxValidation.max !== undefined && value > maxValidation.max) {
              errors.push(`Maximum value is ${maxValidation.max}`)
            }
          }
          break

        case FieldDataType.BOOLEAN:
          if (typeof value !== "boolean") {
            errors.push(`Value must be a boolean`)
          }
          break

        case FieldDataType.DATE:
        case FieldDataType.DATETIME:
          if (!(value instanceof Date) && !(typeof value === "string" && !isNaN(Date.parse(value)))) {
            errors.push(`Value must be a valid date`)
          }
          break

        case FieldDataType.ENUM:
          const enumValidation = fieldType.validations.find((v) => v.enum !== undefined)
          if (enumValidation && enumValidation.enum && !enumValidation.enum.includes(value)) {
            errors.push(`Value must be one of: ${enumValidation.enum.join(", ")}`)
          }
          break

        case FieldDataType.ARRAY:
          if (!Array.isArray(value)) {
            errors.push(`Value must be an array`)
          } else {
            // Check min length
            const minLengthValidation = fieldType.validations.find((v) => v.minLength !== undefined)
            if (
              minLengthValidation &&
              minLengthValidation.minLength !== undefined &&
              value.length < minLengthValidation.minLength
            ) {
              errors.push(`Minimum length is ${minLengthValidation.minLength} items`)
            }

            // Check max length
            const maxLengthValidation = fieldType.validations.find((v) => v.maxLength !== undefined)
            if (
              maxLengthValidation &&
              maxLengthValidation.maxLength !== undefined &&
              value.length > maxLengthValidation.maxLength
            ) {
              errors.push(`Maximum length is ${maxLengthValidation.maxLength} items`)
            }
          }
          break

        // Add more validations for other data types as needed
      }

      return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
    } catch (error) {
      if (error instanceof ApiError) throw error
      logger.error("Failed to validate field value:", error)
      throw new ApiError(500, "Failed to validate field value")
    }
  }
}
