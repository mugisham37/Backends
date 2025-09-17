/**
 * Order service
 * Clean business logic for order management
 */

import {
  OrderRepository,
  OrderFilters,
} from "../../../core/repositories/order.repository";
import { ProductRepository } from "../../../core/repositories/product.repository";
import { UserRepository } from "../../../core/repositories/user.repository";
import {
  Order,
  NewOrder,
  NewOrderItem,
  NewPayment,
} from "../../../core/database/schema";
import {
  CreateOrderInput,
  UpdateOrderInput,
  OrderOutput,
  OrderItemInput,
} from "./order.types";
import { NotificationService } from "../../notifications/notification.service";
import { WebhookService } from "../../webhook/webhook.service";
import { AnalyticsService } from "../../analytics/analytics.service";
import { CacheService } from "../../cache/cache.service";

export class OrderService {
  constructor(
    private orderRepo: OrderRepository,
    private productRepo: ProductRepository,
    private userRepo: UserRepository,
    private notificationService?: NotificationService,
    private webhookService?: WebhookService,
    private analyticsService?: AnalyticsService,
    private cacheService?: CacheService
  ) {}

  async createOrder(input: CreateOrderInput): Promise<OrderOutput> {
    // Validate user if provided
    if (input.userId) {
      const user = await this.userRepo.findById(input.userId);
      if (!user) {
        throw new Error("User not found");
      }
    }

    // Validate and calculate order items
    const { items, subtotal } = await this.validateAndCalculateItems(
      input.items
    );

    // Calculate totals
    const taxAmount = Number(input.taxAmount) || 0;
    const shippingAmount = Number(input.shippingAmount) || 0;
    const discountAmount = Number(input.discountAmount) || 0;
    const total = subtotal + taxAmount + shippingAmount - discountAmount;

    // Generate unique order number
    const orderNumber = await this.generateOrderNumber();

    const orderData: NewOrder = {
      orderNumber,
      userId: input.userId,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      shippingAmount: shippingAmount.toString(),
      discountAmount: discountAmount.toString(),
      total: total.toString(),
      currency: input.currency || "USD",
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      shippingMethod: input.shippingMethod,
      customerNotes: input.customerNotes,
      metadata: input.metadata,
    };

    const order = await this.orderRepo.create(orderData);

    // Create order items
    const orderItemsData = items.map((item) => ({
      orderId: order.id,
      productId: item.productId,
      variantId: item.variantId,
      vendorId: item.vendorId,
      productName: item.productName,
      productSku: item.productSku,
      variantTitle: item.variantTitle,
      price: item.price.toString(),
      quantity: item.quantity,
      total: item.total.toString(),
      productSnapshot: item.productSnapshot,
    }));

    await this.orderRepo.createOrderItems(orderItemsData);

    const finalOrder = await this.getOrder(order.id);

    // Trigger integrations after order creation
    await this.handleOrderCreatedIntegrations(finalOrder, input);

    return finalOrder;
  }

  private async handleOrderCreatedIntegrations(
    order: OrderOutput,
    input: CreateOrderInput
  ): Promise<void> {
    try {
      // Analytics tracking
      if (this.analyticsService) {
        await this.analyticsService.trackEvent({
          eventType: "ecommerce",
          eventName: "order_created",
          userId: order.userId || undefined,
          properties: {
            orderId: order.id,
            orderTotal: order.total,
            currency: order.currency,
            itemCount: order.items.length,
            customerType: order.userId ? "registered" : "guest",
          },
          value: Number(order.total),
        });
      }

      // Send order confirmation notification
      if (this.notificationService && order.customerEmail) {
        const user = order.userId
          ? await this.userRepo.findById(order.userId)
          : null;
        await this.notificationService.queueOrderConfirmationEmail(
          order.customerEmail,
          {
            firstName: user?.firstName || "Customer",
            orderId: order.orderNumber,
            orderTotal: Number(order.total),
            currency: order.currency,
            items: order.items.map((item) => ({
              name: item.productName,
              quantity: item.quantity,
              price: Number(item.price),
            })),
            orderUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`,
          }
        );
      }

      // Dispatch webhook event
      if (this.webhookService) {
        await this.webhookService.dispatchEvent({
          eventType: "order.created",
          eventId: `order_${order.id}_created`,
          payload: {
            order: order,
            items: order.items,
          },
          sourceId: order.id,
          sourceType: "order",
          userId: order.userId || undefined,
          metadata: {
            customerType: order.userId ? "registered" : "guest",
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Clear cache for user orders and order statistics
      if (this.cacheService) {
        await Promise.all([
          this.cacheService.delete(`user_orders:${order.userId}`),
          this.cacheService.delete("order_statistics"),
          this.cacheService.delete("recent_orders"),
        ]);
      }
    } catch (error) {
      // Log integration errors but don't fail order creation
      console.error("Order integration error:", error);
    }
  }

  async updateOrder(id: string, input: UpdateOrderInput): Promise<OrderOutput> {
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new Error("Order not found");
    }

    const updateData: Partial<Order> = {};

    if (input.customerPhone !== undefined)
      updateData.customerPhone = input.customerPhone;
    if (input.shippingAddress !== undefined)
      updateData.shippingAddress = input.shippingAddress;
    if (input.billingAddress !== undefined)
      updateData.billingAddress = input.billingAddress;
    if (input.shippingMethod !== undefined)
      updateData.shippingMethod = input.shippingMethod;
    if (input.customerNotes !== undefined)
      updateData.customerNotes = input.customerNotes;
    if (input.adminNotes !== undefined)
      updateData.adminNotes = input.adminNotes;

    const updatedOrder = await this.orderRepo.update(id, updateData);
    if (!updatedOrder) {
      throw new Error("Failed to update order");
    }

    return this.getOrder(id);
  }

  async getOrder(id: string): Promise<OrderOutput> {
    const order = await this.orderRepo.findWithItems(id);
    if (!order) {
      throw new Error("Order not found");
    }

    return this.mapToOutput(order);
  }

  async getOrderByNumber(orderNumber: string): Promise<OrderOutput | null> {
    const order = await this.orderRepo.findByOrderNumber(orderNumber);
    if (!order) return null;

    const orderWithItems = await this.orderRepo.findWithItems(order.id);
    return orderWithItems ? this.mapToOutput(orderWithItems) : null;
  }

  async getUserOrders(userId: string): Promise<OrderOutput[]> {
    const orders = await this.orderRepo.findByUser(userId);

    // Get full order details for each order
    const ordersWithItems = await Promise.all(
      orders.map((order) => this.orderRepo.findWithItems(order.id))
    );

    return ordersWithItems
      .filter((order) => order !== null)
      .map((order) => this.mapToOutput(order!));
  }

  async searchOrders(filters: OrderFilters): Promise<OrderOutput[]> {
    const orders = await this.orderRepo.findWithFilters(filters);

    // Get full order details for each order
    const ordersWithItems = await Promise.all(
      orders.map((order) => this.orderRepo.findWithItems(order.id))
    );

    return ordersWithItems
      .filter((order) => order !== null)
      .map((order) => this.mapToOutput(order!));
  }

  async updateOrderStatus(
    id: string,
    status:
      | "pending"
      | "confirmed"
      | "processing"
      | "shipped"
      | "delivered"
      | "cancelled"
      | "refunded"
      | "returned"
  ): Promise<OrderOutput> {
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new Error("Order not found");
    }

    const oldStatus = order.status;
    const updatedOrder = await this.orderRepo.updateStatus(id, status);
    if (!updatedOrder) {
      throw new Error("Failed to update order status");
    }

    const finalOrder = await this.getOrder(id);

    // Trigger integrations after status update
    await this.handleOrderStatusUpdateIntegrations(
      finalOrder,
      oldStatus,
      status
    );

    return finalOrder;
  }

  private async handleOrderStatusUpdateIntegrations(
    order: OrderOutput,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      // Analytics tracking
      if (this.analyticsService) {
        await this.analyticsService.trackEvent({
          eventType: "ecommerce",
          eventName: "order_status_updated",
          userId: order.userId || undefined,
          properties: {
            orderId: order.id,
            oldStatus,
            newStatus,
            orderTotal: order.total,
            currency: order.currency,
          },
          value: Number(order.total),
        });
      }

      // Send status update notifications
      if (this.notificationService && order.customerEmail) {
        const user = order.userId
          ? await this.userRepo.findById(order.userId)
          : null;

        // Send different notifications based on status
        if (newStatus === "shipped") {
          await this.notificationService.queueEmail(
            "order-shipped",
            {
              firstName: user?.firstName || "Customer",
              orderId: order.orderNumber,
              trackingUrl: `${process.env.FRONTEND_URL}/orders/${order.id}/tracking`,
            },
            { to: order.customerEmail }
          );
        } else if (newStatus === "delivered") {
          await this.notificationService.queueEmail(
            "order-delivered",
            {
              firstName: user?.firstName || "Customer",
              orderId: order.orderNumber,
              orderUrl: `${process.env.FRONTEND_URL}/orders/${order.id}`,
            },
            { to: order.customerEmail }
          );
        }
      }

      // Dispatch webhook event
      if (this.webhookService) {
        await this.webhookService.dispatchEvent({
          eventType: "order.updated",
          eventId: `order_${order.id}_status_${newStatus}`,
          payload: {
            order: order,
            statusChange: {
              from: oldStatus,
              to: newStatus,
            },
          },
          sourceId: order.id,
          sourceType: "order",
          userId: order.userId || undefined,
        });
      }

      // Clear relevant caches
      if (this.cacheService) {
        await Promise.all([
          this.cacheService.delete(`order:${order.id}`),
          this.cacheService.delete(`user_orders:${order.userId}`),
          this.cacheService.delete("order_statistics"),
        ]);
      }
    } catch (error) {
      console.error("Order status update integration error:", error);
    }
  }

  async updatePaymentStatus(
    id: string,
    status: "pending" | "paid" | "failed" | "refunded" | "partially_refunded"
  ): Promise<OrderOutput> {
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new Error("Order not found");
    }

    const updatedOrder = await this.orderRepo.updatePaymentStatus(id, status);
    if (!updatedOrder) {
      throw new Error("Failed to update payment status");
    }

    return this.getOrder(id);
  }

  async updateShippingStatus(
    id: string,
    status:
      | "pending"
      | "processing"
      | "shipped"
      | "in_transit"
      | "delivered"
      | "failed",
    trackingNumber?: string,
    trackingUrl?: string
  ): Promise<OrderOutput> {
    const order = await this.orderRepo.findById(id);
    if (!order) {
      throw new Error("Order not found");
    }

    const updatedOrder = await this.orderRepo.updateShippingStatus(
      id,
      status,
      trackingNumber,
      trackingUrl
    );
    if (!updatedOrder) {
      throw new Error("Failed to update shipping status");
    }

    return this.getOrder(id);
  }

  async addPayment(
    orderId: string,
    paymentData: {
      paymentMethod: string;
      paymentIntentId?: string;
      transactionId?: string;
      amount: number;
      currency?: string;
      gatewayResponse?: any;
    }
  ): Promise<void> {
    const order = await this.orderRepo.findById(orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const payment: NewPayment = {
      orderId,
      paymentMethod: paymentData.paymentMethod,
      paymentIntentId: paymentData.paymentIntentId,
      transactionId: paymentData.transactionId,
      amount: paymentData.amount.toString(),
      currency: paymentData.currency || "USD",
      gatewayResponse: paymentData.gatewayResponse,
    };

    await this.orderRepo.createPayment(payment);
  }

  async getOrderStatistics(
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    ordersByStatus: Record<string, number>;
    ordersByPaymentStatus: Record<string, number>;
  }> {
    return this.orderRepo.getStatistics(dateFrom, dateTo);
  }

  async getRecentOrders(limit: number = 10): Promise<OrderOutput[]> {
    const orders = await this.orderRepo.getRecentOrders(limit);

    const ordersWithItems = await Promise.all(
      orders.map((order) => this.orderRepo.findWithItems(order.id))
    );

    return ordersWithItems
      .filter((order) => order !== null)
      .map((order) => this.mapToOutput(order!));
  }

  private async validateAndCalculateItems(items: OrderItemInput[]): Promise<{
    items: Array<{
      productId: string;
      variantId?: string;
      vendorId: string;
      productName: string;
      productSku: string | null;
      variantTitle?: string;
      price: number;
      quantity: number;
      total: number;
      productSnapshot?: any;
    }>;
    subtotal: number;
  }> {
    const validatedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await this.productRepo.findById(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.productId}`);
      }

      if (product.status !== "active") {
        throw new Error(`Product is not available: ${product.name}`);
      }

      // Check inventory
      if (
        (product.trackQuantity ?? true) &&
        (product.quantity ?? 0) < item.quantity
      ) {
        throw new Error(`Insufficient inventory for product: ${product.name}`);
      }

      const price = Number(product.price);
      const total = price * item.quantity;

      validatedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        vendorId: product.vendorId,
        productName: product.name,
        productSku: product.sku,
        variantTitle: item.variantTitle,
        price,
        quantity: item.quantity,
        total,
        productSnapshot: {
          name: product.name,
          description: product.shortDescription || product.description,
          image:
            Array.isArray(product.images) && product.images.length > 0
              ? product.images[0]
              : undefined,
          attributes: product.attributes,
        },
      });

      subtotal += total;
    }

    return { items: validatedItems, subtotal };
  }

  private async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    return `ORD-${timestamp.slice(-8)}-${random}`;
  }

  private mapToOutput(order: any): OrderOutput {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      shippingStatus: order.shippingStatus,
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      shippingAmount: Number(order.shippingAmount),
      discountAmount: Number(order.discountAmount),
      total: Number(order.total),
      currency: order.currency,
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      shippingMethod: order.shippingMethod,
      trackingNumber: order.trackingNumber,
      trackingUrl: order.trackingUrl,
      customerNotes: order.customerNotes,
      adminNotes: order.adminNotes,
      metadata: order.metadata,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items:
        order.items?.map((item: any) => ({
          id: item.id,
          productId: item.productId,
          variantId: item.variantId,
          vendorId: item.vendorId,
          productName: item.productName,
          productSku: item.productSku,
          variantTitle: item.variantTitle,
          price: Number(item.price),
          quantity: item.quantity,
          total: Number(item.total),
          productSnapshot: item.productSnapshot,
          product: item.product,
          vendor: item.vendor,
        })) || [],
      payments: order.payments || [],
      user: order.user,
    };
  }
}
