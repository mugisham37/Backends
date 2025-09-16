import type { NextFunction, Request, Response } from "express";
import { auditService } from "./audit.service";
import { parsePaginationParams } from "../utils/helpers";

export class AuditController {
  /**
   * Get audit logs
   */
  public getAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query);

      // Build filter
      const filter: any = {};
      if (req.query.action) filter.action = req.query.action as string;
      if (req.query.entityType)
        filter.entityType = req.query.entityType as string;
      if (req.query.entityId) filter.entityId = req.query.entityId as string;
      if (req.query.userId) filter.userId = req.query.userId as string;
      if (req.query.userEmail) filter.userEmail = req.query.userEmail as string;

      // Handle date range
      if (req.query.startDate)
        filter.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate)
        filter.endDate = new Date(req.query.endDate as string);

      // Get audit logs
      const result = await auditService.getAuditLogs(filter, { page, limit });

      res.status(200).json({
        status: "success",
        data: {
          logs: result.logs,
          pagination: {
            page: result.page,
            limit,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get entity audit logs
   */
  public getEntityAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { entityType, entityId } = req.params;
      const { page, limit } = parsePaginationParams(req.query);

      const result = await auditService.getEntityAuditLogs(
        entityType,
        entityId,
        { page, limit }
      );

      res.status(200).json({
        status: "success",
        data: {
          logs: result.logs,
          pagination: {
            page: result.page,
            limit,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get user audit logs
   */
  public getUserAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { userId } = req.params;
      const { page, limit } = parsePaginationParams(req.query);

      const result = await auditService.getUserAuditLogs(userId, {
        page,
        limit,
      });

      res.status(200).json({
        status: "success",
        data: {
          logs: result.logs,
          pagination: {
            page: result.page,
            limit,
            totalPages: result.totalPages,
            totalCount: result.totalCount,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get recent audit logs
   */
  public getRecentAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const limit = req.query.limit
        ? Number.parseInt(req.query.limit as string, 10)
        : 20;

      const logs = await auditService.getRecentAuditLogs(limit);

      res.status(200).json({
        status: "success",
        data: {
          logs,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete old audit logs
   */
  public deleteOldAuditLogs = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { olderThan } = req.body;

      if (!olderThan) {
        return res.status(400).json({
          status: "error",
          message: "olderThan date is required",
        });
      }

      const date = new Date(olderThan);
      const deletedCount = await auditService.deleteOldAuditLogs(date);

      res.status(200).json({
        status: "success",
        data: {
          deletedCount,
          message: `Deleted ${deletedCount} audit logs older than ${date.toISOString()}`,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
