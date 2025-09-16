import type mongoose from "mongoose"
import Order from "../models/order.model"
import Product from "../models/product.model"
import User from "../models/user.model"
import { createRequestLogger } from "../config/logger"
import { getCache, setCache } from "../config/redis"
import { ApiError } from "../utils/api-error"

// Cache TTL in seconds
const CACHE_TTL = {
  DASHBOARD_ANALYTICS: 1800, // 30 minutes
  SALES_ANALYTICS: 3600, // 1 hour
  PRODUCT_ANALYTICS: 3600, // 1 hour
  CUSTOMER_ANALYTICS: 3600, // 1 hour
  VENDOR_ANALYTICS: 3600, // 1 hour
  INVENTORY_ANALYTICS: 3600, // 1 hour
  MARKETING_ANALYTICS: 3600, // 1 hour
}

/**
 * Get dashboard analytics
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Dashboard analytics data
 */
export const getDashboardAnalytics = async (
  options: {
    startDate?: Date
    endDate?: Date
    compareWithPrevious?: boolean
  } = {},
  requestId?: string,
): Promise<any> => {
  const logger = createRequestLogger(requestId)
  logger.info("Getting dashboard analytics")

  // Set default options
  const endDate = options.endDate || new Date()
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  const compareWithPrevious = options.compareWithPrevious !== undefined ? options.compareWithPrevious : true

  // Calculate previous period
  const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
  const previousEndDate = new Date(endDate.getTime() - (endDate.getTime() - startDate.getTime()))

  // Try to get from cache
  const cacheKey = `dashboard_analytics:${startDate.toISOString()}:${endDate.toISOString()}:${compareWithPrevious}`
  const cachedData = await getCache<any>(cacheKey)

  if (cachedData) {
    logger.info("Retrieved dashboard analytics from cache")
    return cachedData
  }

  try {
    // Get sales summary
    const salesSummary = await getSalesSummary(
      startDate,
      endDate,
      compareWithPrevious ? previousStartDate : null,
      compareWithPrevious ? previousEndDate : null,
      requestId,
    )

    // Get customer summary
    const customerSummary = await getCustomerSummary(
      startDate,
      endDate,
      compareWithPrevious ? previousStartDate : null,
      compareWithPrevious ? previousEndDate : null,
      requestId,
    )

    // Get product summary
    const productSummary = await getProductSummary(startDate, endDate, requestId)

    // Get order summary
    const orderSummary = await getOrderSummary(startDate, endDate, requestId)

    // Get recent orders
    const recentOrders = await getRecentOrders(10, requestId)

    // Get top products
    const topProducts = await getTopProducts(5, startDate, endDate, requestId)

    // Get sales by category
    const salesByCategory = await getSalesByCategory(startDate, endDate, requestId)

    // Get sales by vendor
    const salesByVendor = await getSalesByVendor(startDate, endDate, requestId)

    // Get sales trend
    const salesTrend = await getSalesTrend(startDate, endDate, "daily", requestId)

    // Compile dashboard data
    const dashboardData = {
      salesSummary,
      customerSummary,
      productSummary,
      orderSummary,
      recentOrders,
      topProducts,
      salesByCategory,
      salesByVendor,
      salesTrend,
      period: {
        startDate,
        endDate,
      },
    }

    // Cache the results
    await setCache(cacheKey, dashboardData, CACHE_TTL.DASHBOARD_ANALYTICS)

    return dashboardData
  } catch (error: any) {
    logger.error(`Error getting dashboard analytics: ${error.message}`)
    throw new ApiError(`Failed to get dashboard analytics: ${error.message}`, 500)
  }
}

/**
 * Get sales summary
 * @param startDate Start date
 * @param endDate End date
 * @param previousStartDate Previous period start date
 * @param previousEndDate Previous period end date
 * @param requestId Request ID for logging
 * @returns Sales summary data
 */
async function getSalesSummary(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date | null,
  previousEndDate: Date | null,
  requestId?: string,
): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting sales summary")

  try {
    // Get current period sales data
    const currentSales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalPrice" },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: "$totalPrice" },
          totalItems: { $sum: { $size: "$orderItems" } },
        },
      },
      {
        $project: {
          _id: 0,
          totalSales: { $round: ["$totalSales", 2] },
          totalOrders: 1,
          avgOrderValue: { $round: ["$avgOrderValue", 2] },
          totalItems: 1,
        },
      },
    ])

    // Default values if no sales
    const currentPeriod =
      currentSales.length > 0
        ? currentSales[0]
        : {
            totalSales: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            totalItems: 0,
          }

    // Calculate growth if previous period dates are provided
    let growth = {
      totalSales: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      totalItems: 0,
    }

    if (previousStartDate && previousEndDate) {
      // Get previous period sales data
      const previousSales = await Order.aggregate([
        {
          $match: {
            createdAt: { $gte: previousStartDate, $lte: previousEndDate },
            isPaid: true,
          },
        },
        {
          $group: {
            _id: null,
            totalSales: { $sum: "$totalPrice" },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: "$totalPrice" },
            totalItems: { $sum: { $size: "$orderItems" } },
          },
        },
        {
          $project: {
            _id: 0,
            totalSales: { $round: ["$totalSales", 2] },
            totalOrders: 1,
            avgOrderValue: { $round: ["$avgOrderValue", 2] },
            totalItems: 1,
          },
        },
      ])

      // Default values if no previous sales
      const previousPeriod =
        previousSales.length > 0
          ? previousSales[0]
          : {
              totalSales: 0,
              totalOrders: 0,
              avgOrderValue: 0,
              totalItems: 0,
            }

      // Calculate growth percentages
      growth = {
        totalSales: calculateGrowthPercentage(currentPeriod.totalSales, previousPeriod.totalSales),
        totalOrders: calculateGrowthPercentage(currentPeriod.totalOrders, previousPeriod.totalOrders),
        avgOrderValue: calculateGrowthPercentage(currentPeriod.avgOrderValue, previousPeriod.avgOrderValue),
        totalItems: calculateGrowthPercentage(currentPeriod.totalItems, previousPeriod.totalItems),
      }
    }

    return {
      ...currentPeriod,
      growth,
    }
  } catch (error: any) {
    logger.error(`Error getting sales summary: ${error.message}`)
    throw error
  }
}

/**
 * Get customer summary
 * @param startDate Start date
 * @param endDate End date
 * @param previousStartDate Previous period start date
 * @param previousEndDate Previous period end date
 * @param requestId Request ID for logging
 * @returns Customer summary data
 */
async function getCustomerSummary(
  startDate: Date,
  endDate: Date,
  previousStartDate: Date | null,
  previousEndDate: Date | null,
  requestId?: string,
): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting customer summary")

  try {
    // Get total customers
    const totalCustomers = await User.countDocuments({ role: "customer" })

    // Get new customers in current period
    const newCustomers = await User.countDocuments({
      role: "customer",
      createdAt: { $gte: startDate, $lte: endDate },
    })

    // Get active customers (customers who placed an order in the period)
    const activeCustomerIds = await Order.distinct("user", {
      createdAt: { $gte: startDate, $lte: endDate },
      isPaid: true,
    })
    const activeCustomers = activeCustomerIds.length

    // Calculate customer retention rate
    const customersBeforePeriod = await User.countDocuments({
      role: "customer",
      createdAt: { $lt: startDate },
    })

    const retentionRate = customersBeforePeriod > 0 ? Math.round((activeCustomers / customersBeforePeriod) * 100) : 0

    // Calculate growth if previous period dates are provided
    let growth = {
      newCustomers: 0,
      activeCustomers: 0,
      retentionRate: 0,
    }

    if (previousStartDate && previousEndDate) {
      // Get new customers in previous period
      const previousNewCustomers = await User.countDocuments({
        role: "customer",
        createdAt: { $gte: previousStartDate, $lte: previousEndDate },
      })

      // Get active customers in previous period
      const previousActiveCustomerIds = await Order.distinct("user", {
        createdAt: { $gte: previousStartDate, $lte: previousEndDate },
        isPaid: true,
      })
      const previousActiveCustomers = previousActiveCustomerIds.length

      // Calculate previous retention rate
      const customersBeforePreviousPeriod = await User.countDocuments({
        role: "customer",
        createdAt: { $lt: previousStartDate },
      })

      const previousRetentionRate =
        customersBeforePreviousPeriod > 0
          ? Math.round((previousActiveCustomers / customersBeforePreviousPeriod) * 100)
          : 0

      // Calculate growth percentages
      growth = {
        newCustomers: calculateGrowthPercentage(newCustomers, previousNewCustomers),
        activeCustomers: calculateGrowthPercentage(activeCustomers, previousActiveCustomers),
        retentionRate: calculateGrowthPercentage(retentionRate, previousRetentionRate),
      }
    }

    return {
      totalCustomers,
      newCustomers,
      activeCustomers,
      retentionRate,
      growth,
    }
  } catch (error: any) {
    logger.error(`Error getting customer summary: ${error.message}`)
    throw error
  }
}

/**
 * Get product summary
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Product summary data
 */
async function getProductSummary(startDate: Date, endDate: Date, requestId?: string): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting product summary")

  try {
    // Get product counts
    const totalProducts = await Product.countDocuments()
    const activeProducts = await Product.countDocuments({ active: true })
    const featuredProducts = await Product.countDocuments({ featured: true })
    const lowStockProducts = await Product.countDocuments({ quantity: { $gt: 0, $lte: 5 } })
    const outOfStockProducts = await Product.countDocuments({ quantity: { $lte: 0 } })

    // Get inventory value
    const inventoryValue = await Product.aggregate([
      {
        $group: {
          _id: null,
          value: { $sum: { $multiply: ["$price", "$quantity"] } },
        },
      },
      {
        $project: {
          _id: 0,
          value: { $round: ["$value", 2] },
        },
      },
    ])

    // Get new products in period
    const newProducts = await Product.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    })

    // Get updated products in period
    const updatedProducts = await Product.countDocuments({
      updatedAt: { $gte: startDate, $lte: endDate },
      createdAt: { $lt: startDate },
    })

    return {
      totalProducts,
      activeProducts,
      featuredProducts,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue: inventoryValue.length > 0 ? inventoryValue[0].value : 0,
      newProducts,
      updatedProducts,
    }
  } catch (error: any) {
    logger.error(`Error getting product summary: ${error.message}`)
    throw error
  }
}

/**
 * Get order summary
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Order summary data
 */
async function getOrderSummary(startDate: Date, endDate: Date, requestId?: string): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting order summary")

  try {
    // Get order counts by status
    const ordersByStatus = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1,
        },
      },
    ])

    // Convert to object
    const statusCounts: Record<string, number> = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    }

    ordersByStatus.forEach((item) => {
      if (statusCounts.hasOwnProperty(item.status)) {
        statusCounts[item.status] = item.count
      }
    })

    // Get payment stats
    const paymentStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$isPaid",
          count: { $sum: 1 },
          total: { $sum: "$totalPrice" },
        },
      },
      {
        $project: {
          _id: 0,
          isPaid: "$_id",
          count: 1,
          total: { $round: ["$total", 2] },
        },
      },
    ])

    // Convert to object
    const paymentCounts = {
      paid: 0,
      unpaid: 0,
      paidTotal: 0,
      unpaidTotal: 0,
    }

    paymentStats.forEach((item) => {
      if (item.isPaid) {
        paymentCounts.paid = item.count
        paymentCounts.paidTotal = item.total
      } else {
        paymentCounts.unpaid = item.count
        paymentCounts.unpaidTotal = item.total
      }
    })

    // Get shipping stats
    const shippingStats = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$isDelivered",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          isDelivered: "$_id",
          count: 1,
        },
      },
    ])

    // Convert to object
    const shippingCounts = {
      delivered: 0,
      undelivered: 0,
    }

    shippingStats.forEach((item) => {
      if (item.isDelivered) {
        shippingCounts.delivered = item.count
      } else {
        shippingCounts.undelivered = item.count
      }
    })

    return {
      statusCounts,
      paymentCounts,
      shippingCounts,
      totalOrders: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
    }
  } catch (error: any) {
    logger.error(`Error getting order summary: ${error.message}`)
    throw error
  }
}

/**
 * Get recent orders
 * @param limit Number of orders to return
 * @param requestId Request ID for logging
 * @returns Recent orders
 */
async function getRecentOrders(limit: number, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting recent orders, limit: ${limit}`)

  try {
    const orders = await Order.find()
      .sort("-createdAt")
      .limit(limit)
      .populate("user", "firstName lastName email")
      .lean()

    return orders.map((order) => ({
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
      totalPrice: order.totalPrice,
      status: order.status,
      isPaid: order.isPaid,
      isDelivered: order.isDelivered,
      createdAt: order.createdAt,
      itemCount: order.orderItems.length,
    }))
  } catch (error: any) {
    logger.error(`Error getting recent orders: ${error.message}`)
    throw error
  }
}

/**
 * Get top products
 * @param limit Number of products to return
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Top products
 */
async function getTopProducts(limit: number, startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting top products, limit: ${limit}`)

  try {
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      { $unwind: "$orderItems" },
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
    ])

    return topProducts
  } catch (error: any) {
    logger.error(`Error getting top products: ${error.message}`)
    throw error
  }
}

/**
 * Get sales by category
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Sales by category
 */
async function getSalesByCategory(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting sales by category")

  try {
    const salesByCategory = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      { $unwind: "$orderItems" },
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
          items: { $sum: "$orderItems.quantity" },
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
          items: 1,
          orderCount: 1,
        },
      },
    ])

    // Calculate total sales for percentage
    const totalSales = salesByCategory.reduce((sum, category) => sum + category.sales, 0)

    // Add percentage to each category
    return salesByCategory.map((category) => ({
      ...category,
      percentage: totalSales > 0 ? Math.round((category.sales / totalSales) * 100) : 0,
    }))
  } catch (error: any) {
    logger.error(`Error getting sales by category: ${error.message}`)
    throw error
  }
}

/**
 * Get sales by vendor
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Sales by vendor
 */
async function getSalesByVendor(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting sales by vendor")

  try {
    const salesByVendor = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      { $unwind: "$orderItems" },
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
          _id: "$product.vendor",
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
          items: { $sum: "$orderItems.quantity" },
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
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendor",
        },
      },
      {
        $project: {
          _id: "$_id",
          name: { $ifNull: [{ $arrayElemAt: ["$vendor.businessName", 0] }, "Store"] },
          sales: { $round: ["$sales", 2] },
          items: 1,
          orderCount: 1,
        },
      },
    ])

    // Calculate total sales for percentage
    const totalSales = salesByVendor.reduce((sum, vendor) => sum + vendor.sales, 0)

    // Add percentage to each vendor
    return salesByVendor.map((vendor) => ({
      ...vendor,
      percentage: totalSales > 0 ? Math.round((vendor.sales / totalSales) * 100) : 0,
    }))
  } catch (error: any) {
    logger.error(`Error getting sales by vendor: ${error.message}`)
    throw error
  }
}

/**
 * Get sales trend
 * @param startDate Start date
 * @param endDate End date
 * @param interval Interval (hourly, daily, weekly, monthly)
 * @param requestId Request ID for logging
 * @returns Sales trend data
 */
async function getSalesTrend(
  startDate: Date,
  endDate: Date,
  interval: "hourly" | "daily" | "weekly" | "monthly" = "daily",
  requestId?: string,
): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting sales trend with interval: ${interval}`)

  try {
    // Define group by date format based on interval
    let dateFormat
    let dateStringFormat

    if (interval === "hourly") {
      dateFormat = { year: "$year", month: "$month", day: "$day", hour: "$hour" }
      dateStringFormat = "%Y-%m-%d %H:00"
    } else if (interval === "daily") {
      dateFormat = { year: "$year", month: "$month", day: "$day" }
      dateStringFormat = "%Y-%m-%d"
    } else if (interval === "weekly") {
      dateFormat = { year: "$year", week: "$week" }
      dateStringFormat = "%Y-W%V"
    } else if (interval === "monthly") {
      dateFormat = { year: "$year", month: "$month" }
      dateStringFormat = "%Y-%m"
    } else {
      dateFormat = { year: "$year", month: "$month", day: "$day" } // Default to daily
      dateStringFormat = "%Y-%m-%d"
    }

    // Get sales trend data
    const salesTrend = await Order.aggregate([
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
          items: { $sum: { $size: "$orderItems" } },
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
          date: { $dateToString: { format: dateStringFormat, date: "$date" } },
          sales: { $round: ["$sales", 2] },
          orders: 1,
          items: 1,
        },
      },
    ])

    return salesTrend
  } catch (error: any) {
    logger.error(`Error getting sales trend: ${error.message}`)
    throw error
  }
}

/**
 * Get detailed sales analytics
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Detailed sales analytics
 */
export const getSalesAnalytics = async (
  options: {
    startDate?: Date
    endDate?: Date
    interval?: "hourly" | "daily" | "weekly" | "monthly"
    compareWithPrevious?: boolean
    groupBy?: "product" | "category" | "vendor" | "customer" | "paymentMethod" | "country"
  } = {},
  requestId?: string
): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting detailed sales analytics")

  // Set default options
  const endDate = options.endDate || new Date()
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  const interval = options.interval || "daily"
  const compareWithPrevious = options.compareWithPrevious !== undefined ? options.compareWithPrevious : true
  const groupBy = options.groupBy || "product"

  // Calculate previous period
  const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()))
  const previousEndDate = new Date(endDate.getTime() - (endDate.getTime() - startDate.getTime()))

  // Try to get from cache
  const cacheKey = `sales_analytics:${startDate.toISOString()}:${endDate.toISOString()}:${interval}:${compareWithPrevious}:${groupBy}`
  const cachedData = await getCache<any>(cacheKey)

  if (cachedData) {
    logger.info("Retrieved sales analytics from cache")
    return cachedData
  }

  try {
    // Get sales trend
    const salesTrend = await getSalesTrend(startDate, endDate, interval, requestId)

    // Get previous period sales trend if needed
    let previousSalesTrend = null
    if (compareWithPrevious) {
      previousSalesTrend = await getSalesTrend(previousStartDate, previousEndDate, interval, requestId)
    }

    // Get sales summary
    const salesSummary = await getSalesSummary(startDate, endDate, compareWithPrevious ? previousStartDate : null, compareWithPrevious ? previousEndDate : null, requestId)

    // Get grouped sales data
    let groupedSales = []
    if (groupBy === "product") {
      groupedSales = await getTopProducts(100, startDate, endDate, requestId)
    } else if (groupBy === "category") {
      groupedSales = await getSalesByCategory(startDate, endDate, requestId)
    } else if (groupBy === "vendor") {
      groupedSales = await getSalesByVendor(startDate, endDate, requestId)
    } else if (groupBy === "customer") {
      groupedSales = await getSalesByCustomer(startDate, endDate, requestId)
    } else if (groupBy === "paymentMethod") {
      groupedSales = await getSalesByPaymentMethod(startDate, endDate, requestId)
    } else if (groupBy === "country") {
      groupedSales = await getSalesByCountry(startDate, endDate, requestId)
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
    }

    // Cache the results
    await setCache(cacheKey, salesAnalytics, CACHE_TTL.SALES_ANALYTICS)

    return salesAnalytics
  } catch (error: any) {
    logger.error(`Error getting sales analytics: ${error.message}`)
    throw new ApiError(`Failed to get sales analytics: ${error.message}`, 500)
  }
}

/**
 * Get sales by customer
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Sales by customer
 */
async function getSalesByCustomer(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting sales by customer")

  try {
    const salesByCustomer = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
          user: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$user",
          sales: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
          items: { $sum: { $size: "$orderItems" } },
        },
      },
      {
        $addFields: {
          avgOrderValue: { $divide: ["$sales", "$orders"] },
        },
      },
      { $sort: { sales: -1 } },
      { $limit: 100 },
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
          orders: 1,
          items: 1,
          avgOrderValue: { $round: ["$avgOrderValue", 2] },
        },
      },
    ])

    return salesByCustomer
  } catch (error: any) {
    logger.error(`Error getting sales by customer: ${error.message}`)
    throw error
  }
}

/**
 * Get sales by payment method
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Sales by payment method
 */
async function getSalesByPaymentMethod(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting sales by payment method")

  try {
    const salesByPaymentMethod = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      {
        $group: {
          _id: "$paymentMethod",
          sales: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { sales: -1 } },
      {
        $project: {
          _id: 0,
          method: "$_id",
          sales: { $round: ["$sales", 2] },
          orders: 1,
        },
      },
    ])

    // Calculate total sales for percentage
    const totalSales = salesByPaymentMethod.reduce((sum, method) => sum + method.sales, 0)

    // Add percentage to each payment method
    return salesByPaymentMethod.map((method) => ({
      ...method,
      percentage: totalSales > 0 ? Math.round((method.sales / totalSales) * 100) : 0,
    }))
  } catch (error: any) {
    logger.error(`Error getting sales by payment method: ${error.message}`)
    throw error
  }
}

/**
 * Get sales by country
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Sales by country
 */
async function getSalesByCountry(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting sales by country")

  try {
    const salesByCountry = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
          "shippingAddress.country": { $exists: true, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$shippingAddress.country",
          sales: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { sales: -1 } },
      {
        $project: {
          _id: 0,
          country: "$_id",
          sales: { $round: ["$sales", 2] },
          orders: 1,
        },
      },
    ])

    // Calculate total sales for percentage
    const totalSales = salesByCountry.reduce((sum, country) => sum + country.sales, 0)

    // Add percentage to each country
    return salesByCountry.map((country) => ({
      ...country,
      percentage: totalSales > 0 ? Math.round((country.sales / totalSales) * 100) : 0,
    }))
  } catch (error: any) {
    logger.error(`Error getting sales by country: ${error.message}`)
    throw error
  }
}

/**
 * Get customer analytics
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Customer analytics data
 */
export const getCustomerAnalytics = async (
  options: {
    startDate?: Date
    endDate?: Date
    segment?: "new" | "returning" | "inactive" | "all"
  } = {},
  requestId?: string
): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting customer analytics")

  // Set default options
  const endDate = options.endDate || new Date()
  const startDate = options.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  const segment = options.segment || "all"

  // Try to get from cache
  const cacheKey = `customer_analytics:${startDate.toISOString()}:${endDate.toISOString()}:${segment}`
  const cachedData = await getCache<any>(cacheKey)

  if (cachedData) {
    logger.info("Retrieved customer analytics from cache")
    return cachedData
  }

  try {
    // Get customer growth
    const customerGrowth = await getCustomerGrowth(startDate, endDate, requestId)

    // Get customer segments
    const customerSegments = await getCustomerSegments(startDate, endDate, requestId)

    // Get top customers
    const topCustomers = await getTopCustomers(20, startDate, endDate, requestId)

    // Get customer retention
    const customerRetention = await getCustomerRetention(startDate, endDate, requestId)

    // Get customer acquisition channels
    const acquisitionChannels = await getCustomerAcquisitionChannels(startDate, endDate, requestId)

    // Filter customers by segment if specified
    let filteredTopCustomers = topCustomers
    if (segment !== "all") {
      if (segment === "new") {
        // New customers are those who registered during the period
        filteredTopCustomers = topCustomers.filter((customer) => {
          const registrationDate = new Date(customer.registrationDate)
          return registrationDate >= startDate && registrationDate <= endDate
        })
      } else if (segment === "returning") {
        // Returning customers are those who registered before the period but placed an order during the period
        filteredTopCustomers = topCustomers.filter((customer) => {
          const registrationDate = new Date(customer.registrationDate)
          return registrationDate < startDate && customer.orders > 0
        })
      } else if (segment === "inactive") {
        // Inactive customers are those who registered before the period but didn't place an order during the period
        filteredTopCustomers = topCustomers.filter((customer) => {
          const registrationDate = new Date(customer.registrationDate)
          return registrationDate < startDate && customer.orders === 0
        })
      }
    }

    // Compile customer analytics
    const customerAnalytics = {
      growth: customerGrowth,
      segments: customerSegments,
      topCustomers: filteredTopCustomers,
      retention: customerRetention,
      acquisitionChannels,
      period: {
        startDate,
        endDate,
        segment,
      },
    }

    // Cache the results
    await setCache(cacheKey, customerAnalytics, CACHE_TTL.CUSTOMER_ANALYTICS)

    return customerAnalytics
  } catch (error: any) {
    logger.error(`Error getting customer analytics: ${error.message}`)
    throw new ApiError(`Failed to get customer analytics: ${error.message}`, 500)
  }
}

/**
 * Get customer growth
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Customer growth data
 */
async function getCustomerGrowth(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting customer growth")

  try {
    // Get customer registrations by day
    const customerGrowth = await User.aggregate([
      {
        $match: {
          role: "customer",
          createdAt: { $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          },
          newCustomers: { $sum: 1 },
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
        },
      },
      { $sort: { date: 1 } },
      {
        $project: {
          _id: 0,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          newCustomers: 1,
        },
      },
    ])

    // Calculate cumulative customers
    let totalCustomers = 0
    const customersBefore = await User.countDocuments({
      role: "customer",
      createdAt: { $lt: startDate },
    })

    totalCustomers = customersBefore

    // Filter to only include dates in the specified range and add cumulative total
    const filteredGrowth = []
    for (const day of customerGrowth) {
      const dayDate = new Date(day.date)
      if (dayDate >= startDate && dayDate <= endDate) {
        totalCustomers += day.newCustomers
        filteredGrowth.push({
          ...day,
          totalCustomers,
        })
      }
    }

    return filteredGrowth
  } catch (error: any) {
    logger.error(`Error getting customer growth: ${error.message}`)
    throw error
  }
}

/**
 * Get customer segments
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Customer segments data
 */
async function getCustomerSegments(startDate: Date, endDate: Date, requestId?: string): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting customer segments")

  try {
    // Get total customers
    const totalCustomers = await User.countDocuments({ role: "customer" })

    // Get new customers (registered during the period)
    const newCustomers = await User.countDocuments({
      role: "customer",
      createdAt: { $gte: startDate, $lte: endDate },
    })

    // Get customers who registered before the period
    const existingCustomers = await User.countDocuments({
      role: "customer",
      createdAt: { $lt: startDate },
    })

    // Get customers who placed an order during the period
    const activeCustomerIds = await Order.distinct("user", {
      createdAt: { $gte: startDate, $lte: endDate },
      isPaid: true,
    })

    // Get returning customers (registered before the period and placed an order during the period)
    const returningCustomers = await User.countDocuments({
      _id: { $in: activeCustomerIds },
      role: "customer",
      createdAt: { $lt: startDate },
    })

    // Calculate inactive customers (registered before the period but didn't place an order during the period)
    const inactiveCustomers = existingCustomers - returningCustomers

    // Calculate at-risk customers (haven't placed an order in the last 90 days)
    const ninetyDaysAgo = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000)
    const recentActiveCustomerIds = await Order.distinct("user", {
      createdAt: { $gte: ninetyDaysAgo, $lte: endDate },
      isPaid: true,
    })

    const atRiskCustomers = await User.countDocuments({
      _id: { $nin: recentActiveCustomerIds },
      role: "customer",
      createdAt: { $lt: ninetyDaysAgo },
    })

    // Calculate loyal customers (placed 3 or more orders)
    const loyalCustomerIds = await Order.aggregate([
      {
        $match: {
          isPaid: true,
        },
      },
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
        },
      },
      {
        $match: {
          orderCount: { $gte: 3 },
        },
      },
      {
        $project: {
          _id: 1,
        },
      },
    ])

    const loyalCustomers = loyalCustomerIds.length

    return {
      total: totalCustomers,
      new: newCustomers,
      returning: returningCustomers,
      inactive: inactiveCustomers,
      atRisk: atRiskCustomers,
      loyal: loyalCustomers,
    }
  } catch (error: any) {
    logger.error(`Error getting customer segments: ${error.message}`)
    throw error
  }
}

/**
 * Get top customers
 * @param limit Number of customers to return
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Top customers
 */
async function getTopCustomers(limit: number, startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info(`Getting top customers, limit: ${limit}`)

  try {
    // Get customers with highest spending during the period
    const topCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
          user: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$user",
          totalSpent: { $sum: "$totalPrice" },
          orders: { $sum: 1 },
          items: { $sum: { $size: "$orderItems" } },
          lastOrder: { $max: "$createdAt" },
        },
      },
      {
        $addFields: {
          avgOrderValue: { $divide: ["$totalSpent", "$orders"] },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: limit },
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
          registrationDate: "$user.createdAt",
          totalSpent: { $round: ["$totalSpent", 2] },
          orders: 1,
          items: 1,
          avgOrderValue: { $round: ["$avgOrderValue", 2] },
          lastOrder: 1,
        },
      },
    ])

    return topCustomers
  } catch (error: any) {
    logger.error(`Error getting top customers: ${error.message}`)
    throw error
  }
}

/**
 * Get customer retention
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Customer retention data
 */
async function getCustomerRetention(startDate: Date, endDate: Date, requestId?: string): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting customer retention")

  try {
    // Calculate retention rate
    // Customers who placed an order before the period and during the period
    const customersBeforePeriod = await User.countDocuments({
      role: "customer",
      createdAt: { $lt: startDate },
    })

    // Get customers who placed an order during the period
    const activeCustomerIds = await Order.distinct("user", {
      createdAt: { $gte: startDate, $lte: endDate },
      isPaid: true,
    })

    // Get returning customers (registered before the period and placed an order during the period)
    const returningCustomers = await User.countDocuments({
      _id: { $in: activeCustomerIds },
      role: "customer",
      createdAt: { $lt: startDate },
    })

    // Calculate retention rate
    const retentionRate = customersBeforePeriod > 0 ? Math.round((returningCustomers / customersBeforePeriod) * 100) : 0

    // Calculate churn rate
    const churnRate = 100 - retentionRate

    // Calculate repeat purchase rate
    // Customers who placed more than one order during the period
    const repeatPurchaseCustomers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
          user: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$user",
          orderCount: { $sum: 1 },
        },
      },
      {
        $match: {
          orderCount: { $gt: 1 },
        },
      },
      {
        $count: "count",
      },
    ])

    const totalCustomersWithOrders = activeCustomerIds.length
    const repeatPurchaseRate =
      totalCustomersWithOrders > 0
        ? Math.round(((repeatPurchaseCustomers[0]?.count || 0) / totalCustomersWithOrders) * 100)
        : 0

    return {
      retentionRate,
      churnRate,
      repeatPurchaseRate,
      returningCustomers,
      totalCustomersBeforePeriod: customersBeforePeriod,
      totalCustomersWithOrders,
    }
  } catch (error: any) {
    logger.error(`Error getting customer retention: ${error.message}`)
    throw error
  }
}

/**
 * Get customer acquisition channels
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Customer acquisition channels data
 */
async function getCustomerAcquisitionChannels(startDate: Date, endDate: Date, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting customer acquisition channels")

  try {
    // This is a placeholder implementation
    // In a real application, you would track acquisition channels in your user model
    // For now, we'll return dummy data
    return [
      { channel: "Direct", customers: 45, percentage: 30 },
      { channel: "Organic Search", customers: 30, percentage: 20 },
      { channel: "Social Media", customers: 25, percentage: 16.67 },
      { channel: "Referral", customers: 20, percentage: 13.33 },
      { channel: "Email", customers: 15, percentage: 10 },
      { channel: "Paid Ads", customers: 15, percentage: 10 },
    ]
  } catch (error: any) {
    logger.error(`Error getting customer acquisition channels: ${error.message}`)
    throw error
  }
}

/**
 * Get inventory analytics
 * @param options Analytics options
 * @param requestId Request ID for logging
 * @returns Inventory analytics data
 */
export const getInventoryAnalytics = async (
  options: {
    categoryId?: string
    vendorId?: string
    lowStockThreshold?: number
  } = {},
  requestId?: string
): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting inventory analytics")

  // Set default options
  const lowStockThreshold = options.lowStockThreshold || 5

  // Build filter
  const filter: Record<string, any> = {}
  if (options.categoryId) {
    filter.category = options.categoryId
  }
  if (options.vendorId) {
    filter.vendor = options.vendorId
  }

  // Try to get from cache
  const cacheKey = `inventory_analytics:${JSON.stringify(options)}`
  const cachedData = await getCache<any>(cacheKey)

  if (cachedData) {
    logger.info("Retrieved inventory analytics from cache")
    return cachedData
  }

  try {
    // Get inventory summary
    const inventorySummary = await getInventorySummary(filter, lowStockThreshold, requestId)

    // Get low stock products
    const lowStockProducts = await getLowStockProducts(filter, lowStockThreshold, requestId)

    // Get out of stock products
    const outOfStockProducts = await getOutOfStockProducts(filter, requestId)

    // Get inventory value by category
    const inventoryByCategory = await getInventoryByCategory(filter, requestId)

    // Get inventory value by vendor
    const inventoryByVendor = await getInventoryByVendor(filter, requestId)

    // Get inventory turnover
    const inventoryTurnover = await getInventoryTurnover(filter, requestId)

    // Compile inventory analytics
    const inventoryAnalytics = {
      summary: inventorySummary,
      lowStockProducts,
      outOfStockProducts,
      inventoryByCategory,
      inventoryByVendor,
      inventoryTurnover,
      filter: {
        categoryId: options.categoryId,
        vendorId: options.vendorId,
        lowStockThreshold,
      },
    }

    // Cache the results
    await setCache(cacheKey, inventoryAnalytics, CACHE_TTL.INVENTORY_ANALYTICS)

    return inventoryAnalytics
  } catch (error: any) {
    logger.error(`Error getting inventory analytics: ${error.message}`)
    throw new ApiError(`Failed to get inventory analytics: ${error.message}`, 500)
  }
}

/**
 * Get inventory summary
 * @param filter Filter options
 * @param lowStockThreshold Low stock threshold
 * @param requestId Request ID for logging
 * @returns Inventory summary data
 */
async function getInventorySummary(
  filter: Record<string, any>,
  lowStockThreshold: number,
  requestId?: string,
): Promise<any> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting inventory summary")

  try {
    // Get inventory counts
    const totalProducts = await Product.countDocuments(filter)
    const inStockProducts = await Product.countDocuments({ ...filter, quantity: { $gt: 0 } })
    const lowStockProducts = await Product.countDocuments({ ...filter, quantity: { $gt: 0, $lte: lowStockThreshold } })
    const outOfStockProducts = await Product.countDocuments({ ...filter, quantity: { $lte: 0 } })

    // Get inventory value
    const inventoryValue = await Product.aggregate([
      { $match: filter },
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
    ])

    return {
      totalProducts,
      inStockProducts,
      lowStockProducts,
      outOfStockProducts,
      inventoryValue: inventoryValue.length > 0 ? inventoryValue[0].value : 0,
      totalItems: inventoryValue.length > 0 ? inventoryValue[0].items : 0,
      inStockPercentage: totalProducts > 0 ? Math.round((inStockProducts / totalProducts) * 100) : 0,
      lowStockPercentage: totalProducts > 0 ? Math.round((lowStockProducts / totalProducts) * 100) : 0,
      outOfStockPercentage: totalProducts > 0 ? Math.round((outOfStockProducts / totalProducts) * 100) : 0,
    }
  } catch (error: any) {
    logger.error(`Error getting inventory summary: ${error.message}`)
    throw error
  }
}

/**
 * Get low stock products
 * @param filter Filter options
 * @param lowStockThreshold Low stock threshold
 * @param requestId Request ID for logging
 * @returns Low stock products
 */
async function getLowStockProducts(
  filter: Record<string, any>,
  lowStockThreshold: number,
  requestId?: string,
): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting low stock products")

  try {
    const lowStockProducts = await Product.find({
      ...filter,
      quantity: { $gt: 0, $lte: lowStockThreshold },
    })
      .sort("quantity")
      .limit(20)
      .populate("category", "name")
      .populate("vendor", "businessName")
      .lean()

    return lowStockProducts.map((product) => ({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      price: product.price,
      category: product.category ? product.category.name : "N/A",
      vendor: product.vendor ? product.vendor.businessName : "Store",
      image: product.images && product.images.length > 0 ? product.images[0] : null,
      inventoryValue: product.price * product.quantity,
    }))
  } catch (error: any) {
    logger.error(`Error getting low stock products: ${error.message}`)
    throw error
  }
}

/**
 * Get out of stock products
 * @param filter Filter options
 * @param requestId Request ID for logging
 * @returns Out of stock products
 */
async function getOutOfStockProducts(filter: Record<string, any>, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting out of stock products")

  try {
    const outOfStockProducts = await Product.find({
      ...filter,
      quantity: { $lte: 0 },
    })
      .sort("updatedAt")
      .limit(20)
      .populate("category", "name")
      .populate("vendor", "businessName")
      .lean()

    return outOfStockProducts.map((product) => ({
      _id: product._id,
      name: product.name,
      sku: product.sku,
      quantity: product.quantity,
      price: product.price,
      category: product.category ? product.category.name : "N/A",
      vendor: product.vendor ? product.vendor.businessName : "Store",
      image: product.images && product.images.length > 0 ? product.images[0] : null,
      lastUpdated: product.updatedAt,
    }))
  } catch (error: any) {
    logger.error(`Error getting out of stock products: ${error.message}`)
    throw error
  }
}

/**
 * Get inventory by category
 * @param filter Filter options
 * @param requestId Request ID for logging
 * @returns Inventory by category
 */
async function getInventoryByCategory(filter: Record<string, any>, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting inventory by category")

  try {
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
    ])

    // Calculate total value for percentage
    const totalValue = inventoryByCategory.reduce((sum, category) => sum + category.value, 0)

    // Add percentage to each category
    return inventoryByCategory.map((category) => ({
      ...category,
      percentage: totalValue > 0 ? Math.round((category.value / totalValue) * 100) : 0,
    }))
  } catch (error: any) {
    logger.error(`Error getting inventory by category: ${error.message}`)
    throw error
  }
}

/**
 * Get inventory by vendor
 * @param filter Filter options
 * @param requestId Request ID for logging
 * @returns Inventory by vendor
 */
async function getInventoryByVendor(filter: Record<string, any>, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting inventory by vendor")

  try {
    const inventoryByVendor = await Product.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$vendor",
          value: { $sum: { $multiply: ["$price", "$quantity"] } },
          items: { $sum: "$quantity" },
          products: { $sum: 1 },
        },
      },
      { $sort: { value: -1 } },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "vendor",
        },
      },
      {
        $project: {
          _id: "$_id",
          name: { $ifNull: [{ $arrayElemAt: ["$vendor.businessName", 0] }, "Store"] },
          value: { $round: ["$value", 2] },
          items: 1,
          products: 1,
        },
      },
    ])

    // Calculate total value for percentage
    const totalValue = inventoryByVendor.reduce((sum, vendor) => sum + vendor.value, 0)

    // Add percentage to each vendor
    return inventoryByVendor.map((vendor) => ({
      ...vendor,
      percentage: totalValue > 0 ? Math.round((vendor.value / totalValue) * 100) : 0,
    }))
  } catch (error: any) {
    logger.error(`Error getting inventory by vendor: ${error.message}`)
    throw error
  }
}

/**
 * Get inventory turnover
 * @param filter Filter options
 * @param requestId Request ID for logging
 * @returns Inventory turnover data
 */
async function getInventoryTurnover(filter: Record<string, any>, requestId?: string): Promise<any[]> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting inventory turnover")

  try {
    // Get current date
    const now = new Date()

    // Calculate date ranges for different periods
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)

    // Get products with their current inventory value
    const products = await Product.find(filter).lean()

    // Calculate current inventory value
    const currentInventoryValue = products.reduce((sum, product) => sum + product.price * product.quantity, 0)

    // Get sales for different periods
    const thirtyDaySales = await getProductSales(
      products.map((p) => p._id),
      thirtyDaysAgo,
      now,
      requestId,
    )
    const ninetyDaySales = await getProductSales(
      products.map((p) => p._id),
      ninetyDaysAgo,
      now,
      requestId,
    )
    const yearSales = await getProductSales(
      products.map((p) => p._id),
      oneYearAgo,
      now,
      requestId,
    )

    // Calculate turnover rates
    // Turnover rate = (Cost of Goods Sold / Average Inventory Value)
    // For simplicity, we'll use sales value instead of COGS
    const thirtyDayTurnover = currentInventoryValue > 0 ? thirtyDaySales / currentInventoryValue : 0
    const ninetyDayTurnover = currentInventoryValue > 0 ? ninetyDaySales / currentInventoryValue : 0
    const yearTurnover = currentInventoryValue > 0 ? yearSales / currentInventoryValue : 0

    // Calculate days of inventory
    // Days of Inventory = (Average Inventory Value / (COGS / Days in Period))
    const thirtyDayInventoryDays = thirtyDaySales > 0 ? currentInventoryValue / (thirtyDaySales / 30) : 0
    const ninetyDayInventoryDays = ninetyDaySales > 0 ? currentInventoryValue / (ninetyDaySales / 90) : 0
    const yearInventoryDays = yearSales > 0 ? currentInventoryValue / (yearSales / 365) : 0

    return [
      {
        period: "30 days",
        sales: thirtyDaySales,
        turnoverRate: thirtyDayTurnover,
        daysOfInventory: Math.round(thirtyDayInventoryDays),
        annualizedTurnover: thirtyDayTurnover * (365 / 30),
      },
      {
        period: "90 days",
        sales: ninetyDaySales,
        turnoverRate: ninetyDayTurnover,
        daysOfInventory: Math.round(ninetyDayInventoryDays),
        annualizedTurnover: ninetyDayTurnover * (365 / 90),
      },
      {
        period: "365 days",
        sales: yearSales,
        turnoverRate: yearTurnover,
        daysOfInventory: Math.round(yearInventoryDays),
        annualizedTurnover: yearTurnover,
      },
    ]
  } catch (error: any) {
    logger.error(`Error getting inventory turnover: ${error.message}`)
    throw error
  }
}

/**
 * Get product sales for a period
 * @param productIds Product IDs
 * @param startDate Start date
 * @param endDate End date
 * @param requestId Request ID for logging
 * @returns Total sales
 */
async function getProductSales(
  productIds: mongoose.Types.ObjectId[],
  startDate: Date,
  endDate: Date,
  requestId?: string,
): Promise<number> {
  const logger = createRequestLogger(requestId)
  logger.info("Getting product sales")

  try {
    const sales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          isPaid: true,
        },
      },
      { $unwind: "$orderItems" },
      {
        $match: {
          "orderItems.product": { $in: productIds },
        },
      },
      {
        $group: {
          _id: null,
          sales: { $sum: { $multiply: ["$orderItems.price", "$orderItems.quantity"] } },
        },
      },
    ])

    return sales.length > 0 ? sales[0].sales : 0
  } catch (error: any) {
    logger.error(`Error getting product sales: ${error.message}`)
    throw error
  }
}

/**
 * Calculate growth percentage
 * @param current Current value
 * @param previous Previous value
 * @returns Growth percentage
 */
function calculateGrowthPercentage(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return Math.round(((current - previous) / previous) * 100)
}
