import { ClientError } from "./base.error";

/**
 * Error thrown when authentication fails
 */
export class AuthenticationError extends ClientError {
  public readonly code = "AUTHENTICATION_ERROR";
  public readonly statusCode = 401;

  /**
   * Create an invalid credentials error
   */
  static invalidCredentials(): AuthenticationError {
    return new AuthenticationError("Invalid email or password");
  }

  /**
   * Create an invalid token error
   */
  static invalidToken(tokenType = "token"): AuthenticationError {
    return new AuthenticationError(`Invalid ${tokenType}`, undefined, {
      tokenType,
    });
  }

  /**
   * Create an expired token error
   */
  static expiredToken(tokenType = "token"): AuthenticationError {
    return new AuthenticationError(`${tokenType} has expired`, undefined, {
      tokenType,
    });
  }

  /**
   * Create a missing token error
   */
  static missingToken(): AuthenticationError {
    return new AuthenticationError("Authentication token is required");
  }

  /**
   * Create an account locked error
   */
  static accountLocked(unlockTime?: Date): AuthenticationError {
    const message = unlockTime
      ? `Account is locked until ${unlockTime.toISOString()}`
      : "Account is locked";

    return new AuthenticationError(message, undefined, { unlockTime });
  }

  /**
   * Create an account disabled error
   */
  static accountDisabled(): AuthenticationError {
    return new AuthenticationError("Account is disabled");
  }
}

/**
 * Error thrown when authorization fails
 */
export class AuthorizationError extends ClientError {
  public readonly code = "AUTHORIZATION_ERROR";
  public readonly statusCode = 403;

  constructor(
    message = "Access denied",
    public readonly requiredPermission?: string,
    public readonly userRole?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      requiredPermission,
      userRole,
      ...context,
    });
  }

  /**
   * Create an insufficient permissions error
   */
  static insufficientPermissions(
    requiredPermission: string,
    userRole?: string
  ): AuthorizationError {
    return new AuthorizationError(
      `Insufficient permissions. Required: ${requiredPermission}`,
      requiredPermission,
      userRole
    );
  }

  /**
   * Create a resource access denied error
   */
  static resourceAccessDenied(
    resource: string,
    action: string
  ): AuthorizationError {
    return new AuthorizationError(
      `Access denied for ${action} on ${resource}`,
      `${action}:${resource}`
    );
  }

  /**
   * Create a tenant access denied error
   */
  static tenantAccessDenied(tenantId: string): AuthorizationError {
    return new AuthorizationError(
      "Access denied to tenant resources",
      undefined,
      undefined,
      undefined,
      { tenantId }
    );
  }

  /**
   * Create an admin only error
   */
  static adminOnly(): AuthorizationError {
    return new AuthorizationError(
      "This action requires administrator privileges",
      "admin"
    );
  }
}
