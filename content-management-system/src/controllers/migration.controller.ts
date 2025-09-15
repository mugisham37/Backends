import type { Request, Response, NextFunction } from "express"
import { migrationService } from "../services/migration.service"
import path from "path"

export class MigrationController {
  /**
   * Export data
   */
  public exportData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const outputDir = req.query.outputDir as string | undefined
      const exportDir = await migrationService.exportData(outputDir)

      res.status(200).json({
        status: "success",
        data: {
          exportDir,
          message: `Data exported successfully to ${exportDir}`,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Import data
   */
  public importData = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { importDir } = req.body
      const options = {
        clear: req.body.clear === true,
        skipExisting: req.body.skipExisting !== false,
      }

      await migrationService.importData(importDir, options)

      res.status(200).json({
        status: "success",
        message: `Data imported successfully from ${importDir}`,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Create migration
   */
  public createMigration = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body

      if (!name) {
        return res.status(400).json({
          status: "error",
          message: "Migration name is required",
        })
      }

      const filePath = await migrationService.createMigration(name)

      res.status(201).json({
        status: "success",
        data: {
          filePath,
          fileName: path.basename(filePath),
          message: `Migration script created at ${filePath}`,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Run migrations
   */
  public runMigrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = {
        up: req.body.direction !== "down",
        down: req.body.direction === "down",
        specific: req.body.specific,
      }

      await migrationService.runMigrations(options)

      res.status(200).json({
        status: "success",
        message: "Migrations processed successfully",
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Initialize migrations
   */
  public initializeMigrations = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await migrationService.initialize()

      res.status(200).json({
        status: "success",
        message: "Migrations directory initialized",
      })
    } catch (error) {
      next(error)
    }
  }
}
