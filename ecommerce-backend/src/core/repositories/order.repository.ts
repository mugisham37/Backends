/**
 * Order repository
 * Handles all database operations for orders and order items
 */

import { eq, and, or, sql, desc, gte, lte, ilike } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import { Database } from "../database/connection";
import {
  orders,
  Order,
  NewOrder,
  orderItems,
  OrderItem,
  NewOrderItem,
  payments,
  Payment,
  NewPayment,
  orderStatusEnum,
  paymentStatusEnum,
  shippingStatusEnum,
  users,
  products,
  vendors,
} from "../database/schema";

// Order-specific types
export interface OrderFilters {
  status?: (typeof orderStatusEnum.enumValues)[number];
  paymentStatus?: (typeof paymentStatusEnum.enumValues)[number];
  shippingStatus?: (typeof shippingStatusEnum.enumValues)[number];
  userId?: string;
  vendorId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minTotal?: number;
  maxTotal?: number;
  search?: string; // Search in order number, customer email
}

export interface CreateOrderData
  extends Omit<NewOrder, "id" | "createdAt" | "updatedAt"> {}

export interface UpdateOrderData
  extends Partial<Omit<Order, "id" | "createdAt" | "updatedAt">> {}

export interface OrderWithItems extends Order {
  items: Array<
    OrderItem & {
      product: {
        id: string;
        name: string;
        slug: string;
      };
      vendor: {
        id: string;
        businessName: string;
      };
    }
  >;
  payments: Payment[];
  user?:
    | {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      }
    | undefined;
}

export interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  ordersByStatus: Record<string, number>;
  ordersByPaymentStatus: Record<string, number>;
}

export class OrderRepository extends BaseRepository<
  Order,
  NewOrder,
  UpdateOrderData
> {
  protected table = orders;
  protected idColumn = orders.id;
  protected tableName = "orders";

  constructor(db: Database) {
    super(db);
  }

  // Find order by order number
  async findByOrderNumber(orderNumber: string): Promise<Order | null> {
    const result = await this.db
      .select()
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    return result[0] || null;
  }

  // Find orders by user
  async findByUser(userId: string): Promise<Order[]> {
    return this.db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  // Find orders by customer email
  async findByCustomerEmail(email: string): Promise<Order[]> {
    return this.db
      .select()
      .from(orders)
      .where(eq(orders.customerEmail, email))
      .orderBy(desc(orders.createdAt));
  }

  // Find orders by vendor ID
  async findByVendorId(
    vendorId: string,
    filters: OrderFilters = {}
  ): Promise<Order[]> {
    // This would need to join with order_items table to filter by vendor
    // For now, return empty array as order_items table is not implemented
    // TODO: Implement this method when order_items table is available
    return [];
  }

  // Find order with all items and relations
  async findWithItems(id: string): Promise<OrderWithItems | null> {
    // Get order
    const orderResult = await this.db
      .select({
        // Order fields
        id: orders.id,
        orderNumber: orders.orderNumber,
        userId: orders.userId,
        customerEmail: orders.customerEmail,
        customerPhone: orders.customerPhone,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        shippingStatus: orders.shippingStatus,
        subtotal: orders.subtotal,
        taxAmount: orders.taxAmount,
        shippingAmount: orders.shippingAmount,
        discountAmount: orders.discountAmount,
        total: orders.total,
        currency: orders.currency,
        billingAddress: orders.billingAddress,
        shippingAddress: orders.shippingAddress,
        shippingMethod: orders.shippingMethod,
        trackingNumber: orders.trackingNumber,
        trackingUrl: orders.trackingUrl,
        customerNotes: orders.customerNotes,
        adminNotes: orders.adminNotes,
        metadata: orders.metadata,
        shippedAt: orders.shippedAt,
        deliveredAt: orders.deliveredAt,
        cancelledAt: orders.cancelledAt,
        createdAt: orders.createdAt,
        updatedAt: orders.updatedAt,
        // User fields (if exists)
        user: {
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
        },
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(eq(orders.id, id))
      .limit(1);

    if (!orderResult[0]) return null;

    // Get order items with product and vendor info
    const itemsResult = await this.db
      .select({
        // Order item fields
        id: orderItems.id,
        orderId: orderItems.orderId,
        productId: orderItems.productId,
        variantId: orderItems.variantId,
        vendorId: orderItems.vendorId,
        productName: orderItems.productName,
        productSku: orderItems.productSku,
        variantTitle: orderItems.variantTitle,
        price: orderItems.price,
        quantity: orderItems.quantity,
        total: orderItems.total,
        productSnapshot: orderItems.productSnapshot,
        createdAt: orderItems.createdAt,
        updatedAt: orderItems.updatedAt,
        // Product fields
        product: {
          id: products.id,
          name: products.name,
          slug: products.slug,
        },
        // Vendor fields
        vendor: {
          id: vendors.id,
          businessName: vendors.businessName,
        },
      })
      .from(orderItems)
      .innerJoin(products, eq(orderItems.productId, products.id))
      .innerJoin(vendors, eq(orderItems.vendorId, vendors.id))
      .where(eq(orderItems.orderId, id));

    // Get payments
    const paymentsResult = await this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, id))
      .orderBy(desc(payments.createdAt));

    return {
      ...orderResult[0],
      user: orderResult[0].user || undefined,
      items: itemsResult,
      payments: paymentsResult,
    };
  }

  // Search orders with filters
  async findWithFilters(filters: OrderFilters): Promise<Order[]> {
    let query = this.db.select().from(orders);

    const conditions = [];

    if (filters.status) {
      conditions.push(eq(orders.status, filters.status));
    }

    if (filters.paymentStatus) {
      conditions.push(eq(orders.paymentStatus, filters.paymentStatus));
    }

    if (filters.shippingStatus) {
      conditions.push(eq(orders.shippingStatus, filters.shippingStatus));
    }

    if (filters.userId) {
      conditions.push(eq(orders.userId, filters.userId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(orders.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(orders.createdAt, filters.dateTo));
    }

    if (filters.minTotal !== undefined) {
      conditions.push(gte(orders.total, filters.minTotal.toString()));
    }

    if (filters.maxTotal !== undefined) {
      conditions.push(lte(orders.total, filters.maxTotal.toString()));
    }

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(orders.orderNumber, searchTerm),
          ilike(orders.customerEmail, searchTerm)
        )
      );
    }

    // Execute query directly to avoid type issues
    if (filters.vendorId) {
      // Need to join with order items to filter by vendor
      conditions.push(eq(orderItems.vendorId, filters.vendorId));
      if (conditions.length > 0) {
        const result = await this.db
          .selectDistinct({
            id: orders.id,
            orderNumber: orders.orderNumber,
            userId: orders.userId,
            customerEmail: orders.customerEmail,
            customerPhone: orders.customerPhone,
            status: orders.status,
            paymentStatus: orders.paymentStatus,
            shippingStatus: orders.shippingStatus,
            subtotal: orders.subtotal,
            taxAmount: orders.taxAmount,
            shippingAmount: orders.shippingAmount,
            discountAmount: orders.discountAmount,
            total: orders.total,
            currency: orders.currency,
            billingAddress: orders.billingAddress,
            shippingAddress: orders.shippingAddress,
            shippingMethod: orders.shippingMethod,
            trackingNumber: orders.trackingNumber,
            trackingUrl: orders.trackingUrl,
            customerNotes: orders.customerNotes,
            adminNotes: orders.adminNotes,
            metadata: orders.metadata,
            shippedAt: orders.shippedAt,
            deliveredAt: orders.deliveredAt,
            cancelledAt: orders.cancelledAt,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .where(and(...conditions))
          .orderBy(desc(orders.createdAt));
        return result as Order[];
      } else {
        const result = await this.db
          .selectDistinct({
            id: orders.id,
            orderNumber: orders.orderNumber,
            userId: orders.userId,
            customerEmail: orders.customerEmail,
            customerPhone: orders.customerPhone,
            status: orders.status,
            paymentStatus: orders.paymentStatus,
            shippingStatus: orders.shippingStatus,
            subtotal: orders.subtotal,
            taxAmount: orders.taxAmount,
            shippingAmount: orders.shippingAmount,
            discountAmount: orders.discountAmount,
            total: orders.total,
            currency: orders.currency,
            billingAddress: orders.billingAddress,
            shippingAddress: orders.shippingAddress,
            shippingMethod: orders.shippingMethod,
            trackingNumber: orders.trackingNumber,
            trackingUrl: orders.trackingUrl,
            customerNotes: orders.customerNotes,
            adminNotes: orders.adminNotes,
            metadata: orders.metadata,
            shippedAt: orders.shippedAt,
            deliveredAt: orders.deliveredAt,
            cancelledAt: orders.cancelledAt,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .innerJoin(orderItems, eq(orders.id, orderItems.orderId))
          .where(eq(orderItems.vendorId, filters.vendorId))
          .orderBy(desc(orders.createdAt));
        return result as Order[];
      }
    } else {
      if (conditions.length > 0) {
        return this.db
          .select()
          .from(orders)
          .where(and(...conditions))
          .orderBy(desc(orders.createdAt));
      } else {
        return this.db.select().from(orders).orderBy(desc(orders.createdAt));
      }
    }
  }

  // Update order status
  async updateStatus(
    id: string,
    status: (typeof orderStatusEnum.enumValues)[number]
  ): Promise<Order | null> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    // Set timestamps based on status
    if (status === "shipped") {
      updateData.shippedAt = new Date();
      updateData.shippingStatus = "shipped";
    } else if (status === "delivered") {
      updateData.deliveredAt = new Date();
      updateData.shippingStatus = "delivered";
    } else if (status === "cancelled") {
      updateData.cancelledAt = new Date();
    }

    const result = await this.db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();

    return result[0] || null;
  }

  // Update payment status
  async updatePaymentStatus(
    id: string,
    paymentStatus: (typeof paymentStatusEnum.enumValues)[number]
  ): Promise<Order | null> {
    const result = await this.db
      .update(orders)
      .set({
        paymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id))
      .returning();

    return result[0] || null;
  }

  // Update shipping status
  async updateShippingStatus(
    id: string,
    shippingStatus: (typeof shippingStatusEnum.enumValues)[number],
    trackingNumber?: string,
    trackingUrl?: string
  ): Promise<Order | null> {
    const updateData: any = {
      shippingStatus,
      updatedAt: new Date(),
    };

    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber;
    }

    if (trackingUrl) {
      updateData.trackingUrl = trackingUrl;
    }

    if (shippingStatus === "shipped") {
      updateData.shippedAt = new Date();
    } else if (shippingStatus === "delivered") {
      updateData.deliveredAt = new Date();
    }

    const result = await this.db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id))
      .returning();

    return result[0] || null;
  }

  // Get recent orders
  async getRecentOrders(limit: number = 10): Promise<Order[]> {
    return this.db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(limit);
  }

  // Get orders by date range
  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    return this.db
      .select()
      .from(orders)
      .where(
        and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate))
      )
      .orderBy(desc(orders.createdAt));
  }

  // Get order statistics
  async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<OrderStats> {
    // Build date conditions
    const dateConditions = [];
    if (dateFrom) dateConditions.push(gte(orders.createdAt, dateFrom));
    if (dateTo) dateConditions.push(lte(orders.createdAt, dateTo));

    const [totalStats, statusStats, paymentStatusStats] = await Promise.all([
      this.db
        .select({
          totalOrders: sql<number>`count(*)::int`,
          totalRevenue: sql<number>`sum(${orders.total})::numeric`,
          averageOrderValue: sql<number>`avg(${orders.total})::numeric`,
        })
        .from(orders)
        .where(
          dateFrom || dateTo
            ? and(
                ...[
                  dateFrom && gte(orders.createdAt, dateFrom),
                  dateTo && lte(orders.createdAt, dateTo),
                ].filter(Boolean)
              )
            : undefined
        ),

      this.db
        .select({
          status: orders.status,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          dateFrom || dateTo
            ? and(
                ...[
                  dateFrom && gte(orders.createdAt, dateFrom),
                  dateTo && lte(orders.createdAt, dateTo),
                ].filter(Boolean)
              )
            : undefined
        )
        .groupBy(orders.status),

      this.db
        .select({
          paymentStatus: orders.paymentStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(
          dateFrom || dateTo
            ? and(
                ...[
                  dateFrom && gte(orders.createdAt, dateFrom),
                  dateTo && lte(orders.createdAt, dateTo),
                ].filter(Boolean)
              )
            : undefined
        )
        .groupBy(orders.paymentStatus),
    ]);

    const ordersByStatus: Record<string, number> = {};
    statusStats.forEach((stat) => {
      ordersByStatus[stat.status] = stat.count;
    });

    const ordersByPaymentStatus: Record<string, number> = {};
    paymentStatusStats.forEach((stat) => {
      ordersByPaymentStatus[stat.paymentStatus] = stat.count;
    });

    return {
      totalOrders: totalStats[0]?.totalOrders || 0,
      totalRevenue: Number(totalStats[0]?.totalRevenue) || 0,
      averageOrderValue: Number(totalStats[0]?.averageOrderValue) || 0,
      ordersByStatus,
      ordersByPaymentStatus,
    };
  }

  // Order Items methods
  async createOrderItem(data: NewOrderItem): Promise<OrderItem> {
    const result = await this.db.insert(orderItems).values(data).returning();

    return result[0];
  }

  async createOrderItems(data: NewOrderItem[]): Promise<OrderItem[]> {
    if (data.length === 0) return [];

    const result = await this.db.insert(orderItems).values(data).returning();

    return result;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));
  }

  // Payment methods
  async createPayment(data: NewPayment): Promise<Payment> {
    const result = await this.db.insert(payments).values(data).returning();

    return result[0];
  }

  async getOrderPayments(orderId: string): Promise<Payment[]> {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId))
      .orderBy(desc(payments.createdAt));
  }

  async updatePayment(
    id: string,
    data: Partial<Payment>
  ): Promise<Payment | null> {
    const result = await this.db
      .update(payments)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning();

    return result[0] || null;
  }
}
