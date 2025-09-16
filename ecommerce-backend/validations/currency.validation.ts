import Joi from "joi";

export const createCurrencySchema = Joi.object({
  code: Joi.string().required().min(2).max(3).uppercase().trim(),
  name: Joi.string().required().min(2).max(100).trim(),
  symbol: Joi.string().required().min(1).max(10).trim(),
  rate: Joi.number().required().min(0),
  isBase: Joi.boolean(),
  isActive: Joi.boolean(),
  decimalPlaces: Joi.number().integer().min(0).max(10),
});

export const updateCurrencySchema = Joi.object({
  code: Joi.string().min(2).max(3).uppercase().trim(),
  name: Joi.string().min(2).max(100).trim(),
  symbol: Joi.string().min(1).max(10).trim(),
  rate: Joi.number().min(0),
  isActive: Joi.boolean(),
  decimalPlaces: Joi.number().integer().min(0).max(10),
});

export const updateRatesSchema = Joi.object({
  apiKey: Joi.string().required(),
});
