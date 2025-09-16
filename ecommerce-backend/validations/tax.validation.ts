import Joi from "joi";
import mongoose from "mongoose";

export const createTaxRateSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  rate: Joi.number().required().min(0).max(100),
  country: Joi.string().required().min(2).max(3).uppercase().trim(),
  state: Joi.string().min(1).max(50).trim(),
  postalCode: Joi.string().min(1).max(20).trim(),
  isDefault: Joi.boolean(),
  isActive: Joi.boolean(),
  priority: Joi.number().integer().min(0),
  productCategories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    }, "MongoDB ObjectId validation")
  ),
});

export const updateTaxRateSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim(),
  rate: Joi.number().min(0).max(100),
  country: Joi.string().min(2).max(3).uppercase().trim(),
  state: Joi.string().min(1).max(50).trim(),
  postalCode: Joi.string().min(1).max(20).trim(),
  isDefault: Joi.boolean(),
  isActive: Joi.boolean(),
  priority: Joi.number().integer().min(0),
  productCategories: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    }, "MongoDB ObjectId validation")
  ),
});
