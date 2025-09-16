import { logger } from "./logger"

// Circuit breaker states
enum CircuitState {
  CLOSED = 0,
  OPEN = 1,
  HALF_OPEN = 2,
}

// Circuit breaker options
interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
  halfOpenSuccessThreshold: number
  timeout?: number
  monitorCallback?: (state: CircuitState) => void
}

// Default options
const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenSuccessThreshold: 2,
  timeout: 10000, // 10 seconds
}

// Circuit breaker implementation
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private options: CircuitBreakerOptions
  private name: string

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  // Execute a function with circuit breaker protection
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      // Circuit is open, check if we should try half-open state
      if (this.shouldAttemptHalfOpen()) {
        return this.attemptHalfOpen(fn)
      }

      // Circuit is open and not ready for half-open, reject immediately
      const error = new Error(`Circuit breaker ${this.name} is open`)
      error.name = "CircuitBreakerOpenError"
      throw error
    }

    // Circuit is closed or half-open, execute the function
    try {
      // If timeout is set, wrap the function with a timeout
      const result = this.options.timeout ? await this.executeWithTimeout(fn, this.options.timeout) : await fn()

      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  // Check if circuit is open
  private isOpen(): boolean {
    return this.state === CircuitState.OPEN
  }

  // Check if we should attempt half-open state
  private shouldAttemptHalfOpen(): boolean {
    const now = Date.now()
    return now - this.lastFailureTime >= this.options.resetTimeout
  }

  // Attempt half-open state
  private async attemptHalfOpen<T>(fn: () => Promise<T>): Promise<T> {
    this.state = CircuitState.HALF_OPEN
    this.notifyStateChange()
    logger.info(`Circuit breaker ${this.name} is half-open`)

    try {
      const result = this.options.timeout ? await this.executeWithTimeout(fn, this.options.timeout) : await fn()

      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure(error)
      throw error
    }
  }

  // Handle success
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++

      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        this.reset()
      }
    }
  }

  // Handle failure
  private onFailure(error: any): void {
    this.lastFailureTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.tripBreaker()
      return
    }

    this.failureCount++

    if (this.failureCount >= this.options.failureThreshold) {
      this.tripBreaker()
    }

    logger.error(`Circuit breaker ${this.name} failure:`, error)
  }

  // Trip the circuit breaker
  private tripBreaker(): void {
    this.state = CircuitState.OPEN
    this.notifyStateChange()
    logger.warn(`Circuit breaker ${this.name} is open`)
  }

  // Reset the circuit breaker
  private reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.notifyStateChange()
    logger.info(`Circuit breaker ${this.name} is closed`)
  }

  // Execute a function with a timeout
  private executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Circuit breaker ${this.name} timeout after ${timeout}ms`))
      }, timeout)

      fn()
        .then((result) => {
          clearTimeout(timeoutId)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  // Notify state change
  private notifyStateChange(): void {
    if (this.options.monitorCallback) {
      this.options.monitorCallback(this.state)
    }
  }

  // Get current state
  getState(): string {
    switch (this.state) {
      case CircuitState.CLOSED:
        return "CLOSED"
      case CircuitState.OPEN:
        return "OPEN"
      case CircuitState.HALF_OPEN:
        return "HALF_OPEN"
      default:
        return "UNKNOWN"
    }
  }

  // Get failure count
  getFailureCount(): number {
    return this.failureCount
  }

  // Get success count
  getSuccessCount(): number {
    return this.successCount
  }

  // Force open the circuit
  forceOpen(): void {
    this.state = CircuitState.OPEN
    this.lastFailureTime = Date.now()
    this.notifyStateChange()
    logger.warn(`Circuit breaker ${this.name} forced open`)
  }

  // Force close the circuit
  forceClose(): void {
    this.reset()
    logger.info(`Circuit breaker ${this.name} forced closed`)
  }
}

// Circuit breaker registry
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map()

  // Get or create a circuit breaker
  getOrCreate(name: string, options: Partial<CircuitBreakerOptions> = {}): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options))
    }
    return this.breakers.get(name)!
  }

  // Get all circuit breakers
  getAll(): Map<string, CircuitBreaker> {
    return this.breakers
  }

  // Get circuit breaker by name
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name)
  }

  // Remove circuit breaker
  remove(name: string): boolean {
    return this.breakers.delete(name)
  }

  // Get circuit breaker states
  getStates(): Record<string, string> {
    const states: Record<string, string> = {}
    this.breakers.forEach((breaker, name) => {
      states[name] = breaker.getState()
    })
    return states
  }
}

// Create and export the registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry()

export default {
  CircuitBreaker,
  circuitBreakerRegistry,
}
