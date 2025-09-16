import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { createRequestLogger } from "../config/logger";
import Order from "../models/order.model";
import Product from "../models/product.model";
import User from "../models/user.model";
import { ApiError } from "../utils/api-error";

// Define export types
export enum ExportFormat {
  CSV = "csv",
  EXCEL = "excel",
  PDF = "pdf",
  JSON = "json",
}

// Define export data types
export enum ExportDataType {
  ORDERS = "orders",
  PRODUCTS = "products",
  CUSTOMERS = "customers",
  SALES = "sales",
  INVENTORY = "inventory",
  LOYALTY_POINTS = "loyalty_points",
  LOYALTY_REDEMPTIONS = "loyalty_redemptions",
  LOYALTY_TIERS = "loyalty_tiers",
  LOYALTY_REFERRALS = "loyalty_referrals",
}

/**
 * Generate a unique filename for exports
 * @param dataType Type of data being exported
 * @param format Export format
 * @returns Unique filename
 */
const generateFilename = (dataType: ExportDataType, format: ExportFormat): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${dataType}-export-${timestamp}.${format}`;
};

/**
 * Create export directory if it doesn't exist
 * @returns Path to export directory
 */
const ensureExportDirectory = (): string => {
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  return exportDir;
};

/**
 * Export data to CSV format
 * @param data Data to export
 * @param fields Fields to include in CSV
 * @param dataType Type of data being exported
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportToCsv = async (
  data: any[],
  fields: string[],
  dataType: ExportDataType,
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting ${dataType} to CSV format`);

  try {
    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    const exportDir = ensureExportDirectory();
    const filename = generateFilename(dataType, ExportFormat.CSV);
    const filePath = path.join(exportDir, filename);

    fs.writeFileSync(filePath, csv);
    logger.info(`CSV export completed: ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error(`Error exporting to CSV: ${error.message}`);
    throw new ApiError(`Failed to export data to CSV: ${error.message}`, 500);
  }
};

/**
 * Export data to Excel format
 * @param data Data to export
 * @param fields Fields to include in Excel
 * @param dataType Type of data being exported
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportToExcel = async (
  data: any[],
  fields: string[],
  dataType: ExportDataType,
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting ${dataType} to Excel format`);

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(dataType);

    // Add header row
    worksheet.addRow(fields.map((field) => field.charAt(0).toUpperCase() + field.slice(1)));

    // Add data rows
    data.forEach((item) => {
      const row = fields.map((field) => {
        const value = field
          .split(".")
          .reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), item);
        return value !== null && value !== undefined ? value : "";
      });
      worksheet.addRow(row);
    });

    // Format header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Auto-fit columns
    worksheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell({ includeEmpty: true }, (cell) => {
        const columnLength = cell.value ? cell.value.toString().length : 10;
        if (columnLength > maxLength) {
          maxLength = columnLength;
        }
      });
      column.width = maxLength < 10 ? 10 : maxLength + 2;
    });

    const exportDir = ensureExportDirectory();
    const filename = generateFilename(dataType, ExportFormat.EXCEL);
    const filePath = path.join(exportDir, filename);

    await workbook.xlsx.writeFile(filePath);
    logger.info(`Excel export completed: ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error(`Error exporting to Excel: ${error.message}`);
    throw new ApiError(`Failed to export data to Excel: ${error.message}`, 500);
  }
};

/**
 * Export data to PDF format
 * @param data Data to export
 * @param fields Fields to include in PDF
 * @param dataType Type of data being exported
 * @param title Title for the PDF
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportToPdf = async (
  data: any[],
  fields: string[],
  dataType: ExportDataType,
  title: string,
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting ${dataType} to PDF format`);

  try {
    const exportDir = ensureExportDirectory();
    const filename = generateFilename(dataType, ExportFormat.PDF);
    const filePath = path.join(exportDir, filename);

    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);

    doc.pipe(stream);

    // Add title
    doc.fontSize(20).text(title, { align: "center" });
    doc.moveDown();

    // Add timestamp
    doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: "center" });
    doc.moveDown(2);

    // Define table layout
    const tableTop = 150;
    const tableLeft = 50;
    const cellPadding = 5;
    const columnWidths: number[] = [];
    const maxWidth = 500;

    // Calculate column widths
    const totalColumns = fields.length;
    const equalWidth = Math.floor(maxWidth / totalColumns);
    fields.forEach(() => columnWidths.push(equalWidth));

    // Draw table header
    doc.fontSize(12);
    let currentLeft = tableLeft;
    fields.forEach((field, i) => {
      doc
        .rect(currentLeft, tableTop, columnWidths[i], 30)
        .fillAndStroke("#e0e0e0", "#000000")
        .fillColor("#000000")
        .text(
          field.charAt(0).toUpperCase() + field.slice(1),
          currentLeft + cellPadding,
          tableTop + cellPadding
        );
      currentLeft += columnWidths[i];
    });

    // Draw table rows
    let currentTop = tableTop + 30;
    data.forEach((item, rowIndex) => {
      currentLeft = tableLeft;
      fields.forEach((field, colIndex) => {
        const value = field
          .split(".")
          .reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : null), item);
        const displayValue = value !== null && value !== undefined ? value.toString() : "";

        doc
          .rect(currentLeft, currentTop, columnWidths[colIndex], 25)
          .fillAndStroke(rowIndex % 2 === 0 ? "#ffffff" : "#f9f9f9", "#000000")
          .fillColor("#000000")
          .text(displayValue, currentLeft + cellPadding, currentTop + cellPadding, {
            width: columnWidths[colIndex] - cellPadding * 2,
            height: 25 - cellPadding * 2,
          });
        currentLeft += columnWidths[colIndex];
      });
      currentTop += 25;

      // Add a new page if we're near the bottom
      if (currentTop > doc.page.height - 100) {
        doc.addPage();
        currentTop = 50;
      }
    });

    // Add footer
    doc.fontSize(10).text(`Total Records: ${data.length}`, { align: "right" });

    doc.end();

    // Wait for the stream to finish
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });

    logger.info(`PDF export completed: ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error(`Error exporting to PDF: ${error.message}`);
    throw new ApiError(`Failed to export data to PDF: ${error.message}`, 500);
  }
};

/**
 * Export data to JSON format
 * @param data Data to export
 * @param dataType Type of data being exported
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportToJson = async (
  data: any[],
  dataType: ExportDataType,
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting ${dataType} to JSON format`);

  try {
    const exportDir = ensureExportDirectory();
    const filename = generateFilename(dataType, ExportFormat.JSON);
    const filePath = path.join(exportDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    logger.info(`JSON export completed: ${filePath}`);

    return filePath;
  } catch (error) {
    logger.error(`Error exporting to JSON: ${error.message}`);
    throw new ApiError(`Failed to export data to JSON: ${error.message}`, 500);
  }
};

/**
 * Export orders data
 * @param format Export format
 * @param filters Filters to apply to the data
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportOrders = async (
  format: ExportFormat,
  filters: Record<string, any> = {},
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting orders with format: ${format}`);

  try {
    // Build query from filters
    const query: Record<string, any> = {};

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.isPaid !== undefined) {
      query.isPaid = filters.isPaid === "true";
    }

    // Get orders
    const orders = await Order.find(query)
      .populate("user", "email firstName lastName")
      .sort("-createdAt")
      .lean();

    // Format data for export
    const formattedOrders = orders.map((order) => ({
      id: order._id.toString(),
      orderNumber: order._id
        .toString()
        .substring(order._id.toString().length - 8)
        .toUpperCase(),
      customerName: order.user ? `${order.user.firstName} ${order.user.lastName}` : "N/A",
      customerEmail: order.user ? order.user.email : "N/A",
      status: order.status,
      totalPrice: order.totalPrice,
      itemsPrice: order.itemsPrice,
      taxPrice: order.taxPrice,
      shippingPrice: order.shippingPrice,
      isPaid: order.isPaid ? "Yes" : "No",
      paidAt: order.paidAt ? new Date(order.paidAt).toLocaleString() : "N/A",
      isDelivered: order.isDelivered ? "Yes" : "No",
      deliveredAt: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : "N/A",
      shippingAddress: `${order.shippingAddress.street}, ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}, ${order.shippingAddress.country}`,
      paymentMethod: order.paymentMethod,
      createdAt: new Date(order.createdAt).toLocaleString(),
      itemCount: order.orderItems.length,
    }));

    // Define fields to export
    const fields = [
      "id",
      "orderNumber",
      "customerName",
      "customerEmail",
      "status",
      "totalPrice",
      "isPaid",
      "paidAt",
      "isDelivered",
      "deliveredAt",
      "shippingAddress",
      "paymentMethod",
      "createdAt",
      "itemCount",
    ];

    // Export based on format
    switch (format) {
      case ExportFormat.CSV:
        return exportToCsv(formattedOrders, fields, ExportDataType.ORDERS, requestId);
      case ExportFormat.EXCEL:
        return exportToExcel(formattedOrders, fields, ExportDataType.ORDERS, requestId);
      case ExportFormat.PDF:
        return exportToPdf(
          formattedOrders,
          fields,
          ExportDataType.ORDERS,
          "Orders Report",
          requestId
        );
      case ExportFormat.JSON:
        return exportToJson(formattedOrders, ExportDataType.ORDERS, requestId);
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error exporting orders: ${error.message}`);
    throw error;
  }
};

/**
 * Export products data
 * @param format Export format
 * @param filters Filters to apply to the data
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportProducts = async (
  format: ExportFormat,
  filters: Record<string, any> = {},
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting products with format: ${format}`);

  try {
    // Build query from filters
    const query: Record<string, any> = {};

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.minPrice && filters.maxPrice) {
      query.price = {
        $gte: Number(filters.minPrice),
        $lte: Number(filters.maxPrice),
      };
    } else if (filters.minPrice) {
      query.price = { $gte: Number(filters.minPrice) };
    } else if (filters.maxPrice) {
      query.price = { $lte: Number(filters.maxPrice) };
    }

    if (filters.inStock !== undefined) {
      query.quantity = filters.inStock === "true" ? { $gt: 0 } : { $lte: 0 };
    }

    if (filters.featured !== undefined) {
      query.featured = filters.featured === "true";
    }

    if (filters.active !== undefined) {
      query.active = filters.active === "true";
    }

    // Get products
    const products = await Product.find(query).populate("category", "name").sort("name").lean();

    // Format data for export
    const formattedProducts = products.map((product) => ({
      id: product._id.toString(),
      name: product.name,
      category: product.category ? product.category.name : "N/A",
      price: product.price,
      compareAtPrice: product.compareAtPrice || "N/A",
      quantity: product.quantity,
      inStock: product.quantity > 0 ? "Yes" : "No",
      featured: product.featured ? "Yes" : "No",
      active: product.active ? "Yes" : "No",
      ratings: product.ratings.average,
      reviewCount: product.ratings.count,
      createdAt: new Date(product.createdAt).toLocaleString(),
      variantCount: product.variants.length,
    }));

    // Define fields to export
    const fields = [
      "id",
      "name",
      "category",
      "price",
      "compareAtPrice",
      "quantity",
      "inStock",
      "featured",
      "active",
      "ratings",
      "reviewCount",
      "createdAt",
      "variantCount",
    ];

    // Export based on format
    switch (format) {
      case ExportFormat.CSV:
        return exportToCsv(formattedProducts, fields, ExportDataType.PRODUCTS, requestId);
      case ExportFormat.EXCEL:
        return exportToExcel(formattedProducts, fields, ExportDataType.PRODUCTS, requestId);
      case ExportFormat.PDF:
        return exportToPdf(
          formattedProducts,
          fields,
          ExportDataType.PRODUCTS,
          "Products Report",
          requestId
        );
      case ExportFormat.JSON:
        return exportToJson(formattedProducts, ExportDataType.PRODUCTS, requestId);
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error exporting products: ${error.message}`);
    throw error;
  }
};

/**
 * Export customers data
 * @param format Export format
 * @param filters Filters to apply to the data
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportCustomers = async (
  format: ExportFormat,
  filters: Record<string, any> = {},
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting customers with format: ${format}`);

  try {
    // Build query from filters
    const query: Record<string, any> = { role: "customer" };

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    if (filters.active !== undefined) {
      query.active = filters.active === "true";
    }

    // Get customers
    const customers = await User.find(query).sort("lastName firstName").lean();

    // Get order counts for each customer
    const customerIds = customers.map((customer) => customer._id);
    const orderCounts = await Order.aggregate([
      { $match: { user: { $in: customerIds } } },
      { $group: { _id: "$user", count: { $sum: 1 }, totalSpent: { $sum: "$totalPrice" } } },
    ]);

    // Create a map of customer ID to order count and total spent
    const customerOrderMap = new Map();
    orderCounts.forEach((item) => {
      customerOrderMap.set(item._id.toString(), {
        orderCount: item.count,
        totalSpent: item.totalSpent,
      });
    });

    // Format data for export
    const formattedCustomers = customers.map((customer) => {
      const orderData = customerOrderMap.get(customer._id.toString()) || {
        orderCount: 0,
        totalSpent: 0,
      };
      return {
        id: customer._id.toString(),
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        fullName: `${customer.firstName} ${customer.lastName}`,
        orderCount: orderData.orderCount,
        totalSpent: orderData.totalSpent.toFixed(2),
        averageOrderValue:
          orderData.orderCount > 0
            ? (orderData.totalSpent / orderData.orderCount).toFixed(2)
            : "0.00",
        createdAt: new Date(customer.createdAt).toLocaleString(),
        addressCount: customer.addresses ? customer.addresses.length : 0,
        paymentMethodCount: customer.paymentMethods ? customer.paymentMethods.length : 0,
      };
    });

    // Define fields to export
    const fields = [
      "id",
      "email",
      "fullName",
      "firstName",
      "lastName",
      "orderCount",
      "totalSpent",
      "averageOrderValue",
      "createdAt",
      "addressCount",
      "paymentMethodCount",
    ];

    // Export based on format
    switch (format) {
      case ExportFormat.CSV:
        return exportToCsv(formattedCustomers, fields, ExportDataType.CUSTOMERS, requestId);
      case ExportFormat.EXCEL:
        return exportToExcel(formattedCustomers, fields, ExportDataType.CUSTOMERS, requestId);
      case ExportFormat.PDF:
        return exportToPdf(
          formattedCustomers,
          fields,
          ExportDataType.CUSTOMERS,
          "Customers Report",
          requestId
        );
      case ExportFormat.JSON:
        return exportToJson(formattedCustomers, ExportDataType.CUSTOMERS, requestId);
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error exporting customers: ${error.message}`);
    throw error;
  }
};

/**
 * Export sales data
 * @param format Export format
 * @param filters Filters to apply to the data
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportSales = async (
  format: ExportFormat,
  filters: Record<string, any> = {},
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting sales with format: ${format}`);

  try {
    // Get date range from filters
    const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
    const startDate = filters.startDate
      ? new Date(filters.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Get interval from filters
    const interval = filters.interval || "daily";

    // Define group by date format based on interval
    let dateFormat;
    if (interval === "hourly") {
      dateFormat = { year: "$year", month: "$month", day: "$day", hour: "$hour" };
    } else if (interval === "daily") {
      dateFormat = { year: "$year", month: "$month", day: "$day" };
    } else if (interval === "weekly") {
      dateFormat = { year: "$year", week: "$week" };
    } else if (interval === "monthly") {
      dateFormat = { year: "$year", month: "$month" };
    } else {
      dateFormat = { year: "$year", month: "$month", day: "$day" }; // Default to daily
    }

    // Get sales data
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      {
        $addFields: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
          day: { $dayOfMonth: "$createdAt" },
          hour: { $hour: "$createdAt" },
          week: { $week: "$createdAt" },
        },
      },
      {
        $group: {
          _id: dateFormat,
          sales: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
          avgOrderValue: { $avg: "$totalPrice" },
          itemsSold: { $sum: { $size: "$orderItems" } },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: { $ifNull: ["$_id.month", 1] },
              day: { $ifNull: ["$_id.day", 1] },
              hour: { $ifNull: ["$_id.hour", 0] },
            },
          },
        },
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d %H:%M", date: "$date" } },
          sales: 1,
          orders: 1,
          avgOrderValue: 1,
          itemsSold: 1,
        },
      },
    ]);

    // Format data for export
    const formattedSales = salesData.map((item) => ({
      date: item.date,
      sales: item.sales.toFixed(2),
      orders: item.orders,
      avgOrderValue: item.avgOrderValue.toFixed(2),
      itemsSold: item.itemsSold,
    }));

    // Define fields to export
    const fields = ["date", "sales", "orders", "avgOrderValue", "itemsSold"];

    // Export based on format
    switch (format) {
      case ExportFormat.CSV:
        return exportToCsv(formattedSales, fields, ExportDataType.SALES, requestId);
      case ExportFormat.EXCEL:
        return exportToExcel(formattedSales, fields, ExportDataType.SALES, requestId);
      case ExportFormat.PDF:
        return exportToPdf(formattedSales, fields, ExportDataType.SALES, "Sales Report", requestId);
      case ExportFormat.JSON:
        return exportToJson(formattedSales, ExportDataType.SALES, requestId);
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error exporting sales: ${error.message}`);
    throw error;
  }
};

/**
 * Export inventory data
 * @param format Export format
 * @param filters Filters to apply to the data
 * @param requestId Request ID for logging
 * @returns Path to exported file
 */
export const exportInventory = async (
  format: ExportFormat,
  filters: Record<string, any> = {},
  requestId?: string
): Promise<string> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Exporting inventory with format: ${format}`);

  try {
    // Build query from filters
    const query: Record<string, any> = {};

    if (filters.category) {
      query.category = filters.category;
    }

    if (filters.minQuantity !== undefined) {
      query.quantity = { $gte: Number(filters.minQuantity) };
    }

    if (filters.maxQuantity !== undefined) {
      query.quantity = { ...query.quantity, $lte: Number(filters.maxQuantity) };
    }

    if (filters.inStock !== undefined) {
      query.quantity = filters.inStock === "true" ? { $gt: 0 } : { $lte: 0 };
    }

    // Get products
    const products = await Product.find(query).populate("category", "name").sort("quantity").lean();

    // Format data for export
    const formattedInventory = products.map((product) => {
      // Calculate total variant quantity
      const variantQuantity = product.variants.reduce(
        (total, variant) => total + variant.quantity,
        0
      );
      const totalQuantity = product.quantity + variantQuantity;

      return {
        id: product._id.toString(),
        sku: product.variants.length > 0 ? "Multiple SKUs" : "N/A",
        name: product.name,
        category: product.category ? product.category.name : "N/A",
        mainQuantity: product.quantity,
        variantQuantity,
        totalQuantity,
        status:
          totalQuantity <= 0
            ? "Out of Stock"
            : totalQuantity <= 5
              ? "Low Stock"
              : totalQuantity <= 20
                ? "Medium Stock"
                : "Good Stock",
        variantCount: product.variants.length,
        lastUpdated: new Date(product.updatedAt).toLocaleString(),
      };
    });

    // Add variant details if requested
    if (filters.includeVariants === "true") {
      const variantDetails: any[] = [];
      products.forEach((product) => {
        if (product.variants.length > 0) {
          product.variants.forEach((variant) => {
            variantDetails.push({
              productId: product._id.toString(),
              productName: product.name,
              sku: variant.sku,
              attributes: variant.attributes
                .map((attr) => `${attr.name}: ${attr.value}`)
                .join(", "),
              quantity: variant.quantity,
              price: variant.price,
              status:
                variant.quantity <= 0
                  ? "Out of Stock"
                  : variant.quantity <= 5
                    ? "Low Stock"
                    : variant.quantity <= 20
                      ? "Medium Stock"
                      : "Good Stock",
            });
          });
        }
      });

      // If we have variant details, export those instead
      if (variantDetails.length > 0) {
        const variantFields = [
          "productId",
          "productName",
          "sku",
          "attributes",
          "quantity",
          "price",
          "status",
        ];

        // Export based on format
        switch (format) {
          case ExportFormat.CSV:
            return exportToCsv(variantDetails, variantFields, ExportDataType.INVENTORY, requestId);
          case ExportFormat.EXCEL:
            return exportToExcel(
              variantDetails,
              variantFields,
              ExportDataType.INVENTORY,
              requestId
            );
          case ExportFormat.PDF:
            return exportToPdf(
              variantDetails,
              variantFields,
              ExportDataType.INVENTORY,
              "Inventory Variants Report",
              requestId
            );
          case ExportFormat.JSON:
            return exportToJson(variantDetails, ExportDataType.INVENTORY, requestId);
          default:
            throw new ApiError(`Unsupported export format: ${format}`, 400);
        }
      }
    }

    // Define fields to export
    const fields = [
      "id",
      "name",
      "category",
      "mainQuantity",
      "variantQuantity",
      "totalQuantity",
      "status",
      "variantCount",
      "lastUpdated",
    ];

    // Export based on format
    switch (format) {
      case ExportFormat.CSV:
        return exportToCsv(formattedInventory, fields, ExportDataType.INVENTORY, requestId);
      case ExportFormat.EXCEL:
        return exportToExcel(formattedInventory, fields, ExportDataType.INVENTORY, requestId);
      case ExportFormat.PDF:
        return exportToPdf(
          formattedInventory,
          fields,
          ExportDataType.INVENTORY,
          "Inventory Report",
          requestId
        );
      case ExportFormat.JSON:
        return exportToJson(formattedInventory, ExportDataType.INVENTORY, requestId);
      default:
        throw new ApiError(`Unsupported export format: ${format}`, 400);
    }
  } catch (error) {
    logger.error(`Error exporting inventory: ${error.message}`);
    throw error;
  }
};
