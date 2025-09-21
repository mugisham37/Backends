/**
 * Container exports
 * Central export point for dependency injection
 */

export * from "./registry";

// Service registration helper
import { container } from "./registry";
import { getDatabase } from "../database/connection";

// Repositories
import { UserRepository } from "../repositories/user.repository";
import { VendorRepository } from "../repositories/vendor.repository";
import { ProductRepository } from "../repositories/product.repository";
import { OrderRepository } from "../repositories/order.repository";
import { PaymentRepository } from "../repositories/payment.repository";
import { NotificationRepository } from "../repositories/notification.repository";
import { AnalyticsRepository } from "../repositories/analytics.repository";
import { WebhookRepository } from "../repositories/webhook.repository";

// Services
import { ProductService } from "../../modules/ecommerce/products/product.service";
import { VendorService } from "../../modules/ecommerce/vendors/vendor.service";
import { OrderService } from "../../modules/ecommerce/orders/order.service";
import { PaymentService } from "../../modules/ecommerce/payments/payment.service";
import { AuthService } from "../../modules/auth/auth.service";
import { JWTService } from "../../modules/auth/jwt.service";
import { NotificationService } from "../../modules/notifications/notification.service";
import { EmailService } from "../../modules/notifications/email.service";
import { WebhookService } from "../../modules/webhook/webhook.service";
import { AnalyticsService } from "../../modules/analytics/analytics.service";
import { CacheService } from "../../modules/cache/cache.service";
import { StorageService } from "../../modules/media/storage.service";

// Use Cases
import {
  CreateProductUseCase,
  UpdateProductUseCase,
  GetProductUseCase,
} from "../../modules/ecommerce/products/use-cases";
import {
  CreateVendorUseCase,
  ApproveVendorUseCase,
} from "../../modules/ecommerce/vendors/use-cases";
import {
  CreateOrderUseCase,
  UpdateOrderStatusUseCase,
} from "../../modules/ecommerce/orders/use-cases";

/**
 * Register all services in the container
 */
export function registerServices(): void {
  // Register database
  container.registerInstance("database", getDatabase());

  // Register repositories
  container.registerClass("userRepository", UserRepository, {
    dependencies: ["database"],
  });

  container.registerClass("vendorRepository", VendorRepository, {
    dependencies: ["database"],
  });

  container.registerClass("productRepository", ProductRepository, {
    dependencies: ["database"],
  });

  container.registerClass("orderRepository", OrderRepository, {
    dependencies: ["database"],
  });

  container.registerClass("paymentRepository", PaymentRepository, {
    dependencies: ["database"],
  });

  container.registerClass("notificationRepository", NotificationRepository, {
    dependencies: ["database"],
  });

  container.registerClass("analyticsRepository", AnalyticsRepository, {
    dependencies: ["database"],
  });

  container.registerClass("webhookRepository", WebhookRepository, {
    dependencies: ["database"],
  });

  // Register services with all their dependencies
  container.registerClass("productService", ProductService, {
    dependencies: [
      "productRepository",
      "vendorRepository",
      "notificationService",
      "webhookService",
      "analyticsService",
      "cacheService",
      "storageService",
    ],
  });

  container.registerClass("vendorService", VendorService, {
    dependencies: [
      "vendorRepository",
      "userRepository",
      "notificationService",
      "webhookService",
      "analyticsService",
      "cacheService",
    ],
  });

  container.registerClass("orderService", OrderService, {
    dependencies: [
      "orderRepository",
      "productRepository",
      "userRepository",
      "notificationService",
      "webhookService",
      "analyticsService",
      "cacheService",
    ],
  });

  container.registerClass("paymentService", PaymentService, {
    dependencies: [
      "paymentRepository",
      "orderRepository",
      "userRepository",
      "notificationService",
      "analyticsService",
      "cacheService",
    ],
  });

  // Register additional services
  container.registerClass("notificationService", NotificationService, {
    dependencies: ["emailService"],
  });

  container.registerClass("webhookService", WebhookService, {
    dependencies: ["webhookRepository"],
  });

  container.registerClass("analyticsService", AnalyticsService, {
    dependencies: ["analyticsRepository"],
  });

  container.registerClass("cacheService", CacheService, {
    dependencies: [],
  });

  container.registerClass("storageService", StorageService, {
    dependencies: [],
  });

  container.registerClass("emailService", EmailService, {
    dependencies: [],
  });

  // Register auth services
  container.registerClass("jwtService", JWTService, {
    dependencies: [],
  });

  container.registerClass("authService", AuthService, {
    dependencies: ["database", "jwtService"],
  });

  // Register use cases
  container.registerClass("createProductUseCase", CreateProductUseCase, {
    dependencies: ["productService"],
  });

  container.registerClass("updateProductUseCase", UpdateProductUseCase, {
    dependencies: ["productService"],
  });

  container.registerClass("getProductUseCase", GetProductUseCase, {
    dependencies: ["productService"],
  });

  container.registerClass("createVendorUseCase", CreateVendorUseCase, {
    dependencies: ["vendorService"],
  });

  container.registerClass("approveVendorUseCase", ApproveVendorUseCase, {
    dependencies: ["vendorService"],
  });

  container.registerClass("createOrderUseCase", CreateOrderUseCase, {
    dependencies: ["orderService"],
  });

  container.registerClass(
    "updateOrderStatusUseCase",
    UpdateOrderStatusUseCase,
    {
      dependencies: ["orderService"],
    }
  );
}

/**
 * Get a service from the container
 */
export function getService<T>(name: string): T {
  return container.resolve<T>(name);
}
