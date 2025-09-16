import fs from "fs"
import path from "path"
import { prisma } from "./prisma"
import { logger } from "./logger"

// Migration interface
interface Migration {
  id: string
  name: string
  description: string
  timestamp: Date
  appliedAt?: Date
  batch?: number
  status: "pending" | "applied" | "failed"
  error?: string
  up: () => Promise<void>
  down: () => Promise<void>
}

// Migration registry
const migrations: Migration[] = []

// Register a migration
export const registerMigration = (migration: Migration): void => {
  migrations.push(migration)
  logger.debug(`Migration registered: ${migration.id} - ${migration.name}`)
}

// Get all migrations
export const getAllMigrations = (): Migration[] => {
  return [...migrations].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
}

// Get pending migrations
export const getPendingMigrations = (): Migration[] => {
  return getAllMigrations().filter((migration) => migration.status === "pending")
}

// Get applied migrations
export const getAppliedMigrations = (): Migration[] => {
  return getAllMigrations().filter((migration) => migration.status === "applied")
}

// Get failed migrations
export const getFailedMigrations = (): Migration[] => {
  return getAllMigrations().filter((migration) => migration.status === "failed")
}

// Apply a migration
export const applyMigration = async (migration: Migration): Promise<void> => {
  logger.info(`Applying migration: ${migration.id} - ${migration.name}`)

  try {
    // Apply the migration
    await migration.up()

    // Update migration status
    migration.status = "applied"
    migration.appliedAt = new Date()

    // Record the migration in the database
    await prisma.migration.create({
      data: {
        id: migration.id,
        name: migration.name,
        description: migration.description,
        timestamp: migration.timestamp,
        appliedAt: migration.appliedAt,
        batch: migration.batch,
        status: migration.status,
      },
    })

    logger.info(`Migration applied successfully: ${migration.id} - ${migration.name}`)
  } catch (error) {
    // Update migration status
    migration.status = "failed"
    migration.error = error.message

    // Record the failed migration in the database
    await prisma.migration.create({
      data: {
        id: migration.id,
        name: migration.name,
        description: migration.description,
        timestamp: migration.timestamp,
        appliedAt: new Date(),
        batch: migration.batch,
        status: migration.status,
        error: migration.error,
      },
    })

    logger.error(`Migration failed: ${migration.id} - ${migration.name}`, error)
    throw error
  }
}

// Rollback a migration
export const rollbackMigration = async (migration: Migration): Promise<void> => {
  logger.info(`Rolling back migration: ${migration.id} - ${migration.name}`)

  try {
    // Rollback the migration
    await migration.down()

    // Update migration status
    migration.status = "pending"
    migration.appliedAt = undefined
    migration.batch = undefined

    // Update the migration in the database
    await prisma.migration.update({
      where: { id: migration.id },
      data: {
        status: "pending",
        appliedAt: null,
        batch: null,
        error: null,
      },
    })

    logger.info(`Migration rolled back successfully: ${migration.id} - ${migration.name}`)
  } catch (error) {
    logger.error(`Migration rollback failed: ${migration.id} - ${migration.name}`, error)
    throw error
  }
}

// Apply all pending migrations
export const applyPendingMigrations = async (): Promise<void> => {
  logger.info("Applying pending migrations")

  // Get pending migrations
  const pendingMigrations = getPendingMigrations()

  if (pendingMigrations.length === 0) {
    logger.info("No pending migrations to apply")
    return
  }

  // Get the latest batch number
  const latestBatch = await prisma.migration.findFirst({
    orderBy: { batch: "desc" },
    select: { batch: true },
  })

  const batchNumber = latestBatch ? latestBatch.batch + 1 : 1

  // Apply migrations in a transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (const migration of pendingMigrations) {
        migration.batch = batchNumber
        await applyMigration(migration)
      }
    })

    logger.info(`Applied ${pendingMigrations.length} migrations successfully`)
  } catch (error) {
    logger.error("Failed to apply migrations", error)
    throw error
  }
}

// Rollback the last batch of migrations
export const rollbackLastBatch = async (): Promise<void> => {
  logger.info("Rolling back the last batch of migrations")

  // Get the latest batch number
  const latestBatch = await prisma.migration.findFirst({
    orderBy: { batch: "desc" },
    select: { batch: true },
  })

  if (!latestBatch) {
    logger.info("No migrations to rollback")
    return
  }

  // Get migrations from the latest batch
  const batchMigrations = await prisma.migration.findMany({
    where: { batch: latestBatch.batch },
    orderBy: { timestamp: "desc" },
  })

  if (batchMigrations.length === 0) {
    logger.info("No migrations to rollback")
    return
  }

  // Find the corresponding migrations in the registry
  const migrationsToRollback = batchMigrations
    .map((dbMigration) => migrations.find((m) => m.id === dbMigration.id))
    .filter((m) => m !== undefined) as Migration[]

  // Rollback migrations in reverse order
  try {
    await prisma.$transaction(async (tx) => {
      for (const migration of migrationsToRollback) {
        await rollbackMigration(migration)
      }
    })

    logger.info(`Rolled back ${migrationsToRollback.length} migrations successfully`)
  } catch (error) {
    logger.error("Failed to rollback migrations", error)
    throw error
  }
}

// Load migrations from a directory
export const loadMigrationsFromDirectory = async (directory: string): Promise<void> => {
  logger.info(`Loading migrations from directory: ${directory}`)

  // Check if directory exists
  if (!fs.existsSync(directory)) {
    logger.error(`Migrations directory does not exist: ${directory}`)
    throw new Error(`Migrations directory does not exist: ${directory}`)
  }

  // Get all migration files
  const files = fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".js") || file.endsWith(".ts"))
    .sort()

  // Load each migration file
  for (const file of files) {
    const filePath = path.join(directory, file)
    logger.debug(`Loading migration file: ${filePath}`)

    try {
      // Import the migration file
      const migration = await import(filePath)

      // Register the migration
      if (migration.default && typeof migration.default === "object") {
        registerMigration(migration.default)
      } else {
        logger.warn(`Invalid migration file: ${filePath}`)
      }
    } catch (error) {
      logger.error(`Failed to load migration file: ${filePath}`, error)
      throw error
    }
  }

  logger.info(`Loaded ${migrations.length} migrations from directory`)
}

// Initialize the migrations table
export const initMigrationsTable = async (): Promise<void> => {
  logger.info("Initializing migrations table")

  try {
    // Check if the migrations table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'Migration'
      )
    `

    if (!tableExists[0].exists) {
      logger.info("Creating migrations table")

      // Create the migrations table
      await prisma.$executeRaw`
        CREATE TABLE "Migration" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "timestamp" TIMESTAMP(3) NOT NULL,
          "appliedAt" TIMESTAMP(3),
          "batch" INTEGER,
          "status" TEXT NOT NULL,
          "error" TEXT,
          PRIMARY KEY ("id")
        )
      `
    }

    logger.info("Migrations table initialized")
  } catch (error) {
    logger.error("Failed to initialize migrations table", error)
    throw error
  }
}

// Sync the migrations registry with the database
export const syncMigrationsWithDatabase = async (): Promise<void> => {
  logger.info("Syncing migrations with database")

  try {
    // Get all migrations from the database
    const dbMigrations = await prisma.migration.findMany()

    // Update the status of migrations in the registry
    for (const dbMigration of dbMigrations) {
      const migration = migrations.find((m) => m.id === dbMigration.id)

      if (migration) {
        migration.status = dbMigration.status as "pending" | "applied" | "failed"
        migration.appliedAt = dbMigration.appliedAt || undefined
        migration.batch = dbMigration.batch || undefined
        migration.error = dbMigration.error || undefined
      }
    }

    logger.info("Migrations synced with database")
  } catch (error) {
    logger.error("Failed to sync migrations with database", error)
    throw error
  }
}

// Initialize the migration system
export const initMigrations = async (directory: string): Promise<void> => {
  logger.info("Initializing migration system")

  try {
    // Initialize the migrations table
    await initMigrationsTable()

    // Load migrations from directory
    await loadMigrationsFromDirectory(directory)

    // Sync migrations with database
    await syncMigrationsWithDatabase()

    logger.info("Migration system initialized")
  } catch (error) {
    logger.error("Failed to initialize migration system", error)
    throw error
  }
}

export default {
  registerMigration,
  getAllMigrations,
  getPendingMigrations,
  getAppliedMigrations,
  getFailedMigrations,
  applyMigration,
  rollbackMigration,
  applyPendingMigrations,
  rollbackLastBatch,
  loadMigrationsFromDirectory,
  initMigrationsTable,
  syncMigrationsWithDatabase,
  initMigrations,
}
