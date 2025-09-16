import Joi from "joi";
import mongoose from "mongoose";

export const createCountrySchema = Joi.object({
  code: Joi.string().required().min(2).max(3).uppercase().trim(),
  name: Joi.string().required().min(2).max(100).trim(),
  isActive: Joi.boolean(),
  phoneCode: Joi.string().required().min(1).max(10).trim(),
  currency: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error("any.invalid");
      }
      return value;
    }, "MongoDB ObjectId validation"),
  defaultLanguage: Joi.string().min(2).max(5).trim(),
  states: Joi.array().items(
    Joi.object({
      code: Joi.string().required().min(1).max(10).uppercase().trim(),
      name: Joi.string().required().min(2).max(100).trim(),
    })
  ),
});

export const updateCountrySchema = Joi.object({
  code: Joi.string().min(2).max(3).uppercase().trim(),
  name: Joi.string().min(2).max(100).trim(),
  isActive: Joi.boolean(),
  phoneCode: Joi.string().min(1).max(10).trim(),
  currency: Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      return helpers.error("any.invalid");
    }
    return value;
  }, "MongoDB ObjectId validation"),
  defaultLanguage: Joi.string().min(2).max(5).trim(),
  states: Joi.array().items(
    Joi.object({
      code: Joi.string().required().min(1).max(10).uppercase().trim(),
      name: Joi.string().required().min(2).max(100).trim(),
    })
  ),
});
