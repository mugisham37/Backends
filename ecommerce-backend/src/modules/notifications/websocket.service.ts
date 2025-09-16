import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage } from "http";
import { URL } from "url";
import jwt from "jsonwebtoken";
import { EventEmitter } from "events";
import type { Server } from "http";

export interface WebSocketUser {
  id: string;
  role: string;
  email: string;
}

export interface AuthenticatedWebSocket extends WebSocket {
  user?: WebSocketUser;
  userId?: string;
  subscriptions?: Set<string>;
  lastPing?: number;
}

export interface WebSocketMessage {
  type: string;
  payload?: any;
  timestamp?: number;
  id?: string;
}

export interface ConnectionStats {
  totalConnections: number;
  authenticatedConnections: number;
  connectionsByRole: Record<string, number>;
  uptime: number;
}

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private connections = new Map<string, AuthenticatedWebSocket>();
  private userConnections = new Map<string, Set<AuthenticatedWebSocket>>();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly CONNECTION_TIMEOUT = 60000; // 60 seconds
  private startTime = Date.now();

  constructor(
    private jwtSecret: string = process.env.JWT_ACCESS_SECRET ||
      "default-secret"
  ) {
    super();
    this.setupEventHandlers();
  }

  /**
   * Initialize WebSocket server
   */
  public initialize(server: Server, path = "/ws"): void {
    this.wss = new WebSocketServer({
      server,
      path,
      verifyClient: this.verifyClient.bind(this),
    });

    this.wss.on("connection", this.handleConnection.bind(this));
    this.startPingInterval();

    console.log(`WebSocket server initialized on path: ${path}`);
  }

  /**
   * Verify client connection and authenticate
   */
  private verifyClient(info: {
    origin: string;
    secure: boolean;
    req: IncomingMessage;
  }): boolean {
    try {
      const url = new URL(
        info.req.url || "",
        `http://${info.req.headers.host}`
      );
      const token = url.searchParams.get("token");

      if (!token) {
        console.warn("WebSocket connection rejected: No token provided");
        return false;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, this.jwtSecret) as any;

      // Store user info in request for later use
      (info.req as any).user = {
        id: decoded.id || decoded.userId,
        role: decoded.role,
        email: decoded.email,
      };

      return true;
    } catch (error) {
      console.warn("WebSocket connection rejected: Invalid token", error);
      return false;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(
    ws: AuthenticatedWebSocket,
    req: IncomingMessage
  ): void {
    const user = (req as any).user as WebSocketUser;
    const connectionId = this.generateConnectionId();

    // Set up connection properties
    ws.user = user;
    ws.userId = user.id;
    ws.subscriptions = new Set();
    ws.lastPing = Date.now();

    // Store connection
    this.connections.set(connectionId, ws);

    // Store user connection mapping
    if (!this.userConnections.has(user.id)) {
      this.userConnections.set(user.id, new Set());
    }
    this.userConnections.get(user.id)!.add(ws);

    console.log(
      `WebSocket connected: User ${user.id} (${user.role}), Total connections: ${this.connections.size}`
    );

    // Set up event handlers
    ws.on("message", (data) => this.handleMessage(ws, data, connectionId));
    ws.on("close", () => this.handleDisconnection(ws, connectionId));
    ws.on("error", (error) => this.handleError(ws, error, connectionId));
    ws.on("pong", () => {
      ws.lastPing = Date.now();
    });

    // Send welcome message
    this.sendToConnection(ws, {
      type: "connection.established",
      payload: {
        connectionId,
        user: {
          id: user.id,
          role: user.role,
        },
        serverTime: new Date().toISOString(),
      },
    });

    // Emit connection event
    this.emit("connection", { user, connectionId, ws });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(
    ws: AuthenticatedWebSocket,
    data: Buffer,
    connectionId: string
  ): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());

      console.log(`WebSocket message from ${ws.userId}: ${message.type}`);

      switch (message.type) {
        case "ping":
          this.sendToConnection(ws, { type: "pong", timestamp: Date.now() });
          break;

        case "subscribe":
          this.handleSubscription(ws, message.payload?.channel);
          break;

        case "unsubscribe":
          this.handleUnsubscription(ws, message.payload?.channel);
          break;

        case "notification.mark_read":
          this.handleMarkNotificationRead(ws, message.payload);
          break;

        default:
          // Emit custom message event for other handlers
          this.emit("message", { ws, message, connectionId });
      }
    } catch (error) {
      console.error(
        `Error parsing WebSocket message from ${ws.userId}:`,
        error
      );
      this.sendToConnection(ws, {
        type: "error",
        payload: { message: "Invalid message format" },
      });
    }
  }

  /**
   * Handle subscription to channels
   */
  private handleSubscription(
    ws: AuthenticatedWebSocket,
    channel: string
  ): void {
    if (!channel || !ws.subscriptions) return;

    // Validate channel access based on user role
    if (!this.canAccessChannel(ws.user!, channel)) {
      this.sendToConnection(ws, {
        type: "subscription.error",
        payload: { channel, error: "Access denied" },
      });
      return;
    }

    ws.subscriptions.add(channel);
    this.sendToConnection(ws, {
      type: "subscription.confirmed",
      payload: { channel },
    });

    console.log(`User ${ws.userId} subscribed to channel: ${channel}`);
  }

  /**
   * Handle unsubscription from channels
   */
  private handleUnsubscription(
    ws: AuthenticatedWebSocket,
    channel: string
  ): void {
    if (!channel || !ws.subscriptions) return;

    ws.subscriptions.delete(channel);
    this.sendToConnection(ws, {
      type: "subscription.removed",
      payload: { channel },
    });

    console.log(`User ${ws.userId} unsubscribed from channel: ${channel}`);
  }

  /**
   * Handle marking notification as read
   */
  private handleMarkNotificationRead(
    ws: AuthenticatedWebSocket,
    payload: any
  ): void {
    if (!payload?.notificationId) return;

    // Emit event for notification service to handle
    this.emit("notification.mark_read", {
      userId: ws.userId,
      notificationId: payload.notificationId,
    });
  }

  /**
   * Handle WebSocket disconnection
   */
  private handleDisconnection(
    ws: AuthenticatedWebSocket,
    connectionId: string
  ): void {
    console.log(
      `WebSocket disconnected: User ${ws.userId}, Connection ${connectionId}`
    );

    // Remove from connections
    this.connections.delete(connectionId);

    // Remove from user connections
    if (ws.userId && this.userConnections.has(ws.userId)) {
      const userConnections = this.userConnections.get(ws.userId)!;
      userConnections.delete(ws);

      if (userConnections.size === 0) {
        this.userConnections.delete(ws.userId);
      }
    }

    // Emit disconnection event
    this.emit("disconnection", { user: ws.user, connectionId });
  }

  /**
   * Handle WebSocket errors
   */
  private handleError(
    ws: AuthenticatedWebSocket,
    error: Error,
    connectionId: string
  ): void {
    console.error(`WebSocket error for connection ${connectionId}:`, error);
    this.emit("error", { ws, error, connectionId });
  }

  /**
   * Send message to specific connection
   */
  public sendToConnection(ws: WebSocket, message: WebSocketMessage): boolean {
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      ws.send(
        JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now(),
          id: message.id || this.generateMessageId(),
        })
      );
      return true;
    } catch (error) {
      console.error("Error sending WebSocket message:", error);
      return false;
    }
  }

  /**
   * Send message to specific user (all their connections)
   */
  public sendToUser(userId: string, message: WebSocketMessage): number {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let sentCount = 0;
    for (const ws of userConnections) {
      if (this.sendToConnection(ws, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * Broadcast message to all connections
   */
  public broadcast(
    message: WebSocketMessage,
    filter?: (ws: AuthenticatedWebSocket) => boolean
  ): number {
    let sentCount = 0;

    for (const ws of this.connections.values()) {
      if (!filter || filter(ws)) {
        if (this.sendToConnection(ws, message)) {
          sentCount++;
        }
      }
    }

    return sentCount;
  }

  /**
   * Send message to channel subscribers
   */
  public sendToChannel(channel: string, message: WebSocketMessage): number {
    return this.broadcast(message, (ws) => {
      return ws.subscriptions?.has(channel) || false;
    });
  }

  /**
   * Send message to users with specific role
   */
  public sendToRole(role: string, message: WebSocketMessage): number {
    return this.broadcast(message, (ws) => {
      return ws.user?.role === role;
    });
  }

  /**
   * Check if user can access channel
   */
  private canAccessChannel(user: WebSocketUser, channel: string): boolean {
    // Define channel access rules
    const channelRules: Record<string, string[]> = {
      "admin.notifications": ["admin", "super_admin"],
      "vendor.notifications": ["vendor", "admin", "super_admin"],
      "customer.notifications": ["customer", "vendor", "admin", "super_admin"],
      "orders.updates": ["customer", "vendor", "admin", "super_admin"],
      "system.alerts": ["admin", "super_admin"],
    };

    // User-specific channels
    if (channel.startsWith(`user.${user.id}.`)) {
      return true;
    }

    // Role-based channels
    const allowedRoles = channelRules[channel];
    return allowedRoles ? allowedRoles.includes(user.role) : false;
  }

  /**
   * Start ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const connectionsToClose: string[] = [];

      for (const [connectionId, ws] of this.connections) {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if connection is stale
          if (ws.lastPing && now - ws.lastPing > this.CONNECTION_TIMEOUT) {
            connectionsToClose.push(connectionId);
          } else {
            // Send ping
            ws.ping();
          }
        } else {
          connectionsToClose.push(connectionId);
        }
      }

      // Close stale connections
      for (const connectionId of connectionsToClose) {
        const ws = this.connections.get(connectionId);
        if (ws) {
          console.log(`Closing stale WebSocket connection: ${connectionId}`);
          ws.terminate();
          this.handleDisconnection(ws, connectionId);
        }
      }
    }, this.PING_INTERVAL);
  }

  /**
   * Get connection statistics
   */
  public getStats(): ConnectionStats {
    const connectionsByRole: Record<string, number> = {};
    let authenticatedConnections = 0;

    for (const ws of this.connections.values()) {
      if (ws.user) {
        authenticatedConnections++;
        connectionsByRole[ws.user.role] =
          (connectionsByRole[ws.user.role] || 0) + 1;
      }
    }

    return {
      totalConnections: this.connections.size,
      authenticatedConnections,
      connectionsByRole,
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Get connected users
   */
  public getConnectedUsers(): string[] {
    return Array.from(this.userConnections.keys());
  }

  /**
   * Check if user is connected
   */
  public isUserConnected(userId: string): boolean {
    return this.userConnections.has(userId);
  }

  /**
   * Disconnect user (all their connections)
   */
  public disconnectUser(userId: string, reason = "Server disconnect"): number {
    const userConnections = this.userConnections.get(userId);
    if (!userConnections) return 0;

    let disconnectedCount = 0;
    for (const ws of userConnections) {
      this.sendToConnection(ws, {
        type: "connection.terminated",
        payload: { reason },
      });
      ws.close(1000, reason);
      disconnectedCount++;
    }

    return disconnectedCount;
  }

  /**
   * Setup event handlers for service events
   */
  private setupEventHandlers(): void {
    // Handle graceful shutdown
    process.on("SIGTERM", () => this.shutdown());
    process.on("SIGINT", () => this.shutdown());
  }

  /**
   * Graceful shutdown
   */
  public shutdown(): void {
    console.log("Shutting down WebSocket service...");

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all connections
    for (const ws of this.connections.values()) {
      this.sendToConnection(ws, {
        type: "connection.terminated",
        payload: { reason: "Server shutdown" },
      });
      ws.close(1000, "Server shutdown");
    }

    if (this.wss) {
      this.wss.close();
    }

    console.log("WebSocket service shutdown complete");
  }

  /**
   * Generate unique connection ID
   */
  private generateConnectionId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
