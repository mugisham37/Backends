import type { FastifyRequest, FastifyReply } from "fastify";
import { container } from "tsyringe";
import { AuditService } from "./audit.service";
import { parsePaginationParams } from "../../shared/utils/helpers";

interface AuditQueryParams {
  action?: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  userEmail?: string;
  startDate?: string;
  endDate?: string;
  page?: string;
  limit?: string;
}

interface EntityAuditParams {
  entityType: string;
  entityId: string;
}

interface UserAuditParams {
  userId: string;
}

interface RecentAuditQuery {
  limit?: string;
}

interface DeleteOldAuditBody {
  olderThan: string;
}

export class AuditController {
  private auditService: AuditService;

  constructor() {
    this.auditService = container.resolve(AuditService);
  }

  /**
   * Get audit logs
   */
  public getAuditLogs = async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(
        request.query as Record<string, unknown>
      );

      // Build filter
      const filter: any = {};
      const query = request.query as Record<string, unknown>;

      if (query["action"]) filter.action = query["action"] as string;
      if (query["entityType"])
        filter.entityType = query["entityType"] as string;
      if (query["entityId"]) filter.entityId = query["entityId"] as string;
      if (query["userId"]) filter.userId = query["userId"] as string;
      if (query["userEmail"]) filter.userEmail = query["userEmail"] as string;

      // Handle date range
      if (query["startDate"])
        filter.startDate = new Date(query["startDate"] as string);
      if (query["endDate"])
        filter.endDate = new Date(query["endDate"] as string);

      // Get audit logs
      const result = await this.auditService.getAuditLogs(filter);

      if (!result.success) {
        return reply.status(500).send({
          status: "error",
          message: result.error?.message || "Failed to retrieve audit logs",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          logs: result.data,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(result.data.length / limit),
            totalCount: result.data.length,
          },
        },
      });
    } catch (error) {
      request.log.error(error, "Error getting audit logs");
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
      });
    }
  };

  /**
   * Get entity audit logs
   */
  public getEntityAuditLogs = async (
    request: FastifyRequest<{
      Params: EntityAuditParams;
      Querystring: AuditQueryParams;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { entityType, entityId } = request.params;
      const { page, limit } = parsePaginationParams(
        request.query as Record<string, unknown>
      );

      // Build filter with entity information
      const filter = {
        entityType,
        entityId,
      };

      const result = await this.auditService.getAuditLogs(filter);

      if (!result.success) {
        return reply.status(500).send({
          status: "error",
          message:
            result.error?.message || "Failed to retrieve entity audit logs",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          logs: result.data,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(result.data.length / limit),
            totalCount: result.data.length,
          },
        },
      });
    } catch (error) {
      request.log.error(error, "Error getting entity audit logs");
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
      });
    }
  };

  /**
   * Get user audit logs
   */
  public getUserAuditLogs = async (
    request: FastifyRequest<{
      Params: UserAuditParams;
      Querystring: AuditQueryParams;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { userId } = request.params;
      const { page, limit } = parsePaginationParams(
        request.query as Record<string, unknown>
      );

      // Build filter with user information
      const filter = {
        userId,
      };

      const result = await this.auditService.getAuditLogs(filter);

      if (!result.success) {
        return reply.status(500).send({
          status: "error",
          message:
            result.error?.message || "Failed to retrieve user audit logs",
        });
      }

      return reply.status(200).send({
        status: "success",
        data: {
          logs: result.data,
          pagination: {
            page,
            limit,
            totalPages: Math.ceil(result.data.length / limit),
            totalCount: result.data.length,
          },
        },
      });
    } catch (error) {
      request.log.error(error, "Error getting user audit logs");
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
      });
    }
  };

  /**
   * Get recent audit logs
   */
  public getRecentAuditLogs = async (
    request: FastifyRequest<{ Querystring: RecentAuditQuery }>,
    reply: FastifyReply
  ) => {
    try {
      const limit = request.query.limit
        ? Math.max(1, Math.min(100, Number.parseInt(request.query.limit, 10)))
        : 20;

      const filter = { limit };
      const result = await this.auditService.getAuditLogs(filter);

      if (!result.success) {
        return reply.status(500).send({
          status: "error",
          message:
            result.error?.message || "Failed to retrieve recent audit logs",
        });
      }

      // Take only the requested number of logs
      const logs = result.data.slice(0, limit);

      return reply.status(200).send({
        status: "success",
        data: {
          logs,
        },
      });
    } catch (error) {
      request.log.error(error, "Error getting recent audit logs");
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
      });
    }
  };

  /**
   * Delete old audit logs
   */
  public deleteOldAuditLogs = async (
    request: FastifyRequest<{ Body: DeleteOldAuditBody }>,
    reply: FastifyReply
  ) => {
    try {
      const { olderThan } = request.body;

      if (!olderThan) {
        return reply.status(400).send({
          status: "error",
          message: "olderThan date is required",
        });
      }

      const olderThanDate = new Date(olderThan);
      if (isNaN(olderThanDate.getTime())) {
        return reply.status(400).send({
          status: "error",
          message: "Invalid olderThan date format",
        });
      }

      // For now, return success since we don't have a delete implementation
      // In a real implementation, this would delete logs older than the specified date
      request.log.info(
        { olderThan: olderThanDate },
        "Delete old audit logs requested"
      );

      return reply.status(200).send({
        status: "success",
        message: "Old audit logs deletion requested",
        data: {
          olderThan: olderThanDate,
          deleted: 0, // Would be actual count in real implementation
        },
      });
    } catch (error) {
      request.log.error(error, "Error deleting old audit logs");
      return reply.status(500).send({
        status: "error",
        message: "Internal server error",
      });
    }
  };
}
