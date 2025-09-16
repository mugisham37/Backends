/**
 * Create Order Use Case
 * Application logic for order creation and validation
 */

import { OrderService } from "../order.service";
import { CreateOrderInput, OrderOutput } from "../order.types";

export interface CreateOrderCommand {
  orderData: CreateOrderInput;
}

export class CreateOrderUseCase {
  constructor(private orderService: OrderService) {}

  async execute(command: CreateOrderCommand): Promise<OrderOutput> {
    const { orderData } = command;

    // Validate input
    this.validateInput(orderData);

    // Create order through service
    return this.orderService.createOrder(orderData);
  }

  private validateInput(input: CreateOrderInput): void {
    // Validate customer information
    if (!input.customerEmail || input.customerEmail.trim().length === 0) {
      throw new Error("Customer email is required");
    }

    if (!this.isValidEmail(input.customerEmail)) {
      throw new Error("Invalid customer email format");
    }

    // Validate order items
    if (!input.items || input.items.length === 0) {
      throw new Error("Order must contain at least one item");
    }

    if (input.items.length > 50) {
      throw new Error("Order cannot contain more than 50 items");
    }

    // Validate each item
    input.items.forEach((item, index) => {
      if (!item.productId || item.productId.trim().length === 0) {
        throw new Error(`Item ${index + 1}: Product ID is required`);
      }

      if (!item.quantity || item.quantity <= 0) {
        throw new Error(`Item ${index + 1}: Quantity must be greater than 0`);
      }

      if (item.quantity > 1000) {
        throw new Error(`Item ${index + 1}: Quantity cannot exceed 1000`);
      }
    });

    // Validate addresses
    this.validateAddress(input.billingAddress, "Billing");
    this.validateAddress(input.shippingAddress, "Shipping");

    // Validate amounts
    if (input.taxAmount !== undefined && input.taxAmount < 0) {
      throw new Error("Tax amount cannot be negative");
    }

    if (input.shippingAmount !== undefined && input.shippingAmount < 0) {
      throw new Error("Shipping amount cannot be negative");
    }

    if (input.discountAmount !== undefined && input.discountAmount < 0) {
      throw new Error("Discount amount cannot be negative");
    }

    // Validate currency
    if (input.currency && !this.isValidCurrency(input.currency)) {
      throw new Error("Invalid currency code");
    }
  }

  private validateAddress(address: any, type: string): void {
    if (!address) {
      throw new Error(`${type} address is required`);
    }

    const requiredFields = [
      "firstName",
      "lastName",
      "address1",
      "city",
      "state",
      "postalCode",
      "country",
    ];

    for (const field of requiredFields) {
      if (!address[field] || address[field].trim().length === 0) {
        throw new Error(`${type} address: ${field} is required`);
      }
    }

    // Validate postal code format (basic validation)
    if (address.postalCode && address.postalCode.length > 20) {
      throw new Error(`${type} address: Postal code is too long`);
    }

    // Validate country code (ISO 3166-1 alpha-2)
    if (address.country && address.country.length !== 2) {
      throw new Error(
        `${type} address: Country must be a 2-letter country code`
      );
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidCurrency(currency: string): boolean {
    // Common currency codes (ISO 4217)
    const validCurrencies = [
      "USD",
      "EUR",
      "GBP",
      "CAD",
      "AUD",
      "JPY",
      "CNY",
      "INR",
    ];
    return validCurrencies.includes(currency.toUpperCase());
  }
}
