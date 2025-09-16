import type { Request, Response, NextFunction } from "express";
import fs from "fs";
import path from "path";
import { asyncHandler } from "../utils/async-handler";
import { ApiError } from "../utils/api-error";
import { createRequestLogger } from "../config/logger";
import {
  ExportFormat,
  exportOrders,
  exportProducts,
  exportCustomers,
  exportSales,
  exportInventory,
} from "../services/export.service";

/**
 * Export orders
 * @route GET /api/v1/export/orders
 * @access Protected (Admin)
 */
export const exportOrdersController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const format = (req.query.format as ExportFormat) || ExportFormat.CSV;

    // Validate format
    if (!Object.values(ExportFormat).includes(format)) {
      return next(new ApiError(`Invalid export format: ${format}`, 400));
    }

    // Extract filters from query params
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      status: req.query.status,
      isPaid: req.query.isPaid,
    };

    // Export orders
    const filePath = await exportOrders(format, filters, req.id);
    const fileName = path.basename(filePath);

    requestLogger.info(`Sending exported orders file: ${fileName}`);

    // Set appropriate content type
    let contentType = "text/csv";
    switch (format) {
      case ExportFormat.EXCEL:
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case ExportFormat.PDF:
        contentType = "application/pdf";
        break;
      case ExportFormat.JSON:
        contentType = "application/json";
        break;
    }

    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
);

/**
 * Export products
 * @route GET /api/v1/export/products
 * @access Protected (Admin)
 */
export const exportProductsController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const format = (req.query.format as ExportFormat) || ExportFormat.CSV;

    // Validate format
    if (!Object.values(ExportFormat).includes(format)) {
      return next(new ApiError(`Invalid export format: ${format}`, 400));
    }

    // Extract filters from query params
    const filters = {
      category: req.query.category,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      inStock: req.query.inStock,
      featured: req.query.featured,
      active: req.query.active,
    };

    // Export products
    const filePath = await exportProducts(format, filters, req.id);
    const fileName = path.basename(filePath);

    requestLogger.info(`Sending exported products file: ${fileName}`);

    // Set appropriate content type
    let contentType = "text/csv";
    switch (format) {
      case ExportFormat.EXCEL:
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case ExportFormat.PDF:
        contentType = "application/pdf";
        break;
      case ExportFormat.JSON:
        contentType = "application/json";
        break;
    }

    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
);

/**
 * Export customers
 * @route GET /api/v1/export/customers
 * @access Protected (Admin)
 */
export const exportCustomersController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const format = (req.query.format as ExportFormat) || ExportFormat.CSV;

    // Validate format
    if (!Object.values(ExportFormat).includes(format)) {
      return next(new ApiError(`Invalid export format: ${format}`, 400));
    }

    // Extract filters from query params
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      active: req.query.active,
    };

    // Export customers
    const filePath = await exportCustomers(format, filters, req.id);
    const fileName = path.basename(filePath);

    requestLogger.info(`Sending exported customers file: ${fileName}`);

    // Set appropriate content type
    let contentType = "text/csv";
    switch (format) {
      case ExportFormat.EXCEL:
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case ExportFormat.PDF:
        contentType = "application/pdf";
        break;
      case ExportFormat.JSON:
        contentType = "application/json";
        break;
    }

    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
);

/**
 * Export sales
 * @route GET /api/v1/export/sales
 * @access Protected (Admin)
 */
export const exportSalesController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const format = (req.query.format as ExportFormat) || ExportFormat.CSV;

    // Validate format
    if (!Object.values(ExportFormat).includes(format)) {
      return next(new ApiError(`Invalid export format: ${format}`, 400));
    }

    // Extract filters from query params
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      interval: req.query.interval,
    };

    // Export sales
    const filePath = await exportSales(format, filters, req.id);
    const fileName = path.basename(filePath);

    requestLogger.info(`Sending exported sales file: ${fileName}`);

    // Set appropriate content type
    let contentType = "text/csv";
    switch (format) {
      case ExportFormat.EXCEL:
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case ExportFormat.PDF:
        contentType = "application/pdf";
        break;
      case ExportFormat.JSON:
        contentType = "application/json";
        break;
    }

    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
);

/**
 * Export inventory
 * @route GET /api/v1/export/inventory
 * @access Protected (Admin)
 */
export const exportInventoryController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const requestLogger = createRequestLogger(req.id);
    const format = (req.query.format as ExportFormat) || ExportFormat.CSV;

    // Validate format
    if (!Object.values(ExportFormat).includes(format)) {
      return next(new ApiError(`Invalid export format: ${format}`, 400));
    }

    // Extract filters from query params
    const filters = {
      category: req.query.category,
      minQuantity: req.query.minQuantity,
      maxQuantity: req.query.maxQuantity,
      inStock: req.query.inStock,
      includeVariants: req.query.includeVariants,
    };

    // Export inventory
    const filePath = await exportInventory(format, filters, req.id);
    const fileName = path.basename(filePath);

    requestLogger.info(`Sending exported inventory file: ${fileName}`);

    // Set appropriate content type
    let contentType = "text/csv";
    switch (format) {
      case ExportFormat.EXCEL:
        contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        break;
      case ExportFormat.PDF:
        contentType = "application/pdf";
        break;
      case ExportFormat.JSON:
        contentType = "application/json";
        break;
    }

    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  }
);
