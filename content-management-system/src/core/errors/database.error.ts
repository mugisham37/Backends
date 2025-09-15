import { TechnicalError } from "./base.error";

/**
 * Base error for all database-related errors
 */
export class DatabaseError extends TechnicalError {
  public override readonly code: string = "DATABASE_ERROR";
  public override readonly statusCode: number = 500;

  constructor(
    message: string,
    public readonly operation?: string,
    public readonly table?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, cause, {
      operation,
      table,
      ...context,
    });
  }

  /**
   * Create a database error for a specific operation
   */
  static forOperation(
    operation: string,
    table?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ): DatabaseError {
    const message = table
      ? `Database ${operation} operation failed on table '${table}'`
      : `Database ${operation} operation failed`;

    return new DatabaseError(message, operation, table, cause, context);
  }
}

/**
 * Error thrown when database connection fails
 */
export class ConnectionError extends DatabaseError {
  public override readonly code = "DATABASE_CONNECTION_ERROR";
  public override readonly statusCode = 503;

  constructor(
    message: string = "Database connection failed",
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, "connection", undefined, cause, context);
  }

  /**
   * Create a connection timeout error
   */
  static timeout(timeout: number): ConnectionError {
    return new ConnectionError(
      `Database connection timed out after ${timeout}ms`,
      undefined,
      { timeout }
    );
  }

  /**
   * Create a connection pool exhausted error
   */
  static poolExhausted(maxConnections: number): ConnectionError {
    return new ConnectionError(
      `Database connection pool exhausted (max: ${maxConnections})`,
      undefined,
      { maxConnections }
    );
  }
}

/**
 * Error thrown when a database query fails
 */
export class QueryError extends DatabaseError {
  public override readonly code = "DATABASE_QUERY_ERROR";

  constructor(
    message: string,
    public readonly query?: string,
    table?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, "query", table, cause, {
      query,
      ...context,
    });
  }

  /**
   * Create a query syntax error
   */
  static syntax(query: string, cause?: unknown): QueryError {
    return new QueryError(
      "Database query syntax error",
      query,
      undefined,
      cause
    );
  }

  /**
   * Create a query timeout error
   */
  static timeout(query: string, timeout: number): QueryError {
    return new QueryError(
      `Database query timed out after ${timeout}ms`,
      query,
      undefined,
      undefined,
      { timeout }
    );
  }
}

/**
 * Error thrown when a database constraint is violated
 */
export class ConstraintError extends DatabaseError {
  public override readonly code = "DATABASE_CONSTRAINT_ERROR";
  public override readonly statusCode = 409;

  constructor(
    message: string,
    public readonly constraint?: string,
    table?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, "constraint_violation", table, cause, {
      constraint,
      ...context,
    });
  }

  /**
   * Create a unique constraint violation error
   */
  static unique(
    field: string,
    value: unknown,
    table?: string
  ): ConstraintError {
    return new ConstraintError(
      `Unique constraint violation: ${field} '${value}' already exists`,
      `unique_${field}`,
      table,
      undefined,
      { field, value }
    );
  }

  /**
   * Create a foreign key constraint violation error
   */
  static foreignKey(
    field: string,
    value: unknown,
    referencedTable?: string,
    table?: string
  ): ConstraintError {
    const message = referencedTable
      ? `Foreign key constraint violation: ${field} '${value}' does not exist in ${referencedTable}`
      : `Foreign key constraint violation: ${field} '${value}' is invalid`;

    return new ConstraintError(message, `fk_${field}`, table, undefined, {
      field,
      value,
      referencedTable,
    });
  }

  /**
   * Create a check constraint violation error
   */
  static check(
    constraint: string,
    table?: string,
    cause?: unknown
  ): ConstraintError {
    return new ConstraintError(
      `Check constraint violation: ${constraint}`,
      constraint,
      table,
      cause
    );
  }
}

/**
 * Error thrown when a database transaction fails
 */
export class TransactionError extends DatabaseError {
  public override readonly code = "DATABASE_TRANSACTION_ERROR";

  constructor(
    message: string,
    public readonly transactionId?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, "transaction", undefined, cause, {
      transactionId,
      ...context,
    });
  }

  /**
   * Create a transaction rollback error
   */
  static rollback(
    reason: string,
    transactionId?: string,
    cause?: unknown
  ): TransactionError {
    return new TransactionError(
      `Transaction rolled back: ${reason}`,
      transactionId,
      cause
    );
  }

  /**
   * Create a transaction deadlock error
   */
  static deadlock(transactionId?: string): TransactionError {
    return new TransactionError("Transaction deadlock detected", transactionId);
  }

  /**
   * Create a transaction timeout error
   */
  static timeout(timeout: number, transactionId?: string): TransactionError {
    return new TransactionError(
      `Transaction timed out after ${timeout}ms`,
      transactionId,
      undefined,
      { timeout }
    );
  }
}

/**
 * Error thrown when database migration fails
 */
export class MigrationError extends DatabaseError {
  public override readonly code = "DATABASE_MIGRATION_ERROR";

  constructor(
    message: string,
    public readonly migrationName?: string,
    public readonly version?: string,
    cause?: unknown,
    context?: Record<string, unknown>
  ) {
    super(message, "migration", undefined, cause, {
      migrationName,
      version,
      ...context,
    });
  }

  /**
   * Create a migration version conflict error
   */
  static versionConflict(
    currentVersion: string,
    targetVersion: string
  ): MigrationError {
    return new MigrationError(
      `Migration version conflict: current ${currentVersion}, target ${targetVersion}`,
      undefined,
      targetVersion,
      undefined,
      { currentVersion }
    );
  }

  /**
   * Create a migration rollback error
   */
  static rollbackFailed(
    migrationName: string,
    version: string,
    cause?: unknown
  ): MigrationError {
    return new MigrationError(
      `Failed to rollback migration '${migrationName}'`,
      migrationName,
      version,
      cause
    );
  }
}
