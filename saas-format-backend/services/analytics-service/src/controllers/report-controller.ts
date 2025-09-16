import type { Request, Response } from "express"
import prisma from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import redisClient from "../utils/redis-client"
import { logger } from "../utils/logger"

// Create a new analytics report
export const createReport = async (req: Request, res: Response) => {
  try {
    const { name, description, type, config } = req.body
    const tenantId = req.headers["x-tenant-id"] as string
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "User ID is required")
    }

    const report = await prisma.analyticsReport.create({
      data: {
        name,
        description,
        type,
        config,
        tenantId,
        createdBy: userId,
      },
    })

    res.status(201).json({
      status: "success",
      data: report,
    })
  } catch (error) {
    logger.error("Error creating analytics report:", error)
    throw new ApiError(500, "Failed to create analytics report")
  }
}

// Get all reports for the tenant
export const getReports = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string

    const reports = await prisma.analyticsReport.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    })

    res.status(200).json({
      status: "success",
      data: reports,
    })
  } catch (error) {
    logger.error("Error fetching analytics reports:", error)
    throw new ApiError(500, "Failed to fetch analytics reports")
  }
}

// Get a specific report by ID
export const getReportById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    const report = await prisma.analyticsReport.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!report) {
      throw new ApiError(404, "Analytics report not found")
    }

    res.status(200).json({
      status: "success",
      data: report,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching analytics report:", error)
    throw new ApiError(500, "Failed to fetch analytics report")
  }
}

// Update a report
export const updateReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, config } = req.body
    const tenantId = req.headers["x-tenant-id"] as string

    // Check if report exists and belongs to tenant
    const existingReport = await prisma.analyticsReport.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!existingReport) {
      throw new ApiError(404, "Analytics report not found")
    }

    // Update the report
    const updatedReport = await prisma.analyticsReport.update({
      where: { id },
      data: {
        name,
        description,
        config,
      },
    })

    res.status(200).json({
      status: "success",
      data: updatedReport,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error updating analytics report:", error)
    throw new ApiError(500, "Failed to update analytics report")
  }
}

// Delete a report
export const deleteReport = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    // Check if report exists and belongs to tenant
    const report = await prisma.analyticsReport.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!report) {
      throw new ApiError(404, "Analytics report not found")
    }

    // Delete the report
    await prisma.analyticsReport.delete({
      where: { id },
    })

    // Also remove this report from any dashboards
    const dashboards = await prisma.analyticsDashboard.findMany({
      where: {
        tenantId,
        reports: {
          has: id,
        },
      },
    })

    // Update dashboards to remove the deleted report
    for (const dashboard of dashboards) {
      await prisma.analyticsDashboard.update({
        where: { id: dashboard.id },
        data: {
          reports: dashboard.reports.filter((reportId) => reportId !== id),
        },
      })
    }

    res.status(200).json({
      status: "success",
      message: "Analytics report deleted successfully",
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error deleting analytics report:", error)
    throw new ApiError(500, "Failed to delete analytics report")
  }
}

// Generate report data based on report configuration
export const generateReportData = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { params } = req.body || {}
    const tenantId = req.headers["x-tenant-id"] as string

    // Get report configuration
    const report = await prisma.analyticsReport.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!report) {
      throw new ApiError(404, "Analytics report not found")
    }

    // Check cache first
    const cacheKey = `report:${id}:${JSON.stringify(params || {})}`
    const cachedData = await redisClient.get(cacheKey)

    if (cachedData) {
      return res.status(200).json({
        status: "success",
        data: JSON.parse(cachedData),
        cached: true,
      })
    }

    // Generate report data based on report type and configuration
    let reportData

    switch (report.type) {
      case "user_growth":
        reportData = await generateUserGrowthReport(tenantId, report.config, params)
        break
      case "project_metrics":
        reportData = await generateProjectMetricsReport(tenantId, report.config, params)
        break
      case "task_completion":
        reportData = await generateTaskCompletionReport(tenantId, report.config, params)
        break
      case "api_usage":
        reportData = await generateApiUsageReport(tenantId, report.config, params)
        break
      case "storage_usage":
        reportData = await generateStorageUsageReport(tenantId, report.config, params)
        break
      case "custom":
        reportData = await generateCustomReport(tenantId, report.config, params)
        break
      default:
        throw new ApiError(400, "Unsupported report type")
    }

    // Cache the report data
    await redisClient.set(cacheKey, JSON.stringify(reportData), "EX", 300) // Cache for 5 minutes

    res.status(200).json({
      status: "success",
      data: reportData,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error generating report data:", error)
    throw new ApiError(500, "Failed to generate report data")
  }
}

// Helper functions for generating different report types
async function generateUserGrowthReport(tenantId: string, config: any, params: any) {
  // Get time range from params or use default
  const timeRange = params?.timeRange || "30d"
  const endDate = new Date()
  const startDate = new Date()

  switch (timeRange) {
    case "7d":
      startDate.setDate(endDate.getDate() - 7)
      break
    case "30d":
      startDate.setDate(endDate.getDate() - 30)
      break
    case "90d":
      startDate.setDate(endDate.getDate() - 90)
      break
    case "1y":
      startDate.setFullYear(endDate.getFullYear() - 1)
      break
    default:
      startDate.setDate(endDate.getDate() - 30)
  }

  // Get user events for the period
  const userEvents = await prisma.analyticsEvent.findMany({
    where: {
      tenantId,
      name: { in: ["user_signup", "user_login"] },
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: {
      timestamp: "asc",
    },
  })

  // Process data for chart
  const signups = userEvents.filter((event) => event.name === "user_signup")
  const logins = userEvents.filter((event) => event.name === "user_login")

  // Get unique users who logged in
  const uniqueActiveUsers = new Set(logins.map((event) => event.userId))

  // Calculate growth rates
  const previousPeriodStart = new Date(startDate)
  previousPeriodStart.setDate(
    previousPeriodStart.getDate() - (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  const previousPeriodUserEvents = await prisma.analyticsEvent.findMany({
    where: {
      tenantId,
      name: { in: ["user_signup", "user_login"] },
      timestamp: {
        gte: previousPeriodStart,
        lt: startDate,
      },
    },
  })

  const previousSignups = previousPeriodUserEvents.filter((event) => event.name === "user_signup")
  const previousUniqueActiveUsers = new Set(
    previousPeriodUserEvents.filter((event) => event.name === "user_login").map((event) => event.userId),
  )

  // Calculate growth percentages
  const signupGrowth =
    previousSignups.length > 0 ? ((signups.length - previousSignups.length) / previousSignups.length) * 100 : 100
  const activeUserGrowth =
    previousUniqueActiveUsers.size > 0
      ? ((uniqueActiveUsers.size - previousUniqueActiveUsers.size) / previousUniqueActiveUsers.size) * 100
      : 100

  // Group data by day for chart
  const days: { [key: string]: { signups: number; logins: number } } = {}
  const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })

  userEvents.forEach((event) => {
    const day = dateFormat.format(new Date(event.timestamp))
    if (!days[day]) {
      days[day] = { signups: 0, logins: 0 }
    }

    if (event.name === "user_signup") {
      days[day].signups++
    } else if (event.name === "user_login") {
      days[day].logins++
    }
  })

  // Format for chart
  const labels = Object.keys(days)
  const signupData = labels.map((day) => days[day].signups)
  const loginData = labels.map((day) => days[day].logins)

  return {
    title: "User Growth",
    description: `User growth over the last ${timeRange}`,
    totalUsers: signups.length,
    activeUsers: uniqueActiveUsers.size,
    newUsers: signups.length,
    userGrowth: signupGrowth,
    activeUserGrowth: activeUserGrowth,
    chartType: "line",
    chartData: {
      labels,
      datasets: [
        {
          label: "New Users",
          data: signupData,
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.5)",
        },
        {
          label: "Active Users",
          data: loginData,
          borderColor: "rgba(16, 185, 129, 1)",
          backgroundColor: "rgba(16, 185, 129, 0.5)",
        },
      ],
    },
  }
}

async function generateProjectMetricsReport(tenantId: string, config: any, params: any) {
  // Implementation similar to user growth report but for projects
  // This is a placeholder implementation
  return {
    title: "Project Metrics",
    description: "Project creation and activity metrics",
    totalProjects: 120,
    activeProjects: 85,
    newProjects: 15,
    projectGrowth: 12.5,
    activeProjectGrowth: 8.2,
    chartType: "line",
    chartData: {
      labels: ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5", "Jan 6", "Jan 7"],
      datasets: [
        {
          label: "New Projects",
          data: [3, 2, 4, 1, 5, 0, 2],
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.5)",
        },
        {
          label: "Active Projects",
          data: [65, 70, 68, 72, 75, 80, 85],
          borderColor: "rgba(16, 185, 129, 1)",
          backgroundColor: "rgba(16, 185, 129, 0.5)",
        },
      ],
    },
  }
}

async function generateTaskCompletionReport(tenantId: string, config: any, params: any) {
  // Implementation for task completion metrics
  // This is a placeholder implementation
  return {
    title: "Task Completion",
    description: "Task creation and completion metrics",
    totalTasks: 450,
    completedTasks: 320,
    completionRate: 71.1,
    taskGrowth: 15.2,
    completedTaskGrowth: 18.5,
    completionRateChange: 3.2,
    chartType: "bar",
    chartData: {
      labels: ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5", "Jan 6", "Jan 7"],
      datasets: [
        {
          label: "Created Tasks",
          data: [25, 30, 15, 20, 35, 10, 15],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
        {
          label: "Completed Tasks",
          data: [15, 25, 10, 15, 30, 8, 12],
          backgroundColor: "rgba(16, 185, 129, 0.7)",
        },
      ],
    },
  }
}

async function generateApiUsageReport(tenantId: string, config: any, params: any) {
  // Implementation for API usage metrics
  // This is a placeholder implementation
  return {
    title: "API Usage",
    description: "API calls and performance metrics",
    totalCalls: 25600,
    avgResponseTime: 120,
    errorRate: 1.2,
    callGrowth: 22.5,
    responseTimeChange: -5.3,
    errorRateChange: -0.3,
    chartType: "line",
    chartData: {
      labels: ["Jan 1", "Jan 2", "Jan 3", "Jan 4", "Jan 5", "Jan 6", "Jan 7"],
      datasets: [
        {
          label: "API Calls",
          data: [3200, 3500, 3800, 3600, 3900, 4100, 3500],
          borderColor: "rgba(59, 130, 246, 1)",
          backgroundColor: "rgba(59, 130, 246, 0.5)",
          yAxisID: "y",
        },
        {
          label: "Response Time (ms)",
          data: [130, 125, 120, 118, 122, 115, 120],
          borderColor: "rgba(249, 115, 22, 1)",
          backgroundColor: "rgba(249, 115, 22, 0.5)",
          yAxisID: "y1",
        },
      ],
    },
    chartOptions: {
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "API Calls",
          },
        },
        y1: {
          type: "linear",
          display: true,
          position: "right",
          title: {
            display: true,
            text: "Response Time (ms)",
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
    },
  }
}

async function generateStorageUsageReport(tenantId: string, config: any, params: any) {
  // Implementation for storage usage metrics
  // This is a placeholder implementation
  return {
    title: "Storage Usage",
    description: "Storage consumption by category",
    totalStorage: 15.6,
    storageLimit: 50,
    storageUtilization: 31.2,
    storageGrowth: 8.5,
    chartType: "pie",
    chartData: {
      labels: ["Documents", "Images", "Videos", "Other"],
      datasets: [
        {
          data: [5.2, 7.8, 1.5, 1.1],
          backgroundColor: [
            "rgba(59, 130, 246, 0.7)",
            "rgba(16, 185, 129, 0.7)",
            "rgba(249, 115, 22, 0.7)",
            "rgba(139, 92, 246, 0.7)",
          ],
        },
      ],
    },
  }
}

async function generateCustomReport(tenantId: string, config: any, params: any) {
  // Implementation for custom reports based on configuration
  // This would allow users to create their own report types

  // Extract query parameters from config
  const { metrics, dimensions, filters } = config

  // This is a placeholder implementation
  return {
    title: config.title || "Custom Report",
    description: config.description || "Custom analytics report",
    chartType: config.chartType || "bar",
    chartData: {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      datasets: [
        {
          label: "Custom Metric",
          data: [12, 19, 3, 5, 2, 3],
          backgroundColor: "rgba(59, 130, 246, 0.7)",
        },
      ],
    },
  }
}
