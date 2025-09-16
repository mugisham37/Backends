import type { Request, Response } from "express"
import prisma from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"

// Get users over time
export const getUsersOverTime = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      throw new ApiError(400, "Start date and end date are required")
    }

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get usage snapshots for the period
    const snapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    })

    // Calculate previous period for growth comparison
    const periodDuration = end.getTime() - start.getTime()
    const previousStart = new Date(start.getTime() - periodDuration)
    const previousEnd = new Date(start)

    const previousSnapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
    })

    // Calculate growth rates
    const currentPeriodLastSnapshot = snapshots[snapshots.length - 1] || { totalUsers: 0, activeUsers: 0 }
    const previousPeriodLastSnapshot = previousSnapshots[previousSnapshots.length - 1] || {
      totalUsers: 0,
      activeUsers: 0,
    }

    const userGrowth =
      previousPeriodLastSnapshot.totalUsers > 0
        ? ((currentPeriodLastSnapshot.totalUsers - previousPeriodLastSnapshot.totalUsers) /
            previousPeriodLastSnapshot.totalUsers) *
          100
        : 100

    const activeUserGrowth =
      previousPeriodLastSnapshot.activeUsers > 0
        ? ((currentPeriodLastSnapshot.activeUsers - previousPeriodLastSnapshot.activeUsers) /
            previousPeriodLastSnapshot.activeUsers) *
          100
        : 100

    // Format data for chart
    const labels = snapshots.map((snapshot) => {
      return new Date(snapshot.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    })

    const totalUsersData = snapshots.map((snapshot) => snapshot.totalUsers)
    const activeUsersData = snapshots.map((snapshot) => snapshot.activeUsers)

    // Calculate new users (difference between consecutive snapshots)
    const newUsersData = snapshots.map((snapshot, index) => {
      if (index === 0) {
        return 0 // No previous snapshot to compare
      }
      const diff = snapshot.totalUsers - snapshots[index - 1].totalUsers
      return diff > 0 ? diff : 0
    })

    // Sum of new users in the period
    const newUsers = newUsersData.reduce((sum, value) => sum + value, 0)
    const previousNewUsers =
      previousSnapshots.length > 1
        ? previousSnapshots.reduce((sum, snapshot, index) => {
            if (index === 0) return sum
            const diff = snapshot.totalUsers - previousSnapshots[index - 1].totalUsers
            return sum + (diff > 0 ? diff : 0)
          }, 0)
        : 0

    const newUserGrowth = previousNewUsers > 0 ? ((newUsers - previousNewUsers) / previousNewUsers) * 100 : 100

    res.status(200).json({
      status: "success",
      data: {
        totalUsers: currentPeriodLastSnapshot.totalUsers,
        activeUsers: currentPeriodLastSnapshot.activeUsers,
        newUsers,
        userGrowth,
        activeUserGrowth,
        newUserGrowth,
        chartData: {
          labels,
          datasets: [
            {
              label: "Total Users",
              data: totalUsersData,
              borderColor: "rgba(59, 130, 246, 1)",
              backgroundColor: "rgba(59, 130, 246, 0.5)",
            },
            {
              label: "Active Users",
              data: activeUsersData,
              borderColor: "rgba(16, 185, 129, 1)",
              backgroundColor: "rgba(16, 185, 129, 0.5)",
            },
            {
              label: "New Users",
              data: newUsersData,
              borderColor: "rgba(249, 115, 22, 1)",
              backgroundColor: "rgba(249, 115, 22, 0.5)",
            },
          ],
        },
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching users over time:", error)
    throw new ApiError(500, "Failed to fetch users over time")
  }
}

// Get projects over time
export const getProjectsOverTime = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      throw new ApiError(400, "Start date and end date are required")
    }

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get usage snapshots for the period
    const snapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    })

    // Calculate previous period for growth comparison
    const periodDuration = end.getTime() - start.getTime()
    const previousStart = new Date(start.getTime() - periodDuration)
    const previousEnd = new Date(start)

    const previousSnapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
    })

    // Calculate growth rates
    const currentPeriodLastSnapshot = snapshots[snapshots.length - 1] || { totalProjects: 0 }
    const previousPeriodLastSnapshot = previousSnapshots[previousSnapshots.length - 1] || { totalProjects: 0 }

    const projectGrowth =
      previousPeriodLastSnapshot.totalProjects > 0
        ? ((currentPeriodLastSnapshot.totalProjects - previousPeriodLastSnapshot.totalProjects) /
            previousPeriodLastSnapshot.totalProjects) *
          100
        : 100

    // Estimate active projects (70% of total as a placeholder)
    const activeProjects = Math.round(currentPeriodLastSnapshot.totalProjects * 0.7)
    const previousActiveProjects = Math.round(previousPeriodLastSnapshot.totalProjects * 0.7)

    const activeProjectGrowth =
      previousActiveProjects > 0 ? ((activeProjects - previousActiveProjects) / previousActiveProjects) * 100 : 100

    // Format data for chart
    const labels = snapshots.map((snapshot) => {
      return new Date(snapshot.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    })

    const totalProjectsData = snapshots.map((snapshot) => snapshot.totalProjects)

    // Calculate new projects (difference between consecutive snapshots)
    const newProjectsData = snapshots.map((snapshot, index) => {
      if (index === 0) {
        return 0 // No previous snapshot to compare
      }
      const diff = snapshot.totalProjects - snapshots[index - 1].totalProjects
      return diff > 0 ? diff : 0
    })

    // Sum of new projects in the period
    const newProjects = newProjectsData.reduce((sum, value) => sum + value, 0)
    const previousNewProjects =
      previousSnapshots.length > 1
        ? previousSnapshots.reduce((sum, snapshot, index) => {
            if (index === 0) return sum
            const diff = snapshot.totalProjects - previousSnapshots[index - 1].totalProjects
            return sum + (diff > 0 ? diff : 0)
          }, 0)
        : 0

    const newProjectGrowth =
      previousNewProjects > 0 ? ((newProjects - previousNewProjects) / previousNewProjects) * 100 : 100

    res.status(200).json({
      status: "success",
      data: {
        totalProjects: currentPeriodLastSnapshot.totalProjects,
        activeProjects,
        newProjects,
        projectGrowth,
        activeProjectGrowth,
        newProjectGrowth,
        chartData: {
          labels,
          datasets: [
            {
              label: "Total Projects",
              data: totalProjectsData,
              borderColor: "rgba(59, 130, 246, 1)",
              backgroundColor: "rgba(59, 130, 246, 0.5)",
            },
            {
              label: "New Projects",
              data: newProjectsData,
              borderColor: "rgba(249, 115, 22, 1)",
              backgroundColor: "rgba(249, 115, 22, 0.5)",
            },
          ],
        },
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching projects over time:", error)
    throw new ApiError(500, "Failed to fetch projects over time")
  }
}

// Get tasks over time
export const getTasksOverTime = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      throw new ApiError(400, "Start date and end date are required")
    }

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get usage snapshots for the period
    const snapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    })

    // Calculate previous period for growth comparison
    const periodDuration = end.getTime() - start.getTime()
    const previousStart = new Date(start.getTime() - periodDuration)
    const previousEnd = new Date(start)

    const previousSnapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
    })

    // Calculate growth rates
    const currentPeriodLastSnapshot = snapshots[snapshots.length - 1] || { totalTasks: 0, completedTasks: 0 }
    const previousPeriodLastSnapshot = previousSnapshots[previousSnapshots.length - 1] || {
      totalTasks: 0,
      completedTasks: 0,
    }

    const taskGrowth =
      previousPeriodLastSnapshot.totalTasks > 0
        ? ((currentPeriodLastSnapshot.totalTasks - previousPeriodLastSnapshot.totalTasks) /
            previousPeriodLastSnapshot.totalTasks) *
          100
        : 100

    const completedTaskGrowth =
      previousPeriodLastSnapshot.completedTasks > 0
        ? ((currentPeriodLastSnapshot.completedTasks - previousPeriodLastSnapshot.completedTasks) /
            previousPeriodLastSnapshot.completedTasks) *
          100
        : 100

    // Calculate completion rates
    const completionRate =
      currentPeriodLastSnapshot.totalTasks > 0
        ? (currentPeriodLastSnapshot.completedTasks / currentPeriodLastSnapshot.totalTasks) * 100
        : 0

    const previousCompletionRate =
      previousPeriodLastSnapshot.totalTasks > 0
        ? (previousPeriodLastSnapshot.completedTasks / previousPeriodLastSnapshot.totalTasks) * 100
        : 0

    const completionRateChange = completionRate - previousCompletionRate

    // Format data for chart
    const labels = snapshots.map((snapshot) => {
      return new Date(snapshot.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    })

    const totalTasksData = snapshots.map((snapshot) => snapshot.totalTasks)
    const completedTasksData = snapshots.map((snapshot) => snapshot.completedTasks)

    res.status(200).json({
      status: "success",
      data: {
        totalTasks: currentPeriodLastSnapshot.totalTasks,
        completedTasks: currentPeriodLastSnapshot.completedTasks,
        completionRate: Number.parseFloat(completionRate.toFixed(1)),
        taskGrowth,
        completedTaskGrowth,
        completionRateChange: Number.parseFloat(completionRateChange.toFixed(1)),
        chartData: {
          labels,
          datasets: [
            {
              label: "Total Tasks",
              data: totalTasksData,
              backgroundColor: "rgba(59, 130, 246, 0.7)",
            },
            {
              label: "Completed Tasks",
              data: completedTasksData,
              backgroundColor: "rgba(16, 185, 129, 0.7)",
            },
          ],
        },
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching tasks over time:", error)
    throw new ApiError(500, "Failed to fetch tasks over time")
  }
}

// Get storage usage
export const getStorageUsage = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string

    // Get latest usage snapshot
    const latestSnapshot = await prisma.usageSnapshot.findFirst({
      where: {
        tenantId,
      },
      orderBy: {
        date: "desc",
      },
    })

    if (!latestSnapshot) {
      throw new ApiError(404, "No usage data found")
    }

    // Get snapshot from previous month for comparison
    const previousMonthDate = new Date()
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1)

    const previousMonthSnapshot = await prisma.usageSnapshot.findFirst({
      where: {
        tenantId,
        date: {
          lt: previousMonthDate,
        },
      },
      orderBy: {
        date: "desc",
      },
    })

    // Convert bytes to GB
    const storageUsedGB = latestSnapshot.storageUsed / (1024 * 1024 * 1024)
    const previousStorageUsedGB = previousMonthSnapshot ? previousMonthSnapshot.storageUsed / (1024 * 1024 * 1024) : 0

    // Calculate growth
    const storageGrowth =
      previousStorageUsedGB > 0 ? ((storageUsedGB - previousStorageUsedGB) / previousStorageUsedGB) * 100 : 100

    // Storage limit based on subscription (placeholder)
    const storageLimit = 50 // GB

    // Storage utilization percentage
    const storageUtilization = (storageUsedGB / storageLimit) * 100

    // Mock data for storage breakdown by type
    const storageBreakdown = {
      documents: storageUsedGB * 0.35,
      images: storageUsedGB * 0.45,
      videos: storageUsedGB * 0.15,
      other: storageUsedGB * 0.05,
    }

    res.status(200).json({
      status: "success",
      data: {
        totalStorage: Number.parseFloat(storageUsedGB.toFixed(1)),
        storageLimit,
        storageUtilization: Number.parseFloat(storageUtilization.toFixed(1)),
        storageGrowth: Number.parseFloat(storageGrowth.toFixed(1)),
        chartData: {
          labels: ["Documents", "Images", "Videos", "Other"],
          datasets: [
            {
              data: [
                Number.parseFloat(storageBreakdown.documents.toFixed(1)),
                Number.parseFloat(storageBreakdown.images.toFixed(1)),
                Number.parseFloat(storageBreakdown.videos.toFixed(1)),
                Number.parseFloat(storageBreakdown.other.toFixed(1)),
              ],
              backgroundColor: [
                "rgba(59, 130, 246, 0.7)",
                "rgba(16, 185, 129, 0.7)",
                "rgba(249, 115, 22, 0.7)",
                "rgba(139, 92, 246, 0.7)",
              ],
            },
          ],
        },
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching storage usage:", error)
    throw new ApiError(500, "Failed to fetch storage usage")
  }
}

// Get API usage
export const getApiUsage = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string
    const { startDate, endDate } = req.query

    if (!startDate || !endDate) {
      throw new ApiError(400, "Start date and end date are required")
    }

    const start = new Date(startDate as string)
    const end = new Date(endDate as string)

    // Get usage snapshots for the period
    const snapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        date: "asc",
      },
    })

    // Calculate previous period for growth comparison
    const periodDuration = end.getTime() - start.getTime()
    const previousStart = new Date(start.getTime() - periodDuration)
    const previousEnd = new Date(start)

    const previousSnapshots = await prisma.usageSnapshot.findMany({
      where: {
        tenantId,
        date: {
          gte: previousStart,
          lt: previousEnd,
        },
      },
    })

    // Sum API calls for current period
    const totalCalls = snapshots.reduce((sum, snapshot) => sum + snapshot.apiCalls, 0)

    // Sum API calls for previous period
    const previousTotalCalls = previousSnapshots.reduce((sum, snapshot) => sum + snapshot.apiCalls, 0)

    // Calculate growth
    const callGrowth = previousTotalCalls > 0 ? ((totalCalls - previousTotalCalls) / previousTotalCalls) * 100 : 100

    // Calculate error rates
    const totalErrors = snapshots.reduce((sum, snapshot) => sum + snapshot.errorCount, 0)
    const errorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0

    const previousTotalErrors = previousSnapshots.reduce((sum, snapshot) => sum + snapshot.errorCount, 0)
    const previousErrorRate = previousTotalCalls > 0 ? (previousTotalErrors / previousTotalCalls) * 100 : 0

    const errorRateChange = errorRate - previousErrorRate

    // Mock data for response times (placeholder)
    const avgResponseTime = 120 // ms
    const previousAvgResponseTime = 125 // ms
    const responseTimeChange = ((avgResponseTime - previousAvgResponseTime) / previousAvgResponseTime) * 100

    // Format data for chart
    const labels = snapshots.map((snapshot) => {
      return new Date(snapshot.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    })

    const apiCallsData = snapshots.map((snapshot) => snapshot.apiCalls)

    // Mock response time data (placeholder)
    const responseTimeData = apiCallsData.map(() => {
      return Math.floor(Math.random() * 20) + 110 // Random between 110-130ms
    })

    res.status(200).json({
      status: "success",
      data: {
        totalCalls,
        avgResponseTime,
        errorRate: Number.parseFloat(errorRate.toFixed(1)),
        callGrowth: Number.parseFloat(callGrowth.toFixed(1)),
        responseTimeChange: Number.parseFloat(responseTimeChange.toFixed(1)),
        errorRateChange: Number.parseFloat(errorRateChange.toFixed(1)),
        chartData: {
          labels,
          datasets: [
            {
              label: "API Calls",
              data: apiCallsData,
              borderColor: "rgba(59, 130, 246, 1)",
              backgroundColor: "rgba(59, 130, 246, 0.5)",
              yAxisID: "y",
            },
            {
              label: "Response Time (ms)",
              data: responseTimeData,
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
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching API usage:", error)
    throw new ApiError(500, "Failed to fetch API usage")
  }
}

// Create usage snapshot (admin only)
export const createUsageSnapshot = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string

    // This would typically be called by a scheduled job, not directly via API
    // For demo purposes, we're creating a snapshot with mock data

    const snapshot = await prisma.usageSnapshot.create({
      data: {
        tenantId,
        totalUsers: Math.floor(Math.random() * 100) + 100,
        activeUsers: Math.floor(Math.random() * 50) + 50,
        totalProjects: Math.floor(Math.random() * 30) + 20,
        totalTasks: Math.floor(Math.random() * 200) + 100,
        completedTasks: Math.floor(Math.random() * 100) + 50,
        storageUsed: (Math.random() * 10 + 5) * 1024 * 1024 * 1024, // 5-15 GB in bytes
        apiCalls: Math.floor(Math.random() * 5000) + 1000,
        errorCount: Math.floor(Math.random() * 50),
      },
    })

    res.status(201).json({
      status: "success",
      data: snapshot,
    })
  } catch (error) {
    logger.error("Error creating usage snapshot:", error)
    throw new ApiError(500, "Failed to create usage snapshot")
  }
}
