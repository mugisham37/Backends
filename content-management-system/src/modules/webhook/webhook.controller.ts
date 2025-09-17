import type { NextFunction, Request, Response } from "express";
import { WebhookService } from "./webhook.service";
import { parsePaginationParams } from "../../shared/utils/helpers";

export class WebhookController {
  private webhookService: WebhookService;

  constructor() {
    this.webhookService = new WebhookService();
  }

  /**
   * Get all webhooks
   */
  public getAllWebhooks = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      // Parse query parameters
      const { page, limit } = parsePaginationParams(req.query);

      // Build filter
      const filter: any = {};
      if (req.query.search) filter.search = req.query.search as string;
      if (req.query.event) filter.event = req.query.event as string;
      if (req.query.status) filter.status = req.query.status as string;
      if (req.query.contentTypeId)
        filter.contentTypeId = req.query.contentTypeId as string;

      // Get webhooks
      const result = await this.webhookService.getAllWebhooks(filter, {
        page,
        limit,
      });

      res.status(200).json({
        status: "success",
        data: {
          webhooks: result.webhooks,
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
   * Get webhook by ID
   */
  public getWebhookById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const webhook = await this.webhookService.getWebhookById(id);

      res.status(200).json({
        status: "success",
        data: {
          webhook,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create webhook
   */
  public createWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const webhook = await this.webhookService.createWebhook(req.body);

      res.status(201).json({
        status: "success",
        data: {
          webhook,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update webhook
   */
  public updateWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const webhook = await this.webhookService.updateWebhook(id, req.body);

      res.status(200).json({
        status: "success",
        data: {
          webhook,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete webhook
   */
  public deleteWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      await this.webhookService.deleteWebhook(id);

      res.status(200).json({
        status: "success",
        data: null,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get webhook deliveries
   */
  public getWebhookDeliveries = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const limit = req.query.limit
        ? Number.parseInt(req.query.limit as string, 10)
        : 10;
      const deliveries = await this.webhookService.getWebhookDeliveries(
        id,
        limit
      );

      res.status(200).json({
        status: "success",
        data: {
          deliveries,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Test webhook
   */
  public testWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const delivery = await this.webhookService.testWebhook(id);

      res.status(200).json({
        status: "success",
        data: {
          delivery,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Retry webhook delivery
   */
  public retryWebhookDelivery = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { id } = req.params;
      const delivery = await this.webhookService.retryWebhookDelivery(id);

      res.status(200).json({
        status: "success",
        data: {
          delivery,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
