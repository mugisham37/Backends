import fs from "fs"
import path from "path"
import { exec } from "child_process"
import { promisify } from "util"
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { logger } from "./logger"
import { config } from "../config"

const execAsync = promisify(exec)

// Backup options
interface BackupOptions {
  outputDir: string
  filename?: string
  uploadToS3?: boolean
  s3Bucket?: string
  s3Prefix?: string
  compress?: boolean
  includeSchema?: boolean
  includeTables?: string[]
  excludeTables?: string[]
}

// Backup result
interface BackupResult {
  success: boolean
  filename: string
  path: string
  size: number
  duration: number
  s3Url?: string
  error?: string
}

// Create a database backup
export const createDatabaseBackup = async (options: BackupOptions): Promise<BackupResult> => {
  const startTime = Date.now()
  const {
    outputDir,
    filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    uploadToS3 = false,
    s3Bucket = config.backup.s3Bucket,
    s3Prefix = config.backup.s3Prefix,
    compress = true,
    includeSchema = true,
    includeTables = [],
    excludeTables = [],
  } = options

  logger.info(`Creating database backup: ${filename}`)

  try {
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Determine file extension
    const fileExt = compress ? ".sql.gz" : ".sql"
    const outputFile = path.join(outputDir, `${filename}${fileExt}`)

    // Build pg_dump command
    let pgDumpCmd = `pg_dump --host=${config.database.host} --port=${config.database.port} --username=${config.database.username} --dbname=${config.database.dbname}`

    // Add schema option
    if (!includeSchema) {
      pgDumpCmd += " --data-only"
    }

    // Add table options
    if (includeTables.length > 0) {
      pgDumpCmd += ` --table=${includeTables.join(" --table=")}`
    }

    if (excludeTables.length > 0) {
      pgDumpCmd += ` --exclude-table=${excludeTables.join(" --exclude-table=")}`
    }

    // Add compression if needed
    if (compress) {
      pgDumpCmd += ` | gzip > ${outputFile}`
    } else {
      pgDumpCmd += ` > ${outputFile}`
    }

    // Set PGPASSWORD environment variable
    const env = {
      ...process.env,
      PGPASSWORD: config.database.password,
    }

    // Execute pg_dump command
    logger.debug(`Executing pg_dump command: ${pgDumpCmd}`)
    await execAsync(pgDumpCmd, { env })

    // Get file size
    const stats = fs.statSync(outputFile)
    const fileSizeInBytes = stats.size

    // Upload to S3 if requested
    let s3Url
    if (uploadToS3) {
      s3Url = await uploadBackupToS3(outputFile, s3Bucket, s3Prefix)
    }

    const duration = Date.now() - startTime
    logger.info(`Database backup created successfully: ${outputFile} (${fileSizeInBytes} bytes) in ${duration}ms`)

    return {
      success: true,
      filename: path.basename(outputFile),
      path: outputFile,
      size: fileSizeInBytes,
      duration,
      s3Url,
    }
  } catch (error) {
    logger.error(`Failed to create database backup: ${error.message}`, error)

    return {
      success: false,
      filename: "",
      path: "",
      size: 0,
      duration: Date.now() - startTime,
      error: error.message,
    }
  }
}

// Upload backup to S3
const uploadBackupToS3 = async (filePath: string, bucket: string, prefix: string): Promise<string> => {
  logger.info(`Uploading backup to S3: ${filePath} to ${bucket}/${prefix}`)

  try {
    // Create S3 client
    const s3Client = new S3Client({
      region: config.backup.s3Region,
      credentials: {
        accessKeyId: config.backup.s3AccessKey,
        secretAccessKey: config.backup.s3SecretKey,
      },
    })

    // Read file
    const fileContent = fs.readFileSync(filePath)
    const fileName = path.basename(filePath)
    const s3Key = prefix ? `${prefix}/${fileName}` : fileName

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: "application/gzip",
    })

    await s3Client.send(command)

    const s3Url = `s3://${bucket}/${s3Key}`
    logger.info(`Backup uploaded to S3: ${s3Url}`)

    return s3Url
  } catch (error) {
    logger.error(`Failed to upload backup to S3: ${error.message}`, error)
    throw error
  }
}

// Restore database from backup
export const restoreDatabaseFromBackup = async (backupPath: string): Promise<boolean> => {
  logger.info(`Restoring database from backup: ${backupPath}`)

  try {
    // Check if file exists
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file does not exist: ${backupPath}`)
    }

    // Determine if file is compressed
    const isCompressed = backupPath.endsWith(".gz")

    // Build pg_restore command
    let restoreCmd
    if (isCompressed) {
      restoreCmd = `gunzip -c ${backupPath} | psql --host=${config.database.host} --port=${config.database.port} --username=${config.database.username} --dbname=${config.database.dbname}`
    } else {
      restoreCmd = `psql --host=${config.database.host} --port=${config.database.port} --username=${config.database.username} --dbname=${config.database.dbname} < ${backupPath}`
    }

    // Set PGPASSWORD environment variable
    const env = {
      ...process.env,
      PGPASSWORD: config.database.password,
    }

    // Execute restore command
    logger.debug(`Executing restore command: ${restoreCmd}`)
    await execAsync(restoreCmd, { env })

    logger.info(`Database restored successfully from backup: ${backupPath}`)
    return true
  } catch (error) {
    logger.error(`Failed to restore database from backup: ${error.message}`, error)
    return false
  }
}

// List available backups
export const listBackups = (directory: string): string[] => {
  logger.info(`Listing backups in directory: ${directory}`)

  try {
    // Check if directory exists
    if (!fs.existsSync(directory)) {
      return []
    }

    // Get all backup files
    const files = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".sql") || file.endsWith(".sql.gz"))
      .sort()
      .reverse()

    logger.info(`Found ${files.length} backups in directory: ${directory}`)
    return files
  } catch (error) {
    logger.error(`Failed to list backups: ${error.message}`, error)
    return []
  }
}

// Delete old backups
export const deleteOldBackups = (directory: string, keepCount: number): string[] => {
  logger.info(`Deleting old backups in directory: ${directory}, keeping ${keepCount} newest`)

  try {
    // Get all backup files
    const files = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".sql") || file.endsWith(".sql.gz"))
      .map((file) => ({
        name: file,
        path: path.join(directory, file),
        mtime: fs.statSync(path.join(directory, file)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime)

    // Keep the newest backups
    const filesToKeep = files.slice(0, keepCount)
    const filesToDelete = files.slice(keepCount)

    // Delete old backups
    const deletedFiles: string[] = []
    for (const file of filesToDelete) {
      logger.debug(`Deleting old backup: ${file.path}`)
      fs.unlinkSync(file.path)
      deletedFiles.push(file.name)
    }

    logger.info(`Deleted ${deletedFiles.length} old backups`)
    return deletedFiles
  } catch (error) {
    logger.error(`Failed to delete old backups: ${error.message}`, error)
    return []
  }
}

// Schedule regular backups
export const scheduleBackups = (options: BackupOptions, intervalHours: number): NodeJS.Timeout => {
  logger.info(`Scheduling backups every ${intervalHours} hours`)

  // Run initial backup
  createDatabaseBackup(options).catch((error) => {
    logger.error("Failed to create initial backup", error)
  })

  // Schedule regular backups
  const intervalMs = intervalHours * 60 * 60 * 1000
  const timer = setInterval(() => {
    createDatabaseBackup(options).catch((error) => {
      logger.error("Failed to create scheduled backup", error)
    })
  }, intervalMs)

  return timer
}

export default {
  createDatabaseBackup,
  restoreDatabaseFromBackup,
  listBackups,
  deleteOldBackups,
  scheduleBackups,
}
