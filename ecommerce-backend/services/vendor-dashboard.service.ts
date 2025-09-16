import mongoose from "mongoose";
import Vendor from "../models/vendor.model";
import Product from "../models/product.model";
import Order from "../models/order.model";
import Payout from "../models/payout.model";
import { createRequestLogger } from "../config/logger";
import { getCache, setCache } from "../config/redis";
import { ApiError } from "../utils/api-error";

// Cache TTL in seconds
const CACHE_TTL = {
  DASHBOARD_SUMMARY: 1800, // 30 minutes
  SALES_ANALYTICS: 3600, // 1 hour
  PRODUCT_ANALYTICS: 3600, // 1 hour
  ORDER_ANALYTICS: 3600, // 1 hour
};

/**
 * Get vendor dashboard summary
 * @param vendorId Vendor ID
 * @param period Period for metrics calculation
 * @param requestId Request ID for logging
 * @returns Vendor dashboard summary
 */
export const getVendorDashboardSummary = async (
  vendorId: string,
  period: "day" | "week" | "month" | "year" | "all" = "month",
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting dashboard summary for vendor ID: ${vendorId} with period: ${period}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Try to get from cache
  const cacheKey = `vendor_dashboard:${vendorId}:${period}`;
  const cachedData = await getCache<any>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved vendor dashboard summary from cache`);
    return cachedData;
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date(0); // Unix epoch

    if (period === "day") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (period === "month") {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === "year") {
      startDate = new Date(now);
      startDate.setFullYear(now.getFullYear() - 1);
    }

    // Get sales summary
    const salesSummary = await getVendorSalesSummary(vendorId, startDate, now, requestId);

    // Get product summary
    const productSummary = await getVendorProductSummary(vendorId, requestId);

    // Get order summary
    const orderSummary = await getVendorOrderSummary(vendorId, startDate, now, requestId);

    // Get payout summary
    const payoutSummary = await getVendorPayoutSummary(vendorId, startDate, now, requestId);

    // Get recent orders
    const recentOrders = await getVendorRecentOrders(vendorId, 5, requestId);

    // Get top products
    const topProducts = await getVendorTopProducts(vendorId, startDate, now, 5, requestId);

    // Get sales trend
    const salesTrend = await getVendorSalesTrend(
      vendorId,
      startDate,
      now,
      period === "day" ? "hourly" : "daily",
      requestId
    );

    // Compile dashboard summary
    const dashboardSummary = {
      salesSummary,
      productSummary,
      orderSummary,
      payoutSummary,
      recentOrders,
      topProducts,
      salesTrend,
      period: {
        type: period,
        startDate,
        endDate: now,
      },
    };

    // Cache the results
    await setCache(cacheKey, dashboardSummary, CACHE_TTL.DASHBOARD_SUMMARY);

    return dashboardSummary;
  } catch (error: any) {
    logger.error(`Error getting vendor dashboard summary: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor sales summary
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Vendor sales summary
 */
async function getVendorSalesSummary(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting sales summary for vendor ID: ${vendorId}`);

  try {
    // Get orders for this vendor
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          totalItems: { $sum: "$orderItems.quantity" },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $round: ["$totalSales", 2] },
          totalItems: 1,
          orderCount: { $size: "$orders" },
        },
      },
    ]);

    // Get previous period sales for comparison
    const previousStartDate = new Date(
      startDate.getTime() - (endDate.getTime() - startDate.getTime())
    );
    const previousEndDate = new Date(startDate);

    const previousSalesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: previousStartDate, $lte: previousEndDate },
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          totalItems: { $sum: "$orderItems.quantity" },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $round: ["$totalSales", 2] },
          totalItems: 1,
          orderCount: { $size: "$orders" },
        },
      },
    ]);

    // Calculate growth percentages
    const currentPeriod =
      salesData.length > 0 ? salesData[0] : { totalSales: 0, totalItems: 0, orderCount: 0 };
    const previousPeriod =
      previousSalesData.length > 0
        ? previousSalesData[0]
        : { totalSales: 0, totalItems: 0, orderCount: 0 };

    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number.parseFloat((((current - previous) / previous) * 100).toFixed(2));
    };

    const growth = {
      salesGrowth: calculateGrowth(currentPeriod.totalSales, previousPeriod.totalSales),
      itemsGrowth: calculateGrowth(currentPeriod.totalItems, previousPeriod.totalItems),
      orderCountGrowth: calculateGrowth(currentPeriod.orderCount, previousPeriod.orderCount),
    };

    // Get vendor commission rate
    const vendor = await Vendor.findById(vendorId).select("commissionRate").lean();
    const commissionRate = vendor?.commissionRate || 0;

    // Calculate commission and net sales
    const commission = (currentPeriod.totalSales * commissionRate) / 100;
    const netSales = currentPeriod.totalSales - commission;

    return {
      ...currentPeriod,
      averageOrderValue:
        currentPeriod.orderCount > 0
          ? Number.parseFloat((currentPeriod.totalSales / currentPeriod.orderCount).toFixed(2))
          : 0,
      commission: Number.parseFloat(commission.toFixed(2)),
      netSales: Number.parseFloat(netSales.toFixed(2)),
      growth,
    };
  } catch (error: any) {
    logger.error(`Error getting vendor sales summary: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor product summary
 * @param vendorId Vendor ID
 * @param requestId Request ID for logging
 * @returns Vendor product summary
 */
async function getVendorProductSummary(vendorId: string, requestId?: string): Promise<any> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting product summary for vendor ID: ${vendorId}`);

  try {
    // Get product counts
    const totalProducts = await Product.countDocuments({ vendor: vendorId });
    const activeProducts = await Product.countDocuments({ vendor: vendorId, active: true });
    const inactiveProducts = await Product.countDocuments({ vendor: vendorId, active: false });
    const lowStockProducts = await Product.countDocuments({
      vendor: vendorId,
      quantity: { $gt: 0, $lte: 5 },
    });
    const outOfStockProducts = await Product.countDocuments({
      vendor: vendorId,
      quantity: { $lte: 0 },
    });

    // Get inventory value
    const inventoryValue = await Product.aggregate([
      { $match: { vendor: new mongoose.Types.ObjectId(vendorId) } },
      {
        $group: {
          _id: null,
          value: { $sum: { $multiply: ["$price", "$quantity"] } },
          items: { $sum: "$quantity" },
        },
      },
      {
        $project: {
          _id: 0,
          value: { $round: ["$value", 2] },
          items: 1,
        },
      },
    ]);

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue: inventoryValue.length > 0 ? inventoryValue[0].value : 0,
      totalItems: inventoryValue.length > 0 ? inventoryValue[0].items : 0,
    };
  } catch (error: any) {
    logger.error(`Error getting vendor product summary: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor order summary
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Vendor order summary
 */
async function getVendorOrderSummary(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting order summary for vendor ID: ${vendorId}`);

  try {
    // Get orders containing vendor's products
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
      "orderItems.vendor": vendorId,
    }).lean();

    // Count orders by status
    const statusCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    // Process orders
    orders.forEach((order) => {
      // Only count if the order has at least one item from this vendor
      const hasVendorItems = order.orderItems.some(
        (item) => item.vendor && item.vendor.toString() === vendorId
      );

      if (hasVendorItems && statusCounts.hasOwnProperty(order.status)) {
        statusCounts[order.status]++;
      }
    });

    // Calculate total orders
    const totalOrders = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

    return {
      totalOrders,
      statusCounts,
    };
  } catch (error: any) {
    logger.error(`Error getting vendor order summary: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor payout summary
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Vendor payout summary
 */
async function getVendorPayoutSummary(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting payout summary for vendor ID: ${vendorId}`);

  try {
    // Get payouts for this vendor
    const payouts = await Payout.find({
      vendor: vendorId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).lean();

    // Calculate payout totals
    let totalPayouts = 0;
    let pendingPayouts = 0;
    let completedPayouts = 0;

    payouts.forEach((payout) => {
      if (payout.status === "completed") {
        completedPayouts += payout.netAmount;
      } else if (payout.status === "pending" || payout.status === "processing") {
        pendingPayouts += payout.netAmount;
      }
      totalPayouts += payout.netAmount;
    });

    // Get sales data for the period
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
          isPaid: true,
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $round: ["$totalSales", 2] },
        },
      },
    ]);

    // Get vendor commission rate
    const vendor = await Vendor.findById(vendorId).select("commissionRate").lean();
    const commissionRate = vendor?.commissionRate || 0;

    // Calculate total sales and available balance
    const totalSales = salesData.length > 0 ? salesData[0].totalSales : 0;
    const commission = (totalSales * commissionRate) / 100;
    const availableBalance = totalSales - commission - totalPayouts;

    return {
      totalPayouts: Number.parseFloat(totalPayouts.toFixed(2)),
      pendingPayouts: Number.parseFloat(pendingPayouts.toFixed(2)),
      completedPayouts: Number.parseFloat(completedPayouts.toFixed(2)),
      totalSales: Number.parseFloat(totalSales.toFixed(2)),
      commission: Number.parseFloat(commission.toFixed(2)),
      availableBalance: Number.parseFloat(availableBalance.toFixed(2)),
      payoutCount: payouts.length,
    };
  } catch (error: any) {
    logger.error(`Error getting vendor payout summary: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor recent orders
 * @param vendorId Vendor ID
 * @param limit Number of orders to return
 * @param requestId Request ID for logging
 * @returns Vendor recent orders
 */
async function getVendorRecentOrders(
  vendorId: string,
  limit: number,
  requestId?: string
): Promise<any[]> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting recent orders for vendor ID: ${vendorId}`);

  try {
    // Get orders containing vendor's products
    const orders = await Order.find({
      "orderItems.vendor": vendorId,
    })
      .sort("-createdAt")
      .limit(limit * 2) // Get more than needed to filter
      .populate("user", "firstName lastName email")
      .lean();

    // Filter orders to only include those with items from this vendor
    const filteredOrders = orders
      .filter((order) =>
        order.orderItems.some((item) => item.vendor && item.vendor.toString() === vendorId)
      )
      .slice(0, limit);

    // Format orders
    return filteredOrders.map((order) => {
      // Filter order items to only include those from this vendor
      const vendorItems = order.orderItems.filter(
        (item) => item.vendor && item.vendor.toString() === vendorId
      );

      // Calculate vendor total
      const vendorTotal = vendorItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      return {
        _id: order._id,
        orderNumber: order._id
          .toString()
          .substring(order._id.toString().length - 8)
          .toUpperCase(),
        customer: order.user
          ? {
              _id: order.user._id,
              name: `${order.user.firstName} ${order.user.lastName}`,
              email: order.user.email,
            }
          : null,
        status: order.status,
        vendorTotal: Number.parseFloat(vendorTotal.toFixed(2)),
        itemCount: vendorItems.length,
        createdAt: order.createdAt,
        isPaid: order.isPaid,
      };
    });
  } catch (error: any) {
    logger.error(`Error getting vendor recent orders: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor top products
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param limit Number of products to return
 * @param requestId Request ID for logging
 * @returns Vendor top products
 */
async function getVendorTopProducts(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  limit: number,
  requestId?: string
): Promise<any[]> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting top products for vendor ID: ${vendorId}`);

  try {
    // Get top selling products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: "$orderItems.product",
          quantitySold: { $sum: "$orderItems.quantity" },
          revenue: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $addFields: {
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          sku: "$product.sku",
          price: "$product.price",
          image: { $arrayElemAt: ["$product.images", 0] },
          quantitySold: 1,
          revenue: { $round: ["$revenue", 2] },
          orderCount: 1,
        },
      },
    ]);

    return topProducts;
  } catch (error: any) {
    logger.error(`Error getting vendor top products: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor sales trend
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param interval Interval (hourly, daily, weekly, monthly)
 * @param requestId Request ID for logging
 * @returns Vendor sales trend
 */
async function getVendorSalesTrend(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  interval: "hourly" | "daily" | "weekly" | "monthly" = "daily",
  requestId?: string
): Promise<any[]> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting sales trend for vendor ID: ${vendorId}`);

  try {
    // Define group by date format based on interval
    let dateFormat;
    let dateStringFormat;

    if (interval === "hourly") {
      dateFormat = { year: "$year", month: "$month", day: "$day", hour: "$hour" };
      dateStringFormat = "%Y-%m-%d %H:00";
    } else if (interval === "daily") {
      dateFormat = { year: "$year", month: "$month", day: "$day" };
      dateStringFormat = "%Y-%m-%d";
    } else if (interval === "weekly") {
      dateFormat = { year: "$year", week: "$week" };
      dateStringFormat = "%Y-W%V";
    } else if (interval === "monthly") {
      dateFormat = { year: "$year", month: "$month" };
      dateStringFormat = "%Y-%m";
    } else {
      dateFormat = { year: "$year", month: "$month", day: "$day" }; // Default to daily
      dateStringFormat = "%Y-%m-%d";
    }

    // Get sales trend data
    const salesTrend = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
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
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          items: { $sum: "$orderItems.quantity" },
          orders: { $addToSet: "$_id" },
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
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: dateStringFormat, date: "$date" } },
          sales: { $round: ["$sales", 2] },
          items: 1,
          orderCount: 1,
        },
      },
    ]);

    return salesTrend;
  } catch (error: any) {
    logger.error(`Error getting vendor sales trend: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor sales analytics
 * @param vendorId Vendor ID
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Vendor sales analytics
 */
export const getVendorSalesAnalytics = async (
  vendorId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    interval?: "hourly" | "daily" | "weekly" | "monthly";
    compareWithPrevious?: boolean;
    groupBy?: "product" | "category" | "customer";
  } = {},
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting sales analytics for vendor ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Set default options
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const interval = options.interval || "daily";
  const compareWithPrevious =
    options.compareWithPrevious !== undefined ? options.compareWithPrevious : true;
  const groupBy = options.groupBy || "product";

  // Try to get from cache
  const cacheKey = `vendor_sales_analytics:${vendorId}:${startDate.toISOString()}:${endDate.toISOString()}:${interval}:${compareWithPrevious}:${groupBy}`;
  const cachedData = await getCache<any>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved vendor sales analytics from cache`);
    return cachedData;
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Get sales summary
    const salesSummary = await getVendorSalesSummary(vendorId, startDate, endDate, requestId);

    // Get sales trend
    const salesTrend = await getVendorSalesTrend(vendorId, startDate, endDate, interval, requestId);

    // Get previous period sales trend if needed
    let previousSalesTrend = null;
    if (compareWithPrevious) {
      const previousStartDate = new Date(
        startDate.getTime() - (endDate.getTime() - startDate.getTime())
      );
      const previousEndDate = new Date(startDate);
      previousSalesTrend = await getVendorSalesTrend(
        vendorId,
        previousStartDate,
        previousEndDate,
        interval,
        requestId
      );
    }

    // Get grouped sales data
    let groupedSales = [];
    if (groupBy === "product") {
      groupedSales = await getVendorSalesByProduct(vendorId, startDate, endDate, requestId);
    } else if (groupBy === "category") {
      groupedSales = await getVendorSalesByCategory(vendorId, startDate, endDate, requestId);
    } else if (groupBy === "customer") {
      groupedSales = await getVendorSalesByCustomer(vendorId, startDate, endDate, requestId);
    }

    // Compile sales analytics
    const salesAnalytics = {
      summary: salesSummary,
      trend: {
        current: salesTrend,
        previous: previousSalesTrend,
      },
      groupedBy: {
        type: groupBy,
        data: groupedSales,
      },
      period: {
        startDate,
        endDate,
        interval,
      },
    };

    // Cache the results
    await setCache(cacheKey, salesAnalytics, CACHE_TTL.SALES_ANALYTICS);

    return salesAnalytics;
  } catch (error: any) {
    logger.error(`Error getting vendor sales analytics: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor sales by product
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Vendor sales by product
 */
async function getVendorSalesByProduct(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any[]> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting sales by product for vendor ID: ${vendorId}`);

  try {
    // Get sales by product
    const salesByProduct = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: "$orderItems.product",
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          quantity: { $sum: "$orderItems.quantity" },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $addFields: {
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { sales: -1 } },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $project: {
          _id: "$product._id",
          name: "$product.name",
          sku: "$product.sku",
          price: "$product.price",
          image: { $arrayElemAt: ["$product.images", 0] },
          sales: { $round: ["$sales", 2] },
          quantity: 1,
          orderCount: 1,
        },
      },
    ]);

    // Calculate total sales for percentage
    const totalSales = salesByProduct.reduce((sum, product) => sum + product.sales, 0);

    // Add percentage to each product
    return salesByProduct.map((product) => ({
      ...product,
      percentage:
        totalSales > 0 ? Number.parseFloat(((product.sales / totalSales) * 100).toFixed(2)) : 0,
    }));
  } catch (error: any) {
    logger.error(`Error getting vendor sales by product: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor sales by category
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Vendor sales by category
 */
async function getVendorSalesByCategory(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any[]> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting sales by category for vendor ID: ${vendorId}`);

  try {
    // Get sales by category
    const salesByCategory = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "orderItems.product",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: "$product.category",
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          quantity: { $sum: "$orderItems.quantity" },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $addFields: {
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { sales: -1 } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: "$category" },
      {
        $project: {
          _id: "$category._id",
          name: "$category.name",
          sales: { $round: ["$sales", 2] },
          quantity: 1,
          orderCount: 1,
        },
      },
    ]);

    // Calculate total sales for percentage
    const totalSales = salesByCategory.reduce((sum, category) => sum + category.sales, 0);

    // Add percentage to each category
    return salesByCategory.map((category) => ({
      ...category,
      percentage:
        totalSales > 0 ? Number.parseFloat(((category.sales / totalSales) * 100).toFixed(2)) : 0,
    }));
  } catch (error: any) {
    logger.error(`Error getting vendor sales by category: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor sales by customer
 * @param vendorId Vendor ID
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Vendor sales by customer
 */
async function getVendorSalesByCustomer(
  vendorId: string,
  startDate: Date,
  endDate: Date,
  requestId?: string
): Promise<any[]> {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting sales by customer for vendor ID: ${vendorId}`);

  try {
    // Get sales by customer
    const salesByCustomer = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $ne: "cancelled" },
          user: { $exists: true, $ne: null },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: "$user",
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          quantity: { $sum: "$orderItems.quantity" },
          orders: { $addToSet: "$_id" },
        },
      },
      {
        $addFields: {
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 20 }, // Limit to top 20 customers
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: "$user._id",
          name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
          email: "$user.email",
          sales: { $round: ["$sales", 2] },
          quantity: 1,
          orderCount: 1,
        },
      },
    ]);

    // Calculate total sales for percentage
    const totalSales = salesByCustomer.reduce((sum, customer) => sum + customer.sales, 0);

    // Add percentage to each customer
    return salesByCustomer.map((customer) => ({
      ...customer,
      percentage:
        totalSales > 0 ? Number.parseFloat(((customer.sales / totalSales) * 100).toFixed(2)) : 0,
    }));
  } catch (error: any) {
    logger.error(`Error getting vendor sales by customer: ${error.message}`);
    throw error;
  }
}

/**
 * Get vendor product analytics
 * @param vendorId Vendor ID
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Vendor product analytics
 */
export const getVendorProductAnalytics = async (
  vendorId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    categoryId?: string;
    limit?: number;
  } = {},
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting product analytics for vendor ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Set default options
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const limit = options.limit || 10;

  // Build filter
  const filter: Record<string, any> = { vendor: vendorId };
  if (options.categoryId) {
    filter.category = options.categoryId;
  }

  // Try to get from cache
  const cacheKey = `vendor_product_analytics:${vendorId}:${startDate.toISOString()}:${endDate.toISOString()}:${options.categoryId || "all"}:${limit}`;
  const cachedData = await getCache<any>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved vendor product analytics from cache`);
    return cachedData;
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Get top selling products
    const topSellingProducts = await getVendorTopProducts(
      vendorId,
      startDate,
      endDate,
      limit,
      requestId
    );

    // Get low stock products
    const lowStockProducts = await Product.find({
      ...filter,
      quantity: { $gt: 0, $lte: 5 },
    })
      .sort("quantity")
      .limit(limit)
      .populate("category", "name")
      .lean();

    // Get out of stock products
    const outOfStockProducts = await Product.find({
      ...filter,
      quantity: { $lte: 0 },
    })
      .sort("updatedAt")
      .limit(limit)
      .populate("category", "name")
      .lean();

    // Get inventory by category
    const inventoryByCategory = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$category",
          value: { $sum: { $multiply: ["$price", "$quantity"] } },
          items: { $sum: "$quantity" },
          products: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
      {
        $lookup: {
          from: "categories",
          localField: "_id",
          foreignField: "_id",
          as: "category",
        },
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: "$category._id",
          name: { $ifNull: ["$category.name", "Uncategorized"] },
          value: { $round: ["$value", 2] },
          items: 1,
          products: 1,
        },
      },
    ]);

    // Calculate total value for percentage
    const totalValue = inventoryByCategory.reduce((sum, category) => sum + category.value, 0);

    // Add percentage to each category
    const inventoryByCategoryWithPercentage = inventoryByCategory.map((category) => ({
      ...category,
      percentage:
        totalValue > 0 ? Number.parseFloat(((category.value / totalValue) * 100).toFixed(2)) : 0,
    }));

    // Get product summary
    const productSummary = await getVendorProductSummary(vendorId, requestId);

    // Compile product analytics
    const productAnalytics = {
      summary: productSummary,
      topSellingProducts,
      lowStockProducts: lowStockProducts.map((product) => ({
        _id: product._id,
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        price: product.price,
        category: product.category ? product.category.name : "N/A",
        image: product.images && product.images.length > 0 ? product.images[0] : null,
        inventoryValue: Number.parseFloat((product.price * product.quantity).toFixed(2)),
      })),
      outOfStockProducts: outOfStockProducts.map((product) => ({
        _id: product._id,
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        price: product.price,
        category: product.category ? product.category.name : "N/A",
        image: product.images && product.images.length > 0 ? product.images[0] : null,
        lastUpdated: product.updatedAt,
      })),
      inventoryByCategory: inventoryByCategoryWithPercentage,
      period: {
        startDate,
        endDate,
      },
    };

    // Cache the results
    await setCache(cacheKey, productAnalytics, CACHE_TTL.PRODUCT_ANALYTICS);

    return productAnalytics;
  } catch (error: any) {
    logger.error(`Error getting vendor product analytics: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor order analytics
 * @param vendorId Vendor ID
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Vendor order analytics
 */
export const getVendorOrderAnalytics = async (
  vendorId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
  } = {},
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting order analytics for vendor ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Set default options
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

  // Build filter
  const filter: Record<string, any> = {
    createdAt: { $gte: startDate, $lte: endDate },
    "orderItems.vendor": vendorId,
  };

  if (options.status) {
    filter.status = options.status;
  }

  // Try to get from cache
  const cacheKey = `vendor_order_analytics:${vendorId}:${startDate.toISOString()}:${endDate.toISOString()}:${options.status || "all"}`;
  const cachedData = await getCache<any>(cacheKey);

  if (cachedData) {
    logger.info(`Retrieved vendor order analytics from cache`);
    return cachedData;
  }

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Get order summary
    const orderSummary = await getVendorOrderSummary(vendorId, startDate, endDate, requestId);

    // Get order trend
    const orderTrend = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          orders: { $addToSet: "$_id" },
          items: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: "$_id.day",
            },
          },
          orderCount: { $size: "$orders" },
        },
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          orderCount: 1,
          items: 1,
        },
      },
    ]);

    // Get orders by status
    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.vendor": new mongoose.Types.ObjectId(vendorId),
        },
      },
      {
        $group: {
          _id: "$status",
          orders: { $addToSet: "$_id" },
          items: { $sum: 1 },
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          orderCount: { $size: "$orders" },
          items: 1,
          sales: { $round: ["$sales", 2] },
        },
      },
      { $sort: { sales: -1 } },
    ]);

    // Get recent orders
    const recentOrders = await getVendorRecentOrders(vendorId, 10, requestId);

    // Compile order analytics
    const orderAnalytics = {
      summary: orderSummary,
      trend: orderTrend,
      byStatus: ordersByStatus,
      recentOrders,
      period: {
        startDate,
        endDate,
      },
    };

    // Cache the results
    await setCache(cacheKey, orderAnalytics, CACHE_TTL.ORDER_ANALYTICS);

    return orderAnalytics;
  } catch (error: any) {
    logger.error(`Error getting vendor order analytics: ${error.message}`);
    throw error;
  }
};

/**
 * Get vendor payout analytics
 * @param vendorId Vendor ID
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Vendor payout analytics
 */
export const getVendorPayoutAnalytics = async (
  vendorId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
  } = {},
  requestId?: string
): Promise<any> => {
  const logger = createRequestLogger(requestId);
  logger.info(`Getting payout analytics for vendor ID: ${vendorId}`);

  // Validate vendor ID
  if (!mongoose.Types.ObjectId.isValid(vendorId)) {
    throw new ApiError("Invalid vendor ID", 400);
  }

  // Set default options
  const endDate = options.endDate || new Date();
  const startDate = options.startDate || new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

  try {
    // Check if vendor exists
    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      throw new ApiError("Vendor not found", 404);
    }

    // Get payout summary
    const payoutSummary = await getVendorPayoutSummary(vendorId, startDate, endDate, requestId);

    // Get payout history
    const payoutHistory = await Payout.find({
      vendor: vendorId,
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .sort("-createdAt")
      .lean();

    // Get payout trend
    const payoutTrend = await Payout.aggregate([
      {
        $match: {
          vendor: new mongoose.Types.ObjectId(vendorId),
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          amount: { $sum: "$netAmount" },
          count: { $sum: 1 },
        },
      },
      {
        $addFields: {
          date: {
            $dateFromParts: {
              year: "$_id.year",
              month: "$_id.month",
              day: 1,
            },
          },
        },
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m", date: "$date" } },
          amount: { $round: ["$amount", 2] },
          count: 1,
        },
      },
    ]);

    // Compile payout analytics
    const payoutAnalytics = {
      summary: payoutSummary,
      history: payoutHistory,
      trend: payoutTrend,
      period: {
        startDate,
        endDate,
      },
    };

    return payoutAnalytics;
  } catch (error: any) {
    logger.error(`Error getting vendor payout analytics: ${error.message}`);
    throw error;
  }
};
