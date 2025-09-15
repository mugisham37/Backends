import "reflect-metadata";
import type { UserPayload } from "../types";

/**
 * Metadata keys for authentication decorators
 */
export const AUTH_METADATA_KEY = Symbol("auth");
export const ROLES_METADATA_KEY = Symbol("roles");
export const PERMISSIONS_METADATA_KEY = Symbol("permissions");

/**
 * Authentication metadata interface
 */
export interface AuthMetadata {
  required: boolean;
  roles?: string[];
  permissions?: string[];
  allowAnonymous?: boolean;
}

/**
 * Decorator to require authentication for a method or class
 * @param options Authentication options
 */
export function Auth(
  options: Partial<AuthMetadata> = {}
): MethodDecorator & ClassDecorator {
  return function (
    target: any,
    propertyKey?: string | symbol,
    _descriptor?: PropertyDescriptor
  ) {
    const metadata: AuthMetadata = {
      required: true,
      ...options,
    };

    if (propertyKey && _descriptor) {
      // Method decorator
      Reflect.defineMetadata(AUTH_METADATA_KEY, metadata, target, propertyKey);
    } else {
      // Class decorator
      Reflect.defineMetadata(AUTH_METADATA_KEY, metadata, target);
    }
  };
}

/**
 * Decorator to require specific roles for a method or class
 * @param roles Required roles
 */
export function RequireRoles(
  ...roles: string[]
): MethodDecorator & ClassDecorator {
  return Auth({ roles });
}

/**
 * Decorator to require specific permissions for a method or class
 * @param permissions Required permissions
 */
export function RequirePermissions(
  ...permissions: string[]
): MethodDecorator & ClassDecorator {
  return Auth({ permissions });
}

/**
 * Decorator to allow anonymous access (override class-level auth)
 */
export function AllowAnonymous(): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    _descriptor: PropertyDescriptor
  ) {
    const metadata: AuthMetadata = {
      required: false,
      allowAnonymous: true,
    };
    Reflect.defineMetadata(AUTH_METADATA_KEY, metadata, target, propertyKey);
  };
}

/**
 * Decorator to require admin role
 */
export function RequireAdmin(): MethodDecorator & ClassDecorator {
  return RequireRoles("admin");
}

/**
 * Decorator to require owner or admin role
 */
export function RequireOwnerOrAdmin(): MethodDecorator & ClassDecorator {
  return RequireRoles("owner", "admin");
}

/**
 * Decorator to inject the current user into a method parameter
 * @param parameterIndex The index of the parameter to inject
 */
export function CurrentUser(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number
): void {
  const existingTokens =
    Reflect.getMetadata("custom:paramtypes", target, propertyKey) || [];
  existingTokens[parameterIndex] = "CURRENT_USER";
  Reflect.defineMetadata(
    "custom:paramtypes",
    existingTokens,
    target,
    propertyKey
  );
}

/**
 * Decorator to inject the current tenant ID into a method parameter
 */
export function CurrentTenant(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number
): void {
  const existingTokens =
    Reflect.getMetadata("custom:paramtypes", target, propertyKey) || [];
  existingTokens[parameterIndex] = "CURRENT_TENANT";
  Reflect.defineMetadata(
    "custom:paramtypes",
    existingTokens,
    target,
    propertyKey
  );
}

/**
 * Utility functions for working with auth metadata
 */
export class AuthMetadataUtils {
  /**
   * Get authentication metadata from a method or class
   */
  static getAuthMetadata(
    target: any,
    propertyKey?: string | symbol
  ): AuthMetadata | undefined {
    if (propertyKey) {
      // Try method first, then class
      return (
        Reflect.getMetadata(AUTH_METADATA_KEY, target, propertyKey) ||
        Reflect.getMetadata(AUTH_METADATA_KEY, target.constructor)
      );
    }
    return Reflect.getMetadata(AUTH_METADATA_KEY, target);
  }

  /**
   * Check if authentication is required
   */
  static isAuthRequired(target: any, propertyKey?: string | symbol): boolean {
    const metadata = this.getAuthMetadata(target, propertyKey);
    return metadata?.required ?? false;
  }

  /**
   * Check if anonymous access is allowed
   */
  static isAnonymousAllowed(
    target: any,
    propertyKey?: string | symbol
  ): boolean {
    const metadata = this.getAuthMetadata(target, propertyKey);
    return metadata?.allowAnonymous ?? false;
  }

  /**
   * Get required roles
   */
  static getRequiredRoles(
    target: any,
    propertyKey?: string | symbol
  ): string[] {
    const metadata = this.getAuthMetadata(target, propertyKey);
    return metadata?.roles ?? [];
  }

  /**
   * Get required permissions
   */
  static getRequiredPermissions(
    target: any,
    propertyKey?: string | symbol
  ): string[] {
    const metadata = this.getAuthMetadata(target, propertyKey);
    return metadata?.permissions ?? [];
  }

  /**
   * Check if user has required roles
   */
  static hasRequiredRoles(user: UserPayload, requiredRoles: string[]): boolean {
    if (requiredRoles.length === 0) return true;
    return requiredRoles.includes(user.role);
  }

  /**
   * Check if user has required permissions
   */
  static hasRequiredPermissions(
    user: UserPayload,
    requiredPermissions: string[]
  ): boolean {
    if (requiredPermissions.length === 0) return true;
    if (!user.permissions) return false;
    return requiredPermissions.every((permission) =>
      user.permissions!.includes(permission)
    );
  }

  /**
   * Validate user access based on metadata
   */
  static validateAccess(
    user: UserPayload | null,
    target: any,
    propertyKey?: string | symbol
  ): { allowed: boolean; reason?: string } {
    const metadata = this.getAuthMetadata(target, propertyKey);

    if (!metadata || metadata.allowAnonymous) {
      return { allowed: true };
    }

    if (metadata.required && !user) {
      return { allowed: false, reason: "Authentication required" };
    }

    if (!user) {
      return { allowed: true };
    }

    const requiredRoles = metadata.roles ?? [];
    if (
      requiredRoles.length > 0 &&
      !this.hasRequiredRoles(user, requiredRoles)
    ) {
      return {
        allowed: false,
        reason: `Required roles: ${requiredRoles.join(", ")}. User role: ${
          user.role
        }`,
      };
    }

    const requiredPermissions = metadata.permissions ?? [];
    if (
      requiredPermissions.length > 0 &&
      !this.hasRequiredPermissions(user, requiredPermissions)
    ) {
      return {
        allowed: false,
        reason: `Required permissions: ${requiredPermissions.join(", ")}`,
      };
    }

    return { allowed: true };
  }
}

/**
 * Type guard to check if a value is a UserPayload
 */
export function isUserPayload(value: unknown): value is UserPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value &&
    "role" in value
  );
}

/**
 * Extract user information from various sources
 */
export class UserExtractor {
  /**
   * Extract user from request context
   */
  static fromRequest(request: any): UserPayload | null {
    // Try different common patterns
    if (request.user && isUserPayload(request.user)) {
      return request.user;
    }

    if (request.auth && isUserPayload(request.auth)) {
      return request.auth;
    }

    if (request.context?.user && isUserPayload(request.context.user)) {
      return request.context.user;
    }

    return null;
  }

  /**
   * Extract tenant ID from user or request
   */
  static getTenantId(user: UserPayload | null, request?: any): string | null {
    if (user?.tenantId) {
      return user.tenantId;
    }

    if (request?.tenantId) {
      return request.tenantId;
    }

    if (request?.headers?.["x-tenant-id"]) {
      return request.headers["x-tenant-id"];
    }

    return null;
  }
}
