/**
 * Update Order Status Use Case
 * Application logic for order status transitions
 */

import { OrderService } from "../order.service";
import { OrderOutput } from "../order.types";

export interface UpdateOrderStatusCommand {
  orderId: string;
  newStatus:
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded"
    | "returned";
  updatedBy: string; // User ID who is updating the status
  reason?: string; // Optional reason for status change
}

export class UpdateOrderStatusUseCase {
  constructor(private orderService: OrderService) {}

  async execute(command: UpdateOrderStatusCommand): Promise<OrderOutput> {
    const { orderId, newStatus, updatedBy, reason } = command;

    // Validate input
    this.validateInput(command);

    // Get current order to validate state transition
    const currentOrder = await this.orderService.getOrder(orderId);
    if (!currentOrder) {
      throw new Error("Order not found");
    }

    // Validate status transition
    this.validateStatusTransition(currentOrder.status, newStatus);

    // Update order status through service
    const updatedOrder = await this.orderService.updateOrderStatus(
      orderId,
      newStatus
    );

    // TODO: Send status update notification to customer
    // TODO: Log status change for audit trail
    // TODO: Handle inventory updates for cancellations/returns

    return updatedOrder;
  }

  private validateInput(command: UpdateOrderStatusCommand): void {
    if (!command.orderId || command.orderId.trim().length === 0) {
      throw new Error("Order ID is required");
    }

    if (!command.newStatus || command.newStatus.trim().length === 0) {
      throw new Error("New status is required");
    }

    if (!command.updatedBy || command.updatedBy.trim().length === 0) {
      throw new Error("Updated by user ID is required");
    }

    const validStatuses = [
      "pending",
      "confirmed",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
      "refunded",
      "returned",
    ];

    if (!validStatuses.includes(command.newStatus)) {
      throw new Error(`Invalid status: ${command.newStatus}`);
    }
  }

  private validateStatusTransition(
    currentStatus: string,
    newStatus: string
  ): void {
    // Define valid status transitions
    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered", "returned"],
      delivered: ["returned", "refunded"],
      cancelled: [], // Terminal state
      refunded: [], // Terminal state
      returned: ["refunded"], // Can be refunded after return
    };

    const allowedTransitions = validTransitions[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new Error(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'. ` +
          `Allowed transitions: ${allowedTransitions.join(", ") || "none"}`
      );
    }

    // Additional business rules
    if (newStatus === "delivered" && currentStatus !== "shipped") {
      throw new Error("Order must be shipped before it can be delivered");
    }

    if (
      newStatus === "refunded" &&
      !["delivered", "returned"].includes(currentStatus)
    ) {
      throw new Error(
        "Order must be delivered or returned before it can be refunded"
      );
    }
  }
}
