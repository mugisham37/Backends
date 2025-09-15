import fs from "fs/promises"
import path from "path"
import { logger } from "../utils/logger"
import mongoose from "mongoose"
import { ContentTypeModel } from "../db/models/content-type.model"
import { ContentModel } from "../db/models/content.model"
import { MediaModel } from "../db/models/media.model"
import { UserModel } from "../db/models/user.model"
import { WebhookModel } from "../db/models/webhook.model"
import { WorkflowModel } from "../db/models/workflow.model"

export class MigrationService {
  private migrationsDir: string

  constructor() {
    this.migrationsDir = path.join(process.cwd(), "migrations")
  }

  /**
   * Initialize migrations directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.migrationsDir, { recursive: true })
      logger.info(`Migrations directory initialized at ${this.migrationsDir}`)
    } catch (error) {
      logger.error("Failed to initialize migrations directory:", error)
      throw error
    }
  }

  /**
   * Export all data to JSON files
   */
  async exportData(outputDir?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const exportDir = outputDir || path.join(this.migrationsDir, `export-${timestamp}`)

    try {
      // Create export directory
      await fs.mkdir(exportDir, { recursive: true })

      // Export collections in parallel
      await Promise.all([
        this.exportCollection("users", UserModel, exportDir),
        this.exportCollection("content-types", ContentTypeModel, exportDir),
        this.exportCollection("contents", ContentModel, exportDir),
        this.exportCollection("media", MediaModel, exportDir),
        this.exportCollection("webhooks", WebhookModel, exportDir),
        this.exportCollection("workflows", WorkflowModel, exportDir),
      ])

      logger.info(`Data exported successfully to ${exportDir}`)
      return exportDir
    } catch (error) {
      logger.error("Failed to export data:", error)
      throw error
    }
  }

  /**
   * Export a single collection to a JSON file
   */
  private async exportCollection(name: string, model: mongoose.Model<any>, exportDir: string): Promise<void> {
    try {
      const data = await model.find().lean()
      const filePath = path.join(exportDir, `${name}.json`)
      await fs.writeFile(filePath, JSON.stringify(data, null, 2))
      logger.info(`Exported ${data.length} ${name} to ${filePath}`)
    } catch (error) {
      logger.error(`Failed to export ${name}:`, error)
      throw error
    }
  }

  /**
   * Import data from JSON files
   */
  async importData(importDir: string, options: { clear?: boolean; skipExisting?: boolean } = {}): Promise<void> {
    try {
      // Check if import directory exists
      try {
        await fs.access(importDir)
      } catch (error) {
        throw new Error(`Import directory ${importDir} does not exist`)
      }

      // Clear existing data if requested
      if (options.clear) {
        await this.clearAllData()
      }

      // Import collections in a specific order to maintain references
      await this.importCollection("users", UserModel, importDir, options)
      await this.importCollection("content-types", ContentTypeModel, importDir, options)
      await this.importCollection("contents", ContentModel, importDir, options)
      await this.importCollection("media", MediaModel, importDir, options)
      await this.importCollection("webhooks", WebhookModel, importDir, options)
      await this.importCollection("workflows", WorkflowModel, importDir, options)

      logger.info(`Data imported successfully from ${importDir}`)
    } catch (error) {
      logger.error("Failed to import data:", error)
      throw error
    }
  }

  /**
   * Import a single collection from a JSON file
   */
  private async importCollection(
    name: string,
    model: mongoose.Model<any>,
    importDir: string,
    options: { skipExisting?: boolean } = {},
  ): Promise<void> {
    try {
      const filePath = path.join(importDir, `${name}.json`)

      // Check if file exists
      try {
        await fs.access(filePath)
      } catch (error) {
        logger.warn(`File ${filePath} does not exist, skipping`)
        return
      }

      // Read and parse file
      const fileContent = await fs.readFile(filePath, "utf-8")
      const data = JSON.parse(fileContent)

      if (!Array.isArray(data)) {
        throw new Error(`Invalid data format in ${filePath}, expected an array`)
      }

      // Import data
      let importedCount = 0
      let skippedCount = 0

      for (const item of data) {
        try {
          // Check if document already exists
          if (options.skipExisting && item._id) {
            const existingDoc = await model.findById(item._id)
            if (existingDoc) {
              skippedCount++
              continue
            }
          }

          // Create new document
          await model.create(item)
          importedCount++
        } catch (error) {
          logger.error(`Failed to import item in ${name}:`, error)
          throw error
        }
      }

      logger.info(`Imported ${importedCount} ${name}, skipped ${skippedCount}`)
    } catch (error) {
      logger.error(`Failed to import ${name}:`, error)
      throw error
    }
  }

  /**
   * Clear all data from the database
   */
  async clearAllData(): Promise<void> {
    try {
      await Promise.all([
        ContentModel.deleteMany({}),
        MediaModel.deleteMany({}),
        WebhookModel.deleteMany({}),
        WorkflowModel.deleteMany({}),
        ContentTypeModel.deleteMany({}),
        UserModel.deleteMany({}),
      ])

      logger.info("All data cleared from database")
    } catch (error) {
      logger.error("Failed to clear data:", error)
      throw error
    }
  }

  /**
   * Create a migration script
   */
  async createMigration(name: string): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      const fileName = `${timestamp}-${name}.js`
      const filePath = path.join(this.migrationsDir, fileName)

      const template = `/**
 * Migration: ${name}
 * Created at: ${new Date().toISOString()}
 */

/**
 * Run the migration
 * @param {Object} context - Migration context
 * @param {Object} context.mongoose - Mongoose instance
 * @param {Object} context.models - Mongoose models
 * @param {Object} context.logger - Logger instance
 */
exports.up = async function(context) {
  const { mongoose, models, logger } = context;
  
  // TODO: Implement migration logic
  logger.info('Running migration: ${name}');
  
  // Example:
  // await models.ContentType.updateMany(
  //   { /* query */ },
  //   { /* update */ }
  // );
};

/**
 * Rollback the migration
 * @param {Object} context - Migration context
 * @param {Object} context.mongoose - Mongoose instance
 * @param {Object} context.models - Mongoose models
 * @param {Object} context.logger - Logger instance
 */
exports.down = async function(context) {
  const { mongoose, models, logger } = context;
  
  // TODO: Implement rollback logic
  logger.info('Rolling back migration: ${name}');
};
`

      await fs.writeFile(filePath, template)
      logger.info(`Migration script created at ${filePath}`)
      return filePath
    } catch (error) {
      logger.error("Failed to create migration script:", error)
      throw error
    }
  }

  /**
   * Run migrations
   */
  async runMigrations(options: { up?: boolean; down?: boolean; specific?: string } = { up: true }): Promise<void> {
    try {
      // Get all migration files
      const files = await fs.readdir(this.migrationsDir)
      const migrationFiles = files
        .filter((file) => file.endsWith(".js"))
        .sort((a, b) => {
          // Sort by timestamp in filename
          const timestampA = a.split("-")[0]
          const timestampB = b.split("-")[0]
          return timestampA.localeCompare(timestampB)
        })

      if (migrationFiles.length === 0) {
        logger.info("No migration files found")
        return
      }

      // Filter specific migration if requested
      if (options.specific) {
        const specificFile = migrationFiles.find((file) => file.includes(options.specific))
        if (!specificFile) {
          throw new Error(`Migration file containing "${options.specific}" not found`)
        }
        migrationFiles.length = 0
        migrationFiles.push(specificFile)
      }

      // Run migrations in order (or reverse order for down)
      const filesToProcess = options.down ? [...migrationFiles].reverse() : migrationFiles

      for (const file of filesToProcess) {
        const filePath = path.join(this.migrationsDir, file)
        const migration = require(filePath)

        // Create context for migration
        const context = {
          mongoose,
          models: {
            User: UserModel,
            ContentType: ContentTypeModel,
            Content: ContentModel,
            Media: MediaModel,
            Webhook: WebhookModel,
            Workflow: WorkflowModel,
          },
          logger,
        }

        // Run migration
        if (options.up && migration.up) {
          logger.info(`Running migration: ${file}`)
          await migration.up(context)
          logger.info(`Migration completed: ${file}`)
        } else if (options.down && migration.down) {
          logger.info(`Rolling back migration: ${file}`)
          await migration.down(context)
          logger.info(`Rollback completed: ${file}`)
        }
      }

      logger.info("All migrations processed successfully")
    } catch (error) {
      logger.error("Failed to run migrations:", error)
      throw error
    }
  }
}

// Export singleton instance
export const migrationService = new MigrationService()
