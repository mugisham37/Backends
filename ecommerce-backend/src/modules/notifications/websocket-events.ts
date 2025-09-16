import { websocketService } from "./websocket.service";
import type { WebSocketMessage } from "./websocket.service";

export interface OrderUpdateEvent {
  orderId: string;
  status: string;
  userId: string;
  vendorId?: string;
  details?: any;
}

export interface ProductUpdateEvent {
  productId: string;
  vendorId: string;
  type: "created" | "updated" | "deleted" | "stock_changed";
  details?: any;
}

export interface VendorUpdateEvent {
  vendorId: string;
  type: "status_changed" | "profile_updated" | "payout_processed";
  details?: any;
}

export interface SystemAlertEvent {
  type: "maintenance" | "security" | "performance" | "error";
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  details?: any;
}

export interface NotificationEvent {
  userId: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  priority: "low" | "medium" | "high";
}

/**
 * WebSocket Event Handlers
 * Handles real-time events and broadcasts them to appropriate clients
 */
export class WebSocketEventHandlers {
  constructor() {
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for various system events
   */
  private setupEventListeners(): void {
    // Listen to WebSocket service events
    websocketService.on("connection", this.handleNewConnection.bind(this));
    websocketService.on("disconnection", this.handleDisconnection.bind(this));
    websocketService.on("message", this.handleCustomMessage.bind(this));
  }

  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(event: any): void {
    const { user } = event;

    console.log(`New WebSocket connection: ${user.id} (${user.role})`);

    // Send user-specific welcome data
    this.sendWelcomeData(user.id);

    // Notify admins of new connections (if needed)
    if (user.role === "vendor") {
      this.notifyAdminsOfVendorConnection(user);
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(event: any): void {
    const { user } = event;
    console.log(`WebSocket disconnected: ${user?.id} (${user?.role})`);
  }

  /**
   * Handle custom WebSocket messages
   */
  private handleCustomMessage(event: any): void {
    const { ws, message } = event;

    // Handle custom message types here
    switch (message.type) {
      case "dashboard.request_data":
        this.handleDashboardDataRequest(ws, message.payload);
        break;

      case "order.track":
        this.handleOrderTrackingRequest(ws, message.payload);
        break;

      default:
        console.log(`Unhandled WebSocket message type: ${message.type}`);
    }
  }

  /**
   * Send welcome data to newly connected user
   */
  private sendWelcomeData(userId: string): void {
    // This would typically fetch user-specific data
    const welcomeMessage: WebSocketMessage = {
      type: "welcome.data",
      payload: {
        unreadNotifications: 0, // Would fetch from database
        pendingOrders: 0, // Would fetch from database
        systemStatus: "operational",
      },
    };

    websocketService.sendToUser(userId, welcomeMessage);
  }

  /**
   * Notify admins of vendor connection
   */
  private notifyAdminsOfVendorConnection(vendor: any): void {
    const message: WebSocketMessage = {
      type: "admin.vendor_connected",
      payload: {
        vendorId: vendor.id,
        vendorEmail: vendor.email,
        timestamp: new Date().toISOString(),
      },
    };

    websocketService.sendToRole("admin", message);
  }

  /**
   * Handle dashboard data request
   */
  private handleDashboardDataRequest(ws: any, _payload: any): void {
    // This would fetch real-time dashboard data
    const dashboardData = {
      metrics: {
        totalOrders: 150,
        revenue: 25000,
        activeUsers: 45,
        conversionRate: 3.2,
      },
      recentActivity: [
        {
          type: "order",
          message: "New order #1234",
          timestamp: new Date().toISOString(),
        },
        {
          type: "user",
          message: "New user registration",
          timestamp: new Date().toISOString(),
        },
      ],
    };

    websocketService.sendToConnection(ws, {
      type: "dashboard.data",
      payload: dashboardData,
    });
  }

  /**
   * Handle order tracking request
   */
  private handleOrderTrackingRequest(ws: any, payload: any): void {
    const { orderId } = payload;

    // This would fetch real-time order status
    const orderStatus = {
      orderId,
      status: "in_transit",
      location: "Distribution Center",
      estimatedDelivery: new Date(
        Date.now() + 2 * 24 * 60 * 60 * 1000
      ).toISOString(),
      trackingEvents: [
        {
          status: "ordered",
          timestamp: new Date(
            Date.now() - 3 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        {
          status: "processing",
          timestamp: new Date(
            Date.now() - 2 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        {
          status: "shipped",
          timestamp: new Date(
            Date.now() - 1 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
        { status: "in_transit", timestamp: new Date().toISOString() },
      ],
    };

    websocketService.sendToConnection(ws, {
      type: "order.tracking_update",
      payload: orderStatus,
    });
  }

  // Event Broadcasting Methods

  /**
   * Broadcast order update to relevant users
   */
  public broadcastOrderUpdate(event: OrderUpdateEvent): void {
    const message: WebSocketMessage = {
      type: "order.updated",
      payload: event,
    };

    // Send to customer
    websocketService.sendToUser(event.userId, message);

    // Send to vendor if applicable
    if (event.vendorId) {
      websocketService.sendToUser(event.vendorId, message);
    }

    // Send to admins
    websocketService.sendToRole("admin", message);

    console.log(
      `Broadcasted order update: ${event.orderId} -> ${event.status}`
    );
  }

  /**
   * Broadcast product update to relevant users
   */
  public broadcastProductUpdate(event: ProductUpdateEvent): void {
    const message: WebSocketMessage = {
      type: "product.updated",
      payload: event,
    };

    // Send to vendor
    websocketService.sendToUser(event.vendorId, message);

    // Send to admins
    websocketService.sendToRole("admin", message);

    // Broadcast to customers subscribed to product updates
    websocketService.sendToChannel("products.updates", message);

    console.log(
      `Broadcasted product update: ${event.productId} -> ${event.type}`
    );
  }

  /**
   * Broadcast vendor update to relevant users
   */
  public broadcastVendorUpdate(event: VendorUpdateEvent): void {
    const message: WebSocketMessage = {
      type: "vendor.updated",
      payload: event,
    };

    // Send to vendor
    websocketService.sendToUser(event.vendorId, message);

    // Send to admins
    websocketService.sendToRole("admin", message);

    console.log(
      `Broadcasted vendor update: ${event.vendorId} -> ${event.type}`
    );
  }

  /**
   * Broadcast system alert to all users or specific roles
   */
  public broadcastSystemAlert(event: SystemAlertEvent): void {
    const message: WebSocketMessage = {
      type: "system.alert",
      payload: event,
    };

    // Broadcast based on severity
    switch (event.severity) {
      case "critical":
        // Send to all connected users
        websocketService.broadcast(message);
        break;

      case "high":
        // Send to admins and vendors
        websocketService.sendToRole("admin", message);
        websocketService.sendToRole("vendor", message);
        break;

      case "medium":
        // Send to admins only
        websocketService.sendToRole("admin", message);
        break;

      case "low":
        // Send to super admins only
        websocketService.sendToRole("super_admin", message);
        break;
    }

    console.log(`Broadcasted system alert: ${event.type} (${event.severity})`);
  }

  /**
   * Send notification to specific user
   */
  public sendNotification(event: NotificationEvent): void {
    const message: WebSocketMessage = {
      type: "notification.new",
      payload: event,
    };

    websocketService.sendToUser(event.userId, message);

    // Also send to user-specific channel
    websocketService.sendToChannel(
      `user.${event.userId}.notifications`,
      message
    );

    console.log(`Sent notification to user ${event.userId}: ${event.title}`);
  }

  /**
   * Broadcast live dashboard updates
   */
  public broadcastDashboardUpdate(data: any, targetRole?: string): void {
    const message: WebSocketMessage = {
      type: "dashboard.live_update",
      payload: data,
    };

    if (targetRole) {
      websocketService.sendToRole(targetRole, message);
    } else {
      // Send to all admin roles
      websocketService.sendToRole("admin", message);
      websocketService.sendToRole("super_admin", message);
    }

    console.log(`Broadcasted dashboard update to ${targetRole || "admins"}`);
  }

  /**
   * Send real-time metrics update
   */
  public sendMetricsUpdate(metrics: any, targetUsers?: string[]): void {
    const message: WebSocketMessage = {
      type: "metrics.update",
      payload: metrics,
    };

    if (targetUsers) {
      targetUsers.forEach((userId) => {
        websocketService.sendToUser(userId, message);
      });
    } else {
      // Send to all admin and vendor roles
      websocketService.sendToRole("admin", message);
      websocketService.sendToRole("vendor", message);
    }

    console.log("Sent metrics update");
  }

  /**
   * Broadcast inventory update
   */
  public broadcastInventoryUpdate(
    productId: string,
    vendorId: string,
    stock: number
  ): void {
    const message: WebSocketMessage = {
      type: "inventory.updated",
      payload: {
        productId,
        vendorId,
        stock,
        timestamp: new Date().toISOString(),
      },
    };

    // Send to vendor
    websocketService.sendToUser(vendorId, message);

    // Send to admins
    websocketService.sendToRole("admin", message);

    // Broadcast to customers subscribed to product updates
    websocketService.sendToChannel("products.updates", message);

    console.log(`Broadcasted inventory update: ${productId} -> ${stock} units`);
  }
}
