import { prisma } from "./prisma"
import { logger } from "./logger"
import { config } from "../config"

// Archive options
interface ArchiveOptions {
  tableName: string
  archiveTableName: string
  condition: string
  batchSize: number
  dryRun?: boolean
}

// Archive result
interface ArchiveResult {
  tableName: string
  archiveTableName: string
  recordsArchived: number
  dryRun: boolean
  startTime: Date
  endTime: Date
  duration: number
  error?: string
}

// Create archive table if it doesn't exist
const createArchiveTableIfNotExists = async (tableName: string, archiveTableName: string): Promise<void> => {
  logger.info(`Creating archive table if it doesn't exist: ${archiveTableName}`)

  try {
    // Check if the archive table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${archiveTableName}
      )
    `

    if (!tableExists[0].exists) {
      logger.info(`Creating archive table: ${archiveTableName}`)

      // Create the archive table with the same structure as the source table
      await prisma.$executeRaw`
        CREATE TABLE ${archiveTableName} AS 
        SELECT * FROM ${tableName} 
        WHERE 1=0
      `

      // Add archived_at column
      await prisma.$executeRaw`
        ALTER TABLE ${archiveTableName} 
        ADD COLUMN archived_at TIMESTAMP NOT NULL DEFAULT NOW()
      `

      logger.info(`Archive table created: ${archiveTableName}`)
    }
  } catch (error) {
    logger.error(`Failed to create archive table: ${archiveTableName}`, error)
    throw error
  }
}

// Archive data from a table
export const archiveData = async (options: ArchiveOptions): Promise<ArchiveResult> => {
  const { tableName, archiveTableName, condition, batchSize, dryRun = false } = options
  const startTime = new Date()

  logger.info(`Archiving data from ${tableName} to ${archiveTableName}`)
  logger.info(`Condition: ${condition}`)
  logger.info(`Batch size: ${batchSize}`)
  logger.info(`Dry run: ${dryRun}`)

  let recordsArchived = 0

  try {
    // Create archive table if it doesn't exist
    if (!dryRun) {
      await createArchiveTableIfNotExists(tableName, archiveTableName)
    }

    // Get the total number of records to archive
    const totalRecords = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM ${tableName} WHERE ${condition}
    `

    const total = Number(totalRecords[0].count)
    logger.info(`Total records to archive: ${total}`)

    if (total === 0) {
      logger.info(`No records to archive from ${tableName}`)
      const endTime = new Date()
      return {
        tableName,
        archiveTableName,
        recordsArchived: 0,
        dryRun,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      }
    }

    // Archive data in batches
    let offset = 0
    while (offset < total) {
      logger.info(`Archiving batch: ${offset} to ${offset + batchSize}`)

      // Get the IDs of records to archive in this batch
      const recordsToArchive = await prisma.$queryRaw`
        SELECT id FROM ${tableName} 
        WHERE ${condition} 
        ORDER BY id 
        LIMIT ${batchSize} OFFSET ${offset}
      `

      const ids = recordsToArchive.map((record: any) => record.id)

      if (ids.length === 0) {
        break
      }

      if (!dryRun) {
        // Insert records into archive table
        await prisma.$executeRaw`
          INSERT INTO ${archiveTableName} 
          SELECT *, NOW() as archived_at 
          FROM ${tableName} 
          WHERE id IN (${ids.join(",")})
        `

        // Delete records from source table
        await prisma.$executeRaw`
          DELETE FROM ${tableName} 
          WHERE id IN (${ids.join(",")})
        `
      }

      recordsArchived += ids.length
      offset += batchSize

      logger.info(`Archived ${recordsArchived} records so far`)
    }

    logger.info(`Archived ${recordsArchived} records from ${tableName} to ${archiveTableName}`)

    const endTime = new Date()
    return {
      tableName,
      archiveTableName,
      recordsArchived,
      dryRun,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    }
  } catch (error) {
    logger.error(`Failed to archive data from ${tableName} to ${archiveTableName}`, error)

    const endTime = new Date()
    return {
      tableName,
      archiveTableName,
      recordsArchived,
      dryRun,
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      error: error.message,
    }
  }
}

// Archive old data based on retention policy
export const archiveOldData = async (dryRun = false): Promise<ArchiveResult[]> => {
  logger.info("Archiving old data based on retention policy")

  const results: ArchiveResult[] = []

  // Archive old audit logs
  if (config.dataRetention.auditLogs.enabled) {
    const retentionDays = config.dataRetention.auditLogs.retentionDays
    const result = await archiveData({
      tableName: "AuditLog",
      archiveTableName: "ArchivedAuditLog",
      condition: `created_at < NOW() - INTERVAL '${retentionDays} days'`,
      batchSize: 1000,
      dryRun,
    })
    results.push(result)
  }

  // Archive old activity logs
  if (config.dataRetention.activityLogs.enabled) {
    const retentionDays = config.dataRetention.activityLogs.retentionDays
    const result = await archiveData({
      tableName: "ActivityLog",
      archiveTableName: "ArchivedActivityLog",
      condition: `created_at < NOW() - INTERVAL '${retentionDays} days'`,
      batchSize: 1000,
      dryRun,
    })
    results.push(result)
  }

  // Archive old notifications
  if (config.dataRetention.notifications.enabled) {
    const retentionDays = config.dataRetention.notifications.retentionDays
    const result = await archiveData({
      tableName: "Notification",
      archiveTableName: "ArchivedNotification",
      condition: `created_at < NOW() - INTERVAL '${retentionDays} days'`,
      batchSize: 1000,
      dryRun,
    })
    results.push(result)
  }

  // Archive old events
  if (config.dataRetention.events.enabled) {
    const retentionDays = config.dataRetention.events.retentionDays
    const result = await archiveData({
      tableName: "Event",
      archiveTableName: "ArchivedEvent",
      condition: `created_at < NOW() - INTERVAL '${retentionDays} days'`,
      batchSize: 1000,
      dryRun,
    })
    results.push(result)
  }

  // Archive old completed tasks
  if (config.dataRetention.completedTasks.enabled) {
    const retentionDays = config.dataRetention.completedTasks.retentionDays
    const result = await archiveData({
      tableName: "Task",
      archiveTableName: "ArchivedTask",
      condition: `status = 'COMPLETED' AND updated_at < NOW() - INTERVAL '${retentionDays} days'`,
      batchSize: 1000,
      dryRun,
    })
    results.push(result)
  }

  // Archive old deleted items
  if (config.dataRetention.deletedItems.enabled) {
    const retentionDays = config.dataRetention.deletedItems.retentionDays
    const result = await archiveData({
      tableName: "DeletedItem",
      archiveTableName: "ArchivedDeletedItem",
      condition: `deleted_at < NOW() - INTERVAL '${retentionDays} days'`,
      batchSize: 1000,
      dryRun,
    })
    results.push(result)
  }

  logger.info("Completed archiving old data")
  return results
}

// Purge archived data older than retention period
export const purgeArchivedData = async (dryRun = false): Promise<Record<string, number>> => {
  logger.info("Purging archived data older than retention period")

  const results: Record<string, number> = {}

  try {
    // Purge archived audit logs
    if (config.dataRetention.archivedData.auditLogs.enabled) {
      const retentionDays = config.dataRetention.archivedData.auditLogs.retentionDays
      if (!dryRun) {
        const result = await prisma.$executeRaw`
          DELETE FROM "ArchivedAuditLog" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedAuditLog = Number(result)
      } else {
        const result = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "ArchivedAuditLog" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedAuditLog = Number(result[0].count)
      }
      logger.info(`Purged ${results.ArchivedAuditLog} records from ArchivedAuditLog`)
    }

    // Purge archived activity logs
    if (config.dataRetention.archivedData.activityLogs.enabled) {
      const retentionDays = config.dataRetention.archivedData.activityLogs.retentionDays
      if (!dryRun) {
        const result = await prisma.$executeRaw`
          DELETE FROM "ArchivedActivityLog" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedActivityLog = Number(result)
      } else {
        const result = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "ArchivedActivityLog" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedActivityLog = Number(result[0].count)
      }
      logger.info(`Purged ${results.ArchivedActivityLog} records from ArchivedActivityLog`)
    }

    // Purge archived notifications
    if (config.dataRetention.archivedData.notifications.enabled) {
      const retentionDays = config.dataRetention.archivedData.notifications.retentionDays
      if (!dryRun) {
        const result = await prisma.$executeRaw`
          DELETE FROM "ArchivedNotification" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedNotification = Number(result)
      } else {
        const result = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "ArchivedNotification" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedNotification = Number(result[0].count)
      }
      logger.info(`Purged ${results.ArchivedNotification} records from ArchivedNotification`)
    }

    // Purge archived events
    if (config.dataRetention.archivedData.events.enabled) {
      const retentionDays = config.dataRetention.archivedData.events.retentionDays
      if (!dryRun) {
        const result = await prisma.$executeRaw`
          DELETE FROM "ArchivedEvent" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedEvent = Number(result)
      } else {
        const result = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "ArchivedEvent" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedEvent = Number(result[0].count)
      }
      logger.info(`Purged ${results.ArchivedEvent} records from ArchivedEvent`)
    }

    // Purge archived tasks
    if (config.dataRetention.archivedData.tasks.enabled) {
      const retentionDays = config.dataRetention.archivedData.tasks.retentionDays
      if (!dryRun) {
        const result = await prisma.$executeRaw`
          DELETE FROM "ArchivedTask" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedTask = Number(result)
      } else {
        const result = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "ArchivedTask" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedTask = Number(result[0].count)
      }
      logger.info(`Purged ${results.ArchivedTask} records from ArchivedTask`)
    }

    // Purge archived deleted items
    if (config.dataRetention.archivedData.deletedItems.enabled) {
      const retentionDays = config.dataRetention.archivedData.deletedItems.retentionDays
      if (!dryRun) {
        const result = await prisma.$executeRaw`
          DELETE FROM "ArchivedDeletedItem" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedDeletedItem = Number(result)
      } else {
        const result = await prisma.$queryRaw`
          SELECT COUNT(*) as count FROM "ArchivedDeletedItem" 
          WHERE archived_at < NOW() - INTERVAL '${retentionDays} days'
        `
        results.ArchivedDeletedItem = Number(result[0].count)
      }
      logger.info(`Purged ${results.ArchivedDeletedItem} records from ArchivedDeletedItem`)
    }

    logger.info("Completed purging archived data")
    return results
  } catch (error) {
    logger.error("Failed to purge archived data", error)
    throw error
  }
}

export default {
  archiveData,
  archiveOldData,
  purgeArchivedData,
}
