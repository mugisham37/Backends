import { BusinessError } from "./base.error";

/**
 * Error thrown when a business rule is violated
 */
export class BusinessRuleError extends BusinessError {
  public readonly code = "BUSINESS_RULE_ERROR";
  public readonly statusCode = 422;

  constructor(
    message: string,
    public readonly rule?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      rule,
      ...context,
    });
  }

  /**
   * Create a business rule error for a specific rule
   */
  static forRule(
    rule: string,
    message: string,
    context?: Record<string, unknown>
  ): BusinessRuleError {
    return new BusinessRuleError(message, rule, undefined, context);
  }
}

/**
 * Error thrown when a resource conflict occurs
 */
export class ConflictError extends BusinessError {
  public readonly code = "CONFLICT_ERROR";
  public readonly statusCode = 409;

  constructor(
    message: string,
    public readonly resource?: string,
    public readonly conflictType?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      resource,
      conflictType,
      ...context,
    });
  }

  /**
   * Create a duplicate resource error
   */
  static duplicate(
    resource: string,
    identifier: string | number
  ): ConflictError {
    return new ConflictError(
      `${resource} with identifier '${identifier}' already exists`,
      resource,
      "duplicate",
      undefined,
      { identifier }
    );
  }

  /**
   * Create a resource in use error
   */
  static inUse(
    resource: string,
    identifier: string | number,
    usedBy?: string
  ): ConflictError {
    const message = usedBy
      ? `${resource} '${identifier}' is currently in use by ${usedBy}`
      : `${resource} '${identifier}' is currently in use`;

    return new ConflictError(message, resource, "in_use", undefined, {
      identifier,
      usedBy,
    });
  }

  /**
   * Create a version conflict error
   */
  static version(
    resource: string,
    expectedVersion: number,
    actualVersion: number
  ): ConflictError {
    return new ConflictError(
      `Version conflict for ${resource}. Expected: ${expectedVersion}, Actual: ${actualVersion}`,
      resource,
      "version",
      undefined,
      { expectedVersion, actualVersion }
    );
  }
}

/**
 * Error thrown when a resource has reached its limit
 */
export class LimitExceededError extends BusinessError {
  public readonly code = "LIMIT_EXCEEDED_ERROR";
  public readonly statusCode = 429;

  constructor(
    message: string,
    public readonly limitType?: string,
    public readonly limit?: number,
    public readonly current?: number,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      limitType,
      limit,
      current,
      ...context,
    });
  }

  /**
   * Create a rate limit exceeded error
   */
  static rateLimit(
    limit: number,
    windowMs: number,
    current?: number
  ): LimitExceededError {
    return new LimitExceededError(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      "rate_limit",
      limit,
      current,
      undefined,
      { windowMs }
    );
  }

  /**
   * Create a quota exceeded error
   */
  static quota(
    resource: string,
    limit: number,
    current: number
  ): LimitExceededError {
    return new LimitExceededError(
      `${resource} quota exceeded: ${current}/${limit}`,
      "quota",
      limit,
      current,
      undefined,
      { resource }
    );
  }

  /**
   * Create a file size limit exceeded error
   */
  static fileSize(maxSize: number, actualSize: number): LimitExceededError {
    return new LimitExceededError(
      `File size limit exceeded: ${actualSize} bytes (max: ${maxSize} bytes)`,
      "file_size",
      maxSize,
      actualSize
    );
  }
}

/**
 * Error thrown when a precondition is not met
 */
export class PreconditionError extends BusinessError {
  public readonly code = "PRECONDITION_ERROR";
  public readonly statusCode = 412;

  constructor(
    message: string,
    public readonly condition?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      condition,
      ...context,
    });
  }

  /**
   * Create a precondition failed error
   */
  static failed(
    condition: string,
    context?: Record<string, unknown>
  ): PreconditionError {
    return new PreconditionError(
      `Precondition failed: ${condition}`,
      condition,
      undefined,
      context
    );
  }

  /**
   * Create a state transition error
   */
  static invalidStateTransition(
    fromState: string,
    toState: string,
    resource?: string
  ): PreconditionError {
    const message = resource
      ? `Invalid state transition for ${resource}: ${fromState} -> ${toState}`
      : `Invalid state transition: ${fromState} -> ${toState}`;

    return new PreconditionError(message, "state_transition", undefined, {
      fromState,
      toState,
      resource,
    });
  }
}
