import type { Request, Response } from "express"
import { asyncHandler } from "../utils/async-handler"
import { createRequestLogger } from "../config/logger"
import * as settingsService from "../services/settings.service"
import { ApiError } from "../utils/api-error"

/**
 * Get setting
 * @route GET /api/v1/admin/settings/:key
 * @access Protected (Admin)
 */
export const getSetting = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { key } = req.params

  requestLogger.info(`Getting setting: ${key}`)

  const setting = await settingsService.getSetting(key, null, req.id)

  if (setting === null) {
    throw new ApiError("Setting not found", 404)
  }

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      key,
      value: setting,
    },
  })
})

/**
 * Set setting
 * @route PUT /api/v1/admin/settings/:key
 * @access Protected (Admin)
 */
export const setSetting = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { key } = req.params
  const { value, description, group } = req.body

  requestLogger.info(`Setting setting: ${key}`)

  const setting = await settingsService.setSetting(key, value, description, group, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      setting,
    },
  })
})

/**
 * Get settings by group
 * @route GET /api/v1/admin/settings/group/:group
 * @access Protected (Admin)
 */
export const getSettingsByGroup = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { group } = req.params

  requestLogger.info(`Getting settings for group: ${group}`)

  const settings = await settingsService.getSettingsByGroup(group, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    results: settings.length,
    data: {
      settings,
    },
  })
})

/**
 * Delete setting
 * @route DELETE /api/v1/admin/settings/:key
 * @access Protected (Admin)
 */
export const deleteSetting = asyncHandler(async (req: Request, res: Response) => {
  const requestLogger = createRequestLogger(req.id)
  const { key } = req.params

  requestLogger.info(`Deleting setting: ${key}`)

  const setting = await settingsService.deleteSetting(key, req.id)

  res.status(200).json({
    status: "success",
    requestId: req.id,
    data: {
      setting,
    },
  })
})
