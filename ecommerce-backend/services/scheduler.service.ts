import { CronJob } from "cron"
import { createRequestLogger } from "../config/logger"
import * as emailService from "./email.service"
import { isRedisConnected } from "../config/redis"
import { LoyaltyProgram, LoyaltyHistory } from "../models/loyalty.model"
import { User } from "../models/user.model"
import * as settingsService from "./settings.service"
import * as loyaltyService from "./loyalty.service"
import { sendEmail } from "./email.service"

// Create logger
const logger = createRequestLogger()

// Define cron jobs
const jobs: Record<string, CronJob> = {}

/**
 * Initialize scheduler
 */
export const initScheduler = (): void => {
  logger.info("Initializing scheduler")

  // Process email queue every 5 minutes
  jobs.processEmailQueue = new CronJob(
    "*/5 * * * *", // Every 5 minutes
    async () => {
      try {
        logger.info("Running scheduled job: processEmailQueue")

        // Check if Redis is connected
        if (!isRedisConnected()) {
          logger.error("Redis is not connected, skipping email queue processing")
          return
        }

        // Get queue length
        const queueLength = await emailService.getEmailQueueLength()
        logger.info(`Email queue length: ${queueLength}`)

        // Process up to 50 emails at a time
        if (queueLength > 0) {
          const processed = await emailService.processEmailQueue(50)
          logger.info(`Processed ${processed} emails from queue`)
        }
      } catch (error) {
        logger.error(`Error processing email queue: ${error.message}`)
      }
    },
    null, // onComplete
    false, // start
    "UTC", // timezone
  )

  // Expire loyalty points daily at midnight
  jobs.expireLoyaltyPoints = new CronJob(
    "0 0 * * *", // Every day at midnight
    async () => {
      try {
        logger.info("Running scheduled job: expireLoyaltyPoints")

        // Get expiry configuration (in a real app, this would come from a settings table)
        const POINTS_EXPIRY_DAYS = 365 // 1 year

        // Calculate expiry date
        const expiryDate = new Date()
        expiryDate.setDate(expiryDate.getDate() - POINTS_EXPIRY_DAYS)

        // Find loyalty history entries older than expiry date that haven't been processed
        const historyEntries = await LoyaltyHistory.find({
          createdAt: { $lt: expiryDate },
          type: { $in: ["order", "referral", "manual", "other"] }, // Only positive point entries
          points: { $gt: 0 },
          processed: { $ne: true },
        })

        logger.info(`Found ${historyEntries.length} loyalty history entries to expire`)

        // Process each entry
        for (const entry of historyEntries) {
          try {
            // Get user's loyalty program
            const loyaltyProgram = await LoyaltyProgram.findOne({ user: entry.user })
            if (!loyaltyProgram) {
              logger.warn(`Loyalty program not found for user ${entry.user}`)
              continue
            }

            // Check if user has enough points to expire
            if (loyaltyProgram.points < entry.points) {
              logger.warn(
                `User ${entry.user} doesn't have enough points to expire (${loyaltyProgram.points} < ${entry.points})`,
              )
              continue
            }

            // Deduct points
            loyaltyProgram.points -= entry.points
            await loyaltyProgram.save()

            // Mark entry as processed
            entry.processed = true
            await entry.save()

            // Add expiry entry to history
            await LoyaltyHistory.create({
              user: entry.user,
              type: "expire",
              points: -entry.points,
              description: `Points expired from ${new Date(entry.createdAt).toLocaleDateString()}`,
            })

            logger.info(`Expired ${entry.points} points for user ${entry.user}`)
          } catch (error) {
            logger.error(`Error processing loyalty expiry for user ${entry.user}: ${error.message}`)
          }
        }

        logger.info("Completed loyalty points expiry job")
      } catch (error) {
        logger.error(`Error in expireLoyaltyPoints job: ${error.message}`)
      }
    },
    null, // onComplete
    false, // start
    "UTC", // timezone
  )

  // Award birthday bonus points daily at 8 AM
  jobs.awardBirthdayBonuses = new CronJob(
    "0 8 * * *", // Every day at 8 AM
    async () => {
      try {
        logger.info("Running scheduled job: awardBirthdayBonuses")

        // Get today's date
        const today = new Date()
        const month = today.getMonth() + 1 // JavaScript months are 0-indexed
        const day = today.getDate()

        // Find users whose birthday is today
        const birthdayUsers = await User.find({
          "profile.birthMonth": month,
          "profile.birthDay": day,
          role: "customer",
          active: true,
        })

        logger.info(`Found ${birthdayUsers.length} users with birthdays today`)

        // Get birthday bonus points from settings
        const birthdayBonus = await settingsService.getSetting("loyalty.birthdayBonus", 100)

        // Award points to each user
        for (const user of birthdayUsers) {
          try {
            await loyaltyService.addLoyaltyPoints(
              user._id.toString(),
              birthdayBonus,
              "Birthday bonus points",
              undefined,
              "other",
            )

            logger.info(`Awarded ${birthdayBonus} birthday bonus points to user ${user._id}`)

            // Send birthday email
            if (user.email) {
              try {
                await sendEmail(
                  user.email,
                  "Happy Birthday from Our Store!",
                  `
                <h1>Happy Birthday, ${user.firstName}!</h1>
                <p>We hope you have a fantastic day!</p>
                <p>As a token of our appreciation, we've added ${birthdayBonus} bonus points to your loyalty account.</p>
                <p>Visit our store to redeem your points for special rewards!</p>
                <p>Thank you for being a valued customer.</p>
                `,
                  {},
                )
              } catch (emailError) {
                logger.error(`Error sending birthday email to user ${user._id}: ${emailError.message}`)
              }
            }
          } catch (error) {
            logger.error(`Error awarding birthday bonus to user ${user._id}: ${error.message}`)
          }
        }

        logger.info("Completed birthday bonus job")
      } catch (error) {
        logger.error(`Error in awardBirthdayBonuses job: ${error.message}`)
      }
    },
    null, // onComplete
    false, // start
    "UTC", // timezone
  )

  // Start all jobs
  startAllJobs()
}

/**
 * Start all cron jobs
 */
export const startAllJobs = (): void => {
  logger.info("Starting all scheduled jobs")

  Object.keys(jobs).forEach((jobName) => {
    if (!jobs[jobName].running) {
      jobs[jobName].start()
      logger.info(`Started job: ${jobName}`)
    } else {
      logger.info(`Job already running: ${jobName}`)
    }
  })
}

/**
 * Stop all cron jobs
 */
export const stopAllJobs = (): void => {
  logger.info("Stopping all scheduled jobs")

  Object.keys(jobs).forEach((jobName) => {
    if (jobs[jobName].running) {
      jobs[jobName].stop()
      logger.info(`Stopped job: ${jobName}`)
    } else {
      logger.info(`Job already stopped: ${jobName}`)
    }
  })
}

/**
 * Get job status
 * @returns Object with job status
 */
export const getJobStatus = (): Record<string, { running: boolean; nextRun: Date | null }> => {
  const status: Record<string, { running: boolean; nextRun: Date | null }> = {}

  Object.keys(jobs).forEach((jobName) => {
    status[jobName] = {
      running: jobs[jobName].running,
      nextRun: jobs[jobName].nextDate().toDate(),
    }
  })

  return status
}

/**
 * Start a specific job
 * @param jobName Job name
 * @returns True if job was started, false otherwise
 */
export const startJob = (jobName: string): boolean => {
  logger.info(`Starting job: ${jobName}`)

  if (!jobs[jobName]) {
    logger.error(`Job not found: ${jobName}`)
    return false
  }

  if (jobs[jobName].running) {
    logger.info(`Job already running: ${jobName}`)
    return true
  }

  jobs[jobName].start()
  logger.info(`Started job: ${jobName}`)
  return true
}

/**
 * Stop a specific job
 * @param jobName Job name
 * @returns True if job was stopped, false otherwise
 */
export const stopJob = (jobName: string): boolean => {
  logger.info(`Stopping job: ${jobName}`)

  if (!jobs[jobName]) {
    logger.error(`Job not found: ${jobName}`)
    return false
  }

  if (!jobs[jobName].running) {
    logger.info(`Job already stopped: ${jobName}`)
    return true
  }

  jobs[jobName].stop()
  logger.info(`Stopped job: ${jobName}`)
  return true
}

/**
 * Run a specific job immediately
 * @param jobName Job name
 * @returns True if job was run, false otherwise
 */
export const runJobNow = async (jobName: string): Promise<boolean> => {
  logger.info(`Running job now: ${jobName}`)

  if (!jobs[jobName]) {
    logger.error(`Job not found: ${jobName}`)
    return false
  }

  try {
    // Execute the job's onTick function
    await jobs[jobName].fireOnTick()
    logger.info(`Job executed successfully: ${jobName}`)
    return true
  } catch (error) {
    logger.error(`Error running job ${jobName}: ${error.message}`)
    return false
  }
}
