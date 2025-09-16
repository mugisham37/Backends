import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { logger } from "./logger"
import { config } from "../config"
import { createDatabaseBackup, restoreDatabaseFromBackup } from "./data-backup"

const execAsync = promisify(exec)

// Disaster recovery options
interface DisasterRecoveryOptions {
  backupDir: string
  recoveryDir: string
  s3Bucket?: string
  s3Prefix?: string
}

// Default options
const DEFAULT_OPTIONS: DisasterRecoveryOptions = {
  backupDir: path.join(process.cwd(), "backups"),
  recoveryDir: path.join(process.cwd(), "recovery"),
  s3Bucket: config.backup.s3Bucket,
  s3Prefix: config.backup.s3Prefix,
}

// Disaster recovery status
export enum RecoveryStatus {
  SUCCESS = "SUCCESS",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
}

// Recovery result
interface RecoveryResult {
  status: RecoveryStatus
  message: string
  details: Record<string, any>
  startTime: Date
  endTime: Date
  duration: number
}

// Create a recovery point
export const createRecoveryPoint = async (
  options: Partial<DisasterRecoveryOptions> = {},
): Promise<{ success: boolean; recoveryPointId: string; details: Record<string, any> }> => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const recoveryPointId = `recovery-${new Date().toISOString().replace(/[:.]/g, "-")}`
  const recoveryDir = path.join(opts.recoveryDir, recoveryPointId)

  logger.info(`Creating recovery point: ${recoveryPointId}`)

  try {
    // Create recovery directory
    if (!fs.existsSync(recoveryDir)) {
      fs.mkdirSync(recoveryDir, { recursive: true })
    }

    // Create database backup
    const dbBackup = await createDatabaseBackup({
      outputDir: recoveryDir,
      filename: "database",
      uploadToS3: true,
      s3Bucket: opts.s3Bucket,
      s3Prefix: `${opts.s3Prefix}/${recoveryPointId}`,
      compress: true,
    })

    // Backup configuration files
    const configBackupPath = path.join(recoveryDir, "config.json")
    fs.writeFileSync(configBackupPath, JSON.stringify(config, null, 2))

    // Backup environment variables
    const envBackupPath = path.join(recoveryDir, "environment.json")
    fs.writeFileSync(envBackupPath, JSON.stringify(process.env, null, 2))

    // Create recovery metadata
    const metadata = {
      id: recoveryPointId,
      timestamp: new Date().toISOString(),
      database: dbBackup,
      config: {
        path: configBackupPath,
        size: fs.statSync(configBackupPath).size,
      },
      environment: {
        path: envBackupPath,
        size: fs.statSync(envBackupPath).size,
      },
    }

    // Save metadata
    const metadataPath = path.join(recoveryDir, "metadata.json")
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

    // Upload metadata to S3
    if (opts.s3Bucket) {
      const s3Client = new S3Client({
        region: config.backup.s3Region,
        credentials: {
          accessKeyId: config.backup.s3AccessKey,
          secretAccessKey: config.backup.s3SecretKey,
        },
      })

      const s3Key = `${opts.s3Prefix}/${recoveryPointId}/metadata.json`
      await s3Client.send(
        new PutObjectCommand({
          Bucket: opts.s3Bucket,
          Key: s3Key,
          Body: JSON.stringify(metadata, null, 2),
          ContentType: "application/json",
        }),
      )
    }

    logger.info(`Recovery point created successfully: ${recoveryPointId}`)

    return {
      success: true,
      recoveryPointId,
      details: metadata,
    }
  } catch (error) {
    logger.error(`Failed to create recovery point: ${error.message}`, error)

    return {
      success: false,
      recoveryPointId,
      details: {
        error: error.message,
        stack: error.stack,
      },
    }
  }
}

// List recovery points
export const listRecoveryPoints = (
  options: Partial<DisasterRecoveryOptions> = {},
): { id: string; timestamp: string; path: string }[] => {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  logger.info(`Listing recovery points in directory: ${opts.recoveryDir}`)

  try {
    // Check if directory exists
    if (!fs.existsSync(opts.recoveryDir)) {
      return []
    }

    // Get all recovery point directories
    const recoveryPoints = fs
      .readdirSync(opts.recoveryDir)
      .filter((dir) => dir.startsWith("recovery-"))
      .map((dir) => {
        const recoveryPath = path.join(opts.recoveryDir, dir)
        const metadataPath = path.join(recoveryPath, "metadata.json")

        if (fs.existsSync(metadataPath)) {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
          return {
            id: metadata.id,
            timestamp: metadata.timestamp,
            path: recoveryPath,
          }
        }

        return {
          id: dir,
          timestamp: new Date(dir.replace("recovery-", "").replace(/-/g, ":").replace("T", " ")).toISOString(),
          path: recoveryPath,
        }
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    logger.info(`Found ${recoveryPoints.length} recovery points`)
    return recoveryPoints
  } catch (error) {
    logger.error(`Failed to list recovery points: ${error.message}`, error)
    return []
  }
}

// Get recovery point details
export const getRecoveryPointDetails = (
  recoveryPointId: string,
  options: Partial<DisasterRecoveryOptions> = {},
): Record<string, any> | null => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const recoveryPath = path.join(opts.recoveryDir, recoveryPointId)
  const metadataPath = path.join(recoveryPath, "metadata.json")

  logger.info(`Getting details for recovery point: ${recoveryPointId}`)

  try {
    // Check if metadata file exists
    if (!fs.existsSync(metadataPath)) {
      logger.warn(`Metadata file not found for recovery point: ${recoveryPointId}`)
      return null
    }

    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
    return metadata
  } catch (error) {
    logger.error(`Failed to get recovery point details: ${error.message}`, error)
    return null
  }
}

// Restore from recovery point
export const restoreFromRecoveryPoint = async (
  recoveryPointId: string,
  options: Partial<DisasterRecoveryOptions> = {},
): Promise<RecoveryResult> => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const recoveryPath = path.join(opts.recoveryDir, recoveryPointId)
  const metadataPath = path.join(recoveryPath, "metadata.json")

  const startTime = new Date()
  logger.info(`Restoring from recovery point: ${recoveryPointId}`)

  try {
    // Check if metadata file exists
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Metadata file not found for recovery point: ${recoveryPointId}`)
    }

    // Read metadata
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))

    // Restore database
    const dbBackupPath = path.join(recoveryPath, `${metadata.database.filename}`)
    if (!fs.existsSync(dbBackupPath)) {
      throw new Error(`Database backup file not found: ${dbBackupPath}`)
    }

    const dbRestoreResult = await restoreDatabaseFromBackup(dbBackupPath)

    // Restore configuration if needed
    // Note: This is commented out as it's usually not safe to automatically restore config
    // const configPath = path.join(recoveryPath, "config.json")
    // if (fs.existsSync(configPath)) {
    //   const configData = JSON.parse(fs.readFileSync(configPath, "utf8"))
    //   // Apply configuration changes
    // }

    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    if (dbRestoreResult) {
      logger.info(`Successfully restored from recovery point: ${recoveryPointId}`)
      return {
        status: RecoveryStatus.SUCCESS,
        message: "Recovery completed successfully",
        details: {
          recoveryPointId,
          metadata,
          database: { restored: true },
        },
        startTime,
        endTime,
        duration,
      }
    } else {
      logger.warn(`Partially restored from recovery point: ${recoveryPointId}`)
      return {
        status: RecoveryStatus.PARTIAL,
        message: "Database restore failed",
        details: {
          recoveryPointId,
          metadata,
          database: { restored: false },
        },
        startTime,
        endTime,
        duration,
      }
    }
  } catch (error) {
    const endTime = new Date()
    const duration = endTime.getTime() - startTime.getTime()

    logger.error(`Failed to restore from recovery point: ${error.message}`, error)
    return {
      status: RecoveryStatus.FAILED,
      message: error.message,
      details: {
        recoveryPointId,
        error: error.message,
        stack: error.stack,
      },
      startTime,
      endTime,
      duration,
    }
  }
}

// Delete a recovery point
export const deleteRecoveryPoint = async (
  recoveryPointId: string,
  options: Partial<DisasterRecoveryOptions> = {},
): Promise<boolean> => {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const recoveryPath = path.join(opts.recoveryDir, recoveryPointId)

  logger.info(`Deleting recovery point: ${recoveryPointId}`)

  try {
    // Check if recovery point exists
    if (!fs.existsSync(recoveryPath)) {
      logger.warn(`Recovery point not found: ${recoveryPointId}`)
      return false
    }

    // Delete recovery point directory
    fs.rmSync(recoveryPath, { recursive: true, force: true })

    // Delete from S3 if needed
    if (opts.s3Bucket && opts.s3Prefix) {
      const s3Client = new S3Client({
        region: config.backup.s3Region,
        credentials: {
          accessKeyId: config.backup.s3AccessKey,
          secretAccessKey: config.backup.s3SecretKey,
        },
      })

      // Note: This would require listing and deleting all objects with the prefix
      // This is simplified and would need to be expanded for production use
      logger.info(`S3 deletion for recovery points is not fully implemented`)
    }

    logger.info(`Recovery point deleted: ${recoveryPointId}`)
    return true
  } catch (error) {
    logger.error(`Failed to delete recovery point: ${error.message}`, error)
    return false
  }
}

// Schedule regular recovery points
export const scheduleRecoveryPoints = (
  options: Partial<DisasterRecoveryOptions> = {},
  intervalHours = 24,
): NodeJS.Timeout => {
  logger.info(`Scheduling recovery points every ${intervalHours} hours`)

  // Create initial recovery point
  createRecoveryPoint(options).catch((error) => {
    logger.error("Failed to create initial recovery point", error)
  })

  // Schedule regular recovery points
  const intervalMs = intervalHours * 60 * 60 * 1000
  const timer = setInterval(() => {
    createRecoveryPoint(options).catch((error) => {
      logger.error("Failed to create scheduled recovery point", error)
    })
  }, intervalMs)

  return timer
}

export default {
  createRecoveryPoint,
  listRecoveryPoints,
  getRecoveryPointDetails,
  restoreFromRecoveryPoint,
  deleteRecoveryPoint,
  scheduleRecoveryPoints,
  RecoveryStatus,
}
