/**
 * Dependency injection container registry
 * Manages service registration and resolution
 */

type Constructor<T = {}> = new (...args: any[]) => T;
type Factory<T = any> = (...args: any[]) => T;

interface ServiceDefinition<T = any> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
  dependencies: string[];
}

export class Container {
  private services = new Map<string, ServiceDefinition>();
  private resolving = new Set<string>();

  /**
   * Register a service with its dependencies
   */
  register<T>(
    name: string,
    factory: Factory<T>,
    options: {
      singleton?: boolean;
      dependencies?: string[];
    } = {}
  ): void {
    this.services.set(name, {
      factory,
      singleton: options.singleton ?? true,
      dependencies: options.dependencies ?? [],
    });
  }

  /**
   * Register a class constructor as a service
   */
  registerClass<T>(
    name: string,
    constructor: Constructor<T>,
    options: {
      singleton?: boolean;
      dependencies?: string[];
    } = {}
  ): void {
    this.register(name, (...deps) => new constructor(...deps), options);
  }

  /**
   * Register a singleton instance
   */
  registerInstance<T>(name: string, instance: T): void {
    this.services.set(name, {
      factory: () => instance,
      singleton: true,
      instance,
      dependencies: [],
    });
  }

  /**
   * Resolve a service by name
   */
  resolve<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service '${name}' not found`);
    }

    // Check for circular dependencies
    if (this.resolving.has(name)) {
      throw new Error(`Circular dependency detected for service '${name}'`);
    }

    // Return existing singleton instance
    if (service.singleton && service.instance) {
      return service.instance;
    }

    this.resolving.add(name);

    try {
      // Resolve dependencies
      const dependencies = service.dependencies.map((dep) => this.resolve(dep));

      // Create instance
      const instance = service.factory(...dependencies);

      // Store singleton instance
      if (service.singleton) {
        service.instance = instance;
      }

      return instance;
    } finally {
      this.resolving.delete(name);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: string): boolean {
    return this.services.has(name);
  }

  /**
   * Clear all services (useful for testing)
   */
  clear(): void {
    this.services.clear();
    this.resolving.clear();
  }

  /**
   * Get all registered service names
   */
  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}

// Global container instance
export const container = new Container();
