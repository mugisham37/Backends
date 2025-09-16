/**
 * Example demonstrating the new error handling patterns
 * This file shows how to use the centralized error handling system
 */

import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  AppError,
  ValidationError,
  NotFoundError,
  BusinessLogicError,
  asyncHandler,
  withErrorBoundary,
} from "../core/errors/index.js";
import {
  validateBody,
  validateParams,
} from "../core/decorators/validate.decorator.js";
import { createRequestLogger } from "../shared/middleware/request-id.middleware.js";

// Example schemas
const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().min(18).max(120),
});

const userParamsSchema = z.object({
  id: z.string().uuid(),
});

// Example service with error boundary
class UserService {
  // Method with error boundary wrapper
  findById = withErrorBoundary(
    async (id: string) => {
      // Simulate database call
      if (id === "not-found") {
        throw new NotFoundError("User not found");
      }

      if (id === "invalid") {
        throw new Error("Database connection failed"); // Will be converted to AppError
      }

      return { id, name: "John Doe", email: "john@example.com" };
    },
    // Custom error transformer
    (error: Error) => {
      if (error.message.includes("Database")) {
        return new AppError("Database error", 500, "DATABASE_ERROR");
      }
      return new AppError(error.message, 500);
    }
  );

  // Method that throws business logic error
  async updateUser(id: string, data: any) {
    const user = await this.findById(id);

    if (data.age < 18) {
      throw new BusinessLogicError("User must be at least 18 years old");
    }

    // Simulate update
    return { ...user, ...data };
  }
}

// Example controller using new patterns
export class UserController {
  private userService = new UserService();

  // Route handler with async wrapper and validation
  createUser = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Validation is handled by middleware, so body is already validated
      const userData = request.body as z.infer<typeof createUserSchema>;

      // Get logger with request context
      const logger = createRequestLogger(console, request);

      logger.info("Creating new user", { email: userData.email });

      // Business logic that might throw errors
      if (userData.email === "admin@example.com") {
        throw new ValidationError("Admin email not allowed for regular users");
      }

      // Simulate user creation
      const user = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        ...userData,
        createdAt: new Date(),
      };

      logger.info("User created successfully", { userId: user.id });

      reply.status(201).send({
        success: true,
        data: user,
      });
    }
  );

  // Route handler with parameter validation
  getUser = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof userParamsSchema>;

      const logger = createRequestLogger(console, request);
      logger.info("Fetching user", { userId: id });

      const user = await this.userService.findById(id);

      reply.send({
        success: true,
        data: user,
      });
    }
  );

  // Route handler demonstrating business logic error
  updateUser = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as z.infer<typeof userParamsSchema>;
      const updateData = request.body as any;

      const logger = createRequestLogger(console, request);
      logger.info("Updating user", { userId: id });

      const user = await this.userService.updateUser(id, updateData);

      reply.send({
        success: true,
        data: user,
      });
    }
  );
}

// Example route registration with validation middleware
export function registerUserRoutes(fastify: any) {
  const controller = new UserController();

  // POST /users - Create user with body validation
  fastify.post(
    "/users",
    {
      preHandler: [validateBody(createUserSchema)],
    },
    controller.createUser
  );

  // GET /users/:id - Get user with params validation
  fastify.get(
    "/users/:id",
    {
      preHandler: [validateParams(userParamsSchema)],
    },
    controller.getUser
  );

  // PUT /users/:id - Update user with validation
  fastify.put(
    "/users/:id",
    {
      preHandler: [
        validateParams(userParamsSchema),
        validateBody(createUserSchema.partial()),
      ],
    },
    controller.updateUser
  );
}

// Example of manual error handling in service
export class OrderService {
  async processOrder(orderId: string) {
    try {
      // Simulate order processing
      if (orderId === "invalid") {
        throw new ValidationError("Invalid order ID format");
      }

      if (orderId === "not-found") {
        throw new NotFoundError("Order not found");
      }

      if (orderId === "insufficient-stock") {
        throw new BusinessLogicError("Insufficient stock for order items");
      }

      return { orderId, status: "processed" };
    } catch (error) {
      // Re-throw AppErrors as-is
      if (error instanceof AppError) {
        throw error;
      }

      // Convert unknown errors
      throw new AppError(
        "Failed to process order",
        500,
        "ORDER_PROCESSING_ERROR",
        { originalError: (error as Error).message }
      );
    }
  }
}

// Example error responses:

// Validation Error (400):
// {
//   "success": false,
//   "error": {
//     "message": "Validation failed",
//     "code": "VALIDATION_ERROR",
//     "statusCode": 400,
//     "details": [
//       {
//         "field": "email",
//         "message": "Invalid email format",
//         "code": "invalid_string"
//       }
//     ],
//     "timestamp": "2023-12-07T10:30:00.000Z",
//     "correlationId": "req_123456"
//   }
// }

// Not Found Error (404):
// {
//   "success": false,
//   "error": {
//     "message": "User not found",
//     "code": "NOT_FOUND",
//     "statusCode": 404,
//     "timestamp": "2023-12-07T10:30:00.000Z",
//     "correlationId": "req_123456"
//   }
// }

// Business Logic Error (422):
// {
//   "success": false,
//   "error": {
//     "message": "User must be at least 18 years old",
//     "code": "BUSINESS_LOGIC_ERROR",
//     "statusCode": 422,
//     "timestamp": "2023-12-07T10:30:00.000Z",
//     "correlationId": "req_123456"
//   }
// }
