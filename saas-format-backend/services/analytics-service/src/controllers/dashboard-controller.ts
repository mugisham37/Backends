import type { Request, Response } from "express"
import prisma from "../utils/prisma"
import { ApiError } from "../utils/api-error"
import { logger } from "../utils/logger"

// Create a new analytics dashboard
export const createDashboard = async (req: Request, res: Response) => {
  try {
    const { name, description, layout, reports } = req.body
    const tenantId = req.headers["x-tenant-id"] as string
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "User ID is required")
    }

    // Verify that all reports exist and belong to the tenant
    if (reports && reports.length > 0) {
      const existingReports = await prisma.analyticsReport.findMany({
        where: {
          id: { in: reports },
          tenantId,
        },
      })

      if (existingReports.length !== reports.length) {
        throw new ApiError(400, "One or more reports do not exist or do not belong to this tenant")
      }
    }

    const dashboard = await prisma.analyticsDashboard.create({
      data: {
        name,
        description,
        layout,
        reports,
        tenantId,
        createdBy: userId,
      },
    })

    res.status(201).json({
      status: "success",
      data: dashboard,
    })
  } catch (error) {
    logger.error("Error creating analytics dashboard:", error)
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(500, "Failed to create analytics dashboard")
  }
}

// Get all dashboards for the tenant
export const getDashboards = async (req: Request, res: Response) => {
  try {
    const tenantId = req.headers["x-tenant-id"] as string

    const dashboards = await prisma.analyticsDashboard.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    })

    res.status(200).json({
      status: "success",
      data: dashboards,
    })
  } catch (error) {
    logger.error("Error fetching analytics dashboards:", error)
    throw new ApiError(500, "Failed to fetch analytics dashboards")
  }
}

// Get a specific dashboard by ID
export const getDashboardById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    const dashboard = await prisma.analyticsDashboard.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!dashboard) {
      throw new ApiError(404, "Analytics dashboard not found")
    }

    res.status(200).json({
      status: "success",
      data: dashboard,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error fetching analytics dashboard:", error)
    throw new ApiError(500, "Failed to fetch analytics dashboard")
  }
}

// Update a dashboard
export const updateDashboard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, description, layout, reports } = req.body
    const tenantId = req.headers["x-tenant-id"] as string

    // Check if dashboard exists and belongs to tenant
    const existingDashboard = await prisma.analyticsDashboard.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!existingDashboard) {
      throw new ApiError(404, "Analytics dashboard not found")
    }

    // Verify that all reports exist and belong to the tenant
    if (reports && reports.length > 0) {
      const existingReports = await prisma.analyticsReport.findMany({
        where: {
          id: { in: reports },
          tenantId,
        },
      })

      if (existingReports.length !== reports.length) {
        throw new ApiError(400, "One or more reports do not exist or do not belong to this tenant")
      }
    }

    // Update the dashboard
    const updatedDashboard = await prisma.analyticsDashboard.update({
      where: { id },
      data: {
        name,
        description,
        layout,
        reports,
      },
    })

    res.status(200).json({
      status: "success",
      data: updatedDashboard,
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error updating analytics dashboard:", error)
    throw new ApiError(500, "Failed to update analytics dashboard")
  }
}

// Delete a dashboard
export const deleteDashboard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const tenantId = req.headers["x-tenant-id"] as string

    // Check if dashboard exists and belongs to tenant
    const dashboard = await prisma.analyticsDashboard.findFirst({
      where: {
        id,
        tenantId,
      },
    })

    if (!dashboard) {
      throw new ApiError(404, "Analytics dashboard not found")
    }

    // Delete the dashboard
    await prisma.analyticsDashboard.delete({
      where: { id },
    })

    res.status(200).json({
      status: "success",
      message: "Analytics dashboard deleted successfully",
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    logger.error("Error deleting analytics dashboard:", error)
    throw new ApiError(500, "Failed to delete analytics dashboard")
  }
}
