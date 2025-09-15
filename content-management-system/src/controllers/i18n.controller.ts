import type { Request, Response, NextFunction } from "express"
import { i18nService } from "../services/i18n.service"
import { ApiError } from "../utils/errors"
import path from "path"
import fs from "fs"
import { logger } from "../utils/logger"

export class I18nController {
  /**
   * Get all locales
   */
  public getLocales = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = (req as any).tenant?._id

      const locales = await i18nService.getLocales(tenantId)

      res.status(200).json({
        status: "success",
        data: {
          locales,
          defaultLocale: i18nService.getDefaultLocale(),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get all namespaces
   */
  public getNamespaces = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale } = req.query
      const tenantId = (req as any).tenant?._id

      const namespaces = await i18nService.getNamespaces({
        locale: locale as string,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          namespaces,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get translations
   */
  public getTranslations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale, namespace } = req.params
      const tenantId = (req as any).tenant?._id

      const translations = await i18nService.getTranslations({
        locale,
        namespace,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          translations,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create or update translation
   */
  public upsertTranslation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale, namespace, key, value } = req.body
      const tenantId = (req as any).tenant?._id

      const translation = await i18nService.upsertTranslation({
        locale,
        namespace,
        key,
        value,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          translation,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Delete translation
   */
  public deleteTranslation = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params

      await i18nService.deleteTranslation(id)

      res.status(200).json({
        status: "success",
        message: "Translation deleted successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Import translations
   */
  public importTranslations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale, namespace, translations, overwrite } = req.body
      const tenantId = (req as any).tenant?._id

      const importedCount = await i18nService.importTranslations({
        locale,
        namespace,
        translations,
        tenantId,
        overwrite,
      })

      res.status(200).json({
        status: "success",
        data: {
          importedCount,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Import translations from file
   */
  public importTranslationsFromFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw ApiError.badRequest("No file uploaded")
      }

      const { locale, namespace, overwrite } = req.body
      const tenantId = (req as any).tenant?._id
      const filePath = req.file.path

      // Check if file is valid JSON
      try {
        const fileContent = fs.readFileSync(filePath, "utf8")
        JSON.parse(fileContent)
      } catch (error) {
        throw ApiError.badRequest("Invalid JSON file")
      }

      const importedCount = await i18nService.importTranslationsFromFile({
        locale,
        namespace,
        filePath,
        tenantId,
        overwrite: overwrite === "true",
      })

      // Delete temporary file
      fs.unlinkSync(filePath)

      res.status(200).json({
        status: "success",
        data: {
          importedCount,
        },
      })
    } catch (error) {
      // Delete temporary file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path)
      }
      next(error)
    }
  }

  /**
   * Export translations
   */
  public exportTranslations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale, namespace } = req.params
      const tenantId = (req as any).tenant?._id

      const translations = await i18nService.getTranslations({
        locale,
        namespace,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          translations,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Export translations to file
   */
  public exportTranslationsToFile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale, namespace } = req.params
      const tenantId = (req as any).tenant?._id

      // Create temporary file
      const tempDir = path.join(process.cwd(), "temp")
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true })
      }

      const fileName = `${locale}-${namespace}-${Date.now()}.json`
      const filePath = path.join(tempDir, fileName)

      await i18nService.exportTranslationsToFile({
        locale,
        namespace,
        filePath,
        tenantId,
      })

      // Send file
      res.download(filePath, `${locale}-${namespace}.json`, (err) => {
        if (err) {
          logger.error(`Error sending file: ${err}`)
        }

        // Delete temporary file
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
        }
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Translate a key
   */
  public translate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale, namespace, key, defaultValue, params } = req.body
      const tenantId = (req as any).tenant?._id

      const translation = await i18nService.translate({
        locale,
        namespace,
        key,
        defaultValue,
        params,
        tenantId,
      })

      res.status(200).json({
        status: "success",
        data: {
          translation,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Set default locale
   */
  public setDefaultLocale = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { locale } = req.body

      i18nService.setDefaultLocale(locale)

      res.status(200).json({
        status: "success",
        message: `Default locale set to ${locale}`,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Clear cache
   */
  public clearCache = async (req: Request, res: Response, next: NextFunction) => {
    try {
      i18nService.clearCache()

      res.status(200).json({
        status: "success",
        message: "Translation cache cleared",
      })
    } catch (error) {
      next(error)
    }
  }
}
