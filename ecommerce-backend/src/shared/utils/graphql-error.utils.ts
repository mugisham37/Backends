/**
 * GraphQL Error Utilities
 * Handles error formatting and logging for GraphQL operations
 */

import { GraphQLError, GraphQLFormattedError } from "graphql";
import { logger } from "./logger";

export interface CustomGraphQLError extends GraphQLError {
  extensions: {
    code?: string;
    statusCode?: number;
    details?: any;
  };
}

// Format GraphQL errors for client response
export const formatError = (error: GraphQLError): GraphQLFormattedError => {
  // Log the error for debugging
  logger.error("GraphQL Error occurred", {
    message: error.message,
    locations: error.locations,
    path: error.path,
    extensions: error.extensions,
    stack: error.stack,
  });

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === "production") {
    // Check if it's a known application error
    if (error.extensions?.code) {
      return {
        message: error.message,
        locations: error.locations,
        path: error.path,
        extensions: {
          code: error.extensions.code,
          statusCode: error.extensions.statusCode || 400,
        },
      };
    }

    // For unknown errors, return generic message
    return {
      message: "Internal server error",
      locations: error.locations,
      path: error.path,
      extensions: {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      },
    };
  }

  // In development, return full error details
  return {
    message: error.message,
    locations: error.locations,
    path: error.path,
    extensions: error.extensions,
  };
};

// Common error codes
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",

  // Not Found
  USER_NOT_FOUND: "USER_NOT_FOUND",
  VENDOR_NOT_FOUND: "VENDOR_NOT_FOUND",
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",

  // Conflict
  EMAIL_EXISTS: "EMAIL_EXISTS",
  SKU_EXISTS: "SKU_EXISTS",
  SLUG_EXISTS: "SLUG_EXISTS",

  // Business Logic
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  VENDOR_NOT_APPROVED: "VENDOR_NOT_APPROVED",
  INSUFFICIENT_INVENTORY: "INSUFFICIENT_INVENTORY",

  // System
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

// Helper functions to create common errors
export const createAuthenticationError = (
  message = "Authentication required"
) => {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.UNAUTHENTICATED,
      statusCode: 401,
    },
  });
};

export const createAuthorizationError = (
  message = "Insufficient permissions"
) => {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.FORBIDDEN,
      statusCode: 403,
    },
  });
};

export const createValidationError = (message: string, details?: any) => {
  return new GraphQLError(message, {
    extensions: {
      code: ErrorCodes.VALIDATION_ERROR,
      statusCode: 400,
      details,
    },
  });
};

export const createNotFoundError = (resource: string, code?: string) => {
  return new GraphQLError(`${resource} not found`, {
    extensions: {
      code: code || ErrorCodes.USER_NOT_FOUND,
      statusCode: 404,
    },
  });
};

export const createConflictError = (message: string, code: string) => {
  return new GraphQLError(message, {
    extensions: {
      code,
      statusCode: 409,
    },
  });
};
