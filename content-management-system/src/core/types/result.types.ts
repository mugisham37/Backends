/**
 * Result pattern for type-safe error handling
 * Provides a way to handle errors without throwing exceptions
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Utility type to extract the success data type from a Result
 */
export type ResultData<T> = T extends Result<infer U, any> ? U : never;

/**
 * Utility type to extract the error type from a Result
 */
export type ResultError<T> = T extends Result<any, infer E> ? E : never;

/**
 * Helper functions for working with Result types
 */
export const Result = {
  /**
   * Create a successful result
   */
  success: <T>(data: T): Result<T, never> => ({
    success: true,
    data,
  }),

  /**
   * Create a failed result
   */
  failure: <E>(error: E): Result<never, E> => ({
    success: false,
    error,
  }),

  /**
   * Check if a result is successful
   */
  isSuccess: <T, E>(
    result: Result<T, E>
  ): result is { success: true; data: T } => result.success,

  /**
   * Check if a result is a failure
   */
  isFailure: <T, E>(
    result: Result<T, E>
  ): result is { success: false; error: E } => !result.success,

  /**
   * Map over the success value of a Result
   */
  map: <T, U, E>(result: Result<T, E>, fn: (data: T) => U): Result<U, E> => {
    if (result.success) {
      return Result.success(fn(result.data));
    }
    return result;
  },

  /**
   * Map over the error value of a Result
   */
  mapError: <T, E, F>(
    result: Result<T, E>,
    fn: (error: E) => F
  ): Result<T, F> => {
    if (!result.success) {
      return Result.failure(fn(result.error));
    }
    return result;
  },

  /**
   * Chain Result operations (flatMap)
   */
  chain: <T, U, E>(
    result: Result<T, E>,
    fn: (data: T) => Result<U, E>
  ): Result<U, E> => {
    if (result.success) {
      return fn(result.data);
    }
    return result;
  },

  /**
   * Combine multiple Results into a single Result
   * Returns success only if all Results are successful
   */
  combine: <T extends readonly Result<any, any>[]>(
    results: T
  ): Result<
    { [K in keyof T]: T[K] extends Result<infer U, any> ? U : never },
    T[number] extends Result<any, infer E> ? E : never
  > => {
    const data: any[] = [];

    for (const result of results) {
      if (!result.success) {
        return result as any;
      }
      data.push(result.data);
    }

    return Result.success(data as any);
  },

  /**
   * Convert a Promise to a Result, catching any errors
   */
  fromPromise: async <T>(promise: Promise<T>): Promise<Result<T, Error>> => {
    try {
      const data = await promise;
      return Result.success(data);
    } catch (error) {
      return Result.failure(
        error instanceof Error ? error : new Error(String(error))
      );
    }
  },

  /**
   * Convert a function that might throw to a Result
   */
  fromThrowable:
    <T, Args extends any[]>(fn: (...args: Args) => T) =>
    (...args: Args): Result<T, Error> => {
      try {
        const data = fn(...args);
        return Result.success(data);
      } catch (error) {
        return Result.failure(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

  /**
   * Unwrap a Result, throwing the error if it's a failure
   * Use with caution - prefer pattern matching with success/failure checks
   */
  unwrap: <T, E>(result: Result<T, E>): T => {
    if (result.success) {
      return result.data;
    }
    throw result.error;
  },

  /**
   * Unwrap a Result with a default value for failures
   */
  unwrapOr: <T, E>(result: Result<T, E>, defaultValue: T): T => {
    if (result.success) {
      return result.data;
    }
    return defaultValue;
  },

  /**
   * Unwrap a Result with a function to compute default value for failures
   */
  unwrapOrElse: <T, E>(result: Result<T, E>, fn: (error: E) => T): T => {
    if (result.success) {
      return result.data;
    }
    return fn(result.error);
  },
};

/**
 * Async Result utilities
 */
export const AsyncResult = {
  /**
   * Map over an async Result
   */
  map: async <T, U, E>(
    resultPromise: Promise<Result<T, E>>,
    fn: (data: T) => U | Promise<U>
  ): Promise<Result<U, E>> => {
    const result = await resultPromise;
    if (result.success) {
      const mappedData = await fn(result.data);
      return Result.success(mappedData);
    }
    return result;
  },

  /**
   * Chain async Result operations
   */
  chain: async <T, U, E>(
    resultPromise: Promise<Result<T, E>>,
    fn: (data: T) => Promise<Result<U, E>>
  ): Promise<Result<U, E>> => {
    const result = await resultPromise;
    if (result.success) {
      return fn(result.data);
    }
    return result;
  },
};
