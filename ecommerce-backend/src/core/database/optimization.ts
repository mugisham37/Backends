/**
 * Database optimization utilities
 * Provides query optimization, indexing strategies, and performance monitoring
 */

import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { getDatabase } from "./connection.js";

export interface QueryPerformanceMetrics {
  query: string;
  executionTime: number;
  rowsReturned: number;
  timestamp: Date;
  planCost?: number;
  indexesUsed?: string[];
}

export interface IndexRecommendation {
  table: string;
  columns: string[];
  type: "btree" | "hash" | "gin" | "gist";
  reason: string;
  estimatedImprovement: string;
}

export class DatabaseOptimizer {
  private db: PostgresJsDatabase<any>;
  private queryMetrics: QueryPerformanceMetrics[] = [];
  private readonly maxMetricsHistory = 1000;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Execute query with performance monitoring
   */
  async executeWithMetrics<T>(
    query: any,
    description: string = "Unknown query"
  ): Promise<{ result: T; metrics: QueryPerformanceMetrics }> {
    const startTime = Date.now();

    try {
      const result = await query;
      const executionTime = Date.now() - startTime;

      const metrics: QueryPerformanceMetrics = {
        query: description,
        executionTime,
        rowsReturned: Array.isArray(result) ? result.length : 1,
        timestamp: new Date(),
      };

      this.addMetrics(metrics);

      return { result, metrics };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      const metrics: QueryPerformanceMetrics = {
        query: description,
        executionTime,
        rowsReturned: 0,
        timestamp: new Date(),
      };

      this.addMetrics(metrics);
      throw error;
    }
  }

  /**
   * Analyze query performance using EXPLAIN
   */
  async analyzeQuery(query: string): Promise<{
    plan: any;
    cost: number;
    recommendations: string[];
  }> {
    try {
      const explainResult = await this.db.execute(
        sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`)
      );

      const plan = explainResult[0]?.["QUERY PLAN"] || {};
      const cost = this.extractCostFromPlan(plan);
      const recommendations = this.generateQueryRecommendations(plan);

      return { plan, cost, recommendations };
    } catch (error) {
      console.error("Query analysis error:", error);
      return {
        plan: {},
        cost: 0,
        recommendations: ["Unable to analyze query"],
      };
    }
  }

  /**
   * Create optimized indexes for frequently queried columns
   */
  async createOptimizedIndexes(): Promise<void> {
    console.log("Creating optimized database indexes...");

    const indexes = [
      // User indexes
      {
        name: "idx_users_email_status",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_status ON users(email, status) WHERE status = 'active'",
        description: "Optimize user lookups by email and active status",
      },
      {
        name: "idx_users_role_created",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_created ON users(role, created_at DESC)",
        description: "Optimize user queries by role with recent first ordering",
      },

      // Vendor indexes
      {
        name: "idx_vendors_status_approved",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_status_approved ON vendors(status, approved_at DESC) WHERE status = 'approved'",
        description: "Optimize approved vendor queries",
      },
      {
        name: "idx_vendors_slug",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_slug ON vendors(slug) WHERE status = 'approved'",
        description: "Optimize vendor slug lookups for active vendors",
      },
      {
        name: "idx_vendors_user_id",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vendors_user_id ON vendors(user_id)",
        description: "Optimize vendor-user relationship queries",
      },

      // Product indexes
      {
        name: "idx_products_vendor_status",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_vendor_status ON products(vendor_id, status) WHERE status = 'active'",
        description: "Optimize product queries by vendor and active status",
      },
      {
        name: "idx_products_category_featured",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_category_featured ON products(category_id, featured, created_at DESC) WHERE status = 'active'",
        description:
          "Optimize category product listings with featured products first",
      },
      {
        name: "idx_products_search",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || COALESCE(description, ''))) WHERE status = 'active'",
        description: "Full-text search optimization for products",
      },
      {
        name: "idx_products_price_range",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_price_range ON products(price, status) WHERE status = 'active'",
        description: "Optimize price range queries",
      },
      {
        name: "idx_products_slug",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_slug ON products(slug) WHERE status = 'active'",
        description: "Optimize product slug lookups",
      },

      // Category indexes
      {
        name: "idx_categories_parent_active",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_parent_active ON categories(parent_id, is_active, sort_order) WHERE is_active = true",
        description: "Optimize category hierarchy queries",
      },
      {
        name: "idx_categories_slug",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_slug ON categories(slug) WHERE is_active = true",
        description: "Optimize category slug lookups",
      },

      // Order indexes
      {
        name: "idx_orders_user_status",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_user_status ON orders(user_id, status, created_at DESC)",
        description: "Optimize user order history queries",
      },
      {
        name: "idx_orders_status_created",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC)",
        description: "Optimize order management queries by status",
      },
      {
        name: "idx_orders_email_created",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_email_created ON orders(customer_email, created_at DESC)",
        description: "Optimize guest order lookups",
      },

      // Order items indexes
      {
        name: "idx_order_items_order_vendor",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_vendor ON order_items(order_id, vendor_id)",
        description: "Optimize order item queries by order and vendor",
      },
      {
        name: "idx_order_items_product_created",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_created ON order_items(product_id, created_at DESC)",
        description: "Optimize product sales analytics",
      },
      {
        name: "idx_order_items_vendor_created",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_vendor_created ON order_items(vendor_id, created_at DESC)",
        description: "Optimize vendor sales analytics",
      },

      // Payment indexes
      {
        name: "idx_payments_order_status",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_status ON payments(order_id, status)",
        description: "Optimize payment status queries",
      },
      {
        name: "idx_payments_method_created",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_method_created ON payments(payment_method, created_at DESC)",
        description: "Optimize payment method analytics",
      },

      // Product variants indexes
      {
        name: "idx_product_variants_product_active",
        query:
          "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_variants_product_active ON product_variants(product_id, is_active) WHERE is_active = true",
        description: "Optimize product variant queries",
      },
    ];

    for (const index of indexes) {
      try {
        console.log(`Creating index: ${index.name} - ${index.description}`);
        await this.db.execute(sql.raw(index.query));
        console.log(`✅ Created index: ${index.name}`);
      } catch (error) {
        // Index might already exist, which is fine
        if (error.message?.includes("already exists")) {
          console.log(`ℹ️  Index already exists: ${index.name}`);
        } else {
          console.error(`❌ Failed to create index ${index.name}:`, error);
        }
      }
    }

    console.log("Database index optimization completed");
  }

  /**
   * Analyze table statistics and suggest optimizations
   */
  async analyzeTableStatistics(): Promise<{
    tables: Array<{
      name: string;
      rowCount: number;
      size: string;
      indexSize: string;
      recommendations: string[];
    }>;
  }> {
    try {
      const tablesQuery = sql`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname
      `;

      const sizeQuery = sql`
        SELECT 
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
          pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as index_size,
          pg_stat_get_tuples_returned(c.oid) as row_count
        FROM pg_tables pt
        JOIN pg_class c ON c.relname = pt.tablename
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
      `;

      const [statsResult, sizeResult] = await Promise.all([
        this.db.execute(tablesQuery),
        this.db.execute(sizeQuery),
      ]);

      const tables = sizeResult.map((table: any) => ({
        name: table.tablename,
        rowCount: parseInt(table.row_count) || 0,
        size: table.size,
        indexSize: table.index_size,
        recommendations: this.generateTableRecommendations(table, statsResult),
      }));

      return { tables };
    } catch (error) {
      console.error("Table statistics analysis error:", error);
      return { tables: [] };
    }
  }

  /**
   * Get slow query recommendations
   */
  getSlowQueryRecommendations(thresholdMs: number = 1000): {
    slowQueries: QueryPerformanceMetrics[];
    recommendations: string[];
  } {
    const slowQueries = this.queryMetrics.filter(
      (metric) => metric.executionTime > thresholdMs
    );

    const recommendations = [
      ...new Set(
        slowQueries
          .map((query) => this.generateSlowQueryRecommendation(query))
          .flat()
      ),
    ];

    return { slowQueries, recommendations };
  }

  /**
   * Optimize database configuration
   */
  async optimizeConfiguration(): Promise<void> {
    console.log("Optimizing database configuration...");

    const optimizations = [
      // Update table statistics
      "ANALYZE;",

      // Vacuum tables to reclaim space
      "VACUUM (ANALYZE);",

      // Update PostgreSQL configuration for better performance
      `ALTER SYSTEM SET shared_buffers = '256MB';`,
      `ALTER SYSTEM SET effective_cache_size = '1GB';`,
      `ALTER SYSTEM SET maintenance_work_mem = '64MB';`,
      `ALTER SYSTEM SET checkpoint_completion_target = 0.9;`,
      `ALTER SYSTEM SET wal_buffers = '16MB';`,
      `ALTER SYSTEM SET default_statistics_target = 100;`,
    ];

    for (const optimization of optimizations) {
      try {
        await this.db.execute(sql.raw(optimization));
        console.log(`✅ Applied: ${optimization}`);
      } catch (error) {
        console.error(`❌ Failed to apply: ${optimization}`, error);
      }
    }

    console.log("Database configuration optimization completed");
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(): QueryPerformanceMetrics[] {
    return [...this.queryMetrics];
  }

  /**
   * Clear query metrics
   */
  clearMetrics(): void {
    this.queryMetrics = [];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    totalQueries: number;
    averageExecutionTime: number;
    slowestQuery: QueryPerformanceMetrics | null;
    fastestQuery: QueryPerformanceMetrics | null;
  } {
    if (this.queryMetrics.length === 0) {
      return {
        totalQueries: 0,
        averageExecutionTime: 0,
        slowestQuery: null,
        fastestQuery: null,
      };
    }

    const totalTime = this.queryMetrics.reduce(
      (sum, metric) => sum + metric.executionTime,
      0
    );

    const sortedByTime = [...this.queryMetrics].sort(
      (a, b) => a.executionTime - b.executionTime
    );

    return {
      totalQueries: this.queryMetrics.length,
      averageExecutionTime: totalTime / this.queryMetrics.length,
      slowestQuery: sortedByTime[sortedByTime.length - 1],
      fastestQuery: sortedByTime[0],
    };
  }

  /**
   * Add metrics to history
   */
  private addMetrics(metrics: QueryPerformanceMetrics): void {
    this.queryMetrics.push(metrics);

    // Keep only recent metrics
    if (this.queryMetrics.length > this.maxMetricsHistory) {
      this.queryMetrics = this.queryMetrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Extract cost from query plan
   */
  private extractCostFromPlan(plan: any): number {
    if (!plan || typeof plan !== "object") return 0;

    try {
      if (Array.isArray(plan) && plan.length > 0) {
        return plan[0]?.Plan?.["Total Cost"] || 0;
      }
      return plan?.Plan?.["Total Cost"] || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Generate query recommendations from execution plan
   */
  private generateQueryRecommendations(plan: any): string[] {
    const recommendations: string[] = [];

    if (!plan || typeof plan !== "object") {
      return ["Unable to analyze query plan"];
    }

    try {
      let planNode;
      if (Array.isArray(plan) && plan.length > 0) {
        planNode = plan[0]?.Plan;
      } else {
        planNode = plan?.Plan;
      }

      if (planNode?.["Node Type"] === "Seq Scan") {
        recommendations.push(
          "Consider adding an index to avoid sequential scan"
        );
      }

      if (planNode?.["Total Cost"] > 1000) {
        recommendations.push("High cost query - consider optimization");
      }

      if (planNode?.["Actual Loops"] > 1000) {
        recommendations.push("High loop count - consider query restructuring");
      }
    } catch (error) {
      recommendations.push("Unable to analyze query plan details");
    }

    return recommendations;
  }

  /**
   * Generate table-specific recommendations
   */
  private generateTableRecommendations(table: any, _stats: any[]): string[] {
    const recommendations: string[] = [];

    if (table.row_count > 100000) {
      recommendations.push("Large table - ensure proper indexing");
    }

    if (table.index_size > table.size) {
      recommendations.push("Index size larger than table - review index usage");
    }

    return recommendations;
  }

  /**
   * Generate recommendation for slow query
   */
  private generateSlowQueryRecommendation(
    query: QueryPerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (query.executionTime > 5000) {
      recommendations.push(
        `Very slow query (${query.executionTime}ms): ${query.query}`
      );
    } else if (query.executionTime > 1000) {
      recommendations.push(
        `Slow query (${query.executionTime}ms): ${query.query}`
      );
    }

    return recommendations;
  }
}

// Singleton instance
export const databaseOptimizer = new DatabaseOptimizer();

/**
 * Query builder with optimization hints
 */
export class OptimizedQueryBuilder {
  /**
   * Build optimized user queries
   */
  static getUserQueries() {
    return {
      // Find active users with proper index usage
      findActiveUsers: (limit: number = 50) => sql`
        SELECT * FROM users 
        WHERE status = 'active' 
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `,

      // Find user by email (uses index)
      findByEmail: (email: string) => sql`
        SELECT * FROM users 
        WHERE email = ${email} AND status = 'active'
        LIMIT 1
      `,
    };
  }

  /**
   * Build optimized product queries
   */
  static getProductQueries() {
    return {
      // Find active products by category (uses composite index)
      findByCategory: (categoryId: string, limit: number = 20) => sql`
        SELECT p.*, v.business_name as vendor_name
        FROM products p
        JOIN vendors v ON p.vendor_id = v.id
        WHERE p.category_id = ${categoryId} 
          AND p.status = 'active'
          AND v.status = 'approved'
        ORDER BY p.featured DESC, p.created_at DESC
        LIMIT ${limit}
      `,

      // Search products with full-text search
      searchProducts: (searchTerm: string, limit: number = 20) => sql`
        SELECT p.*, v.business_name as vendor_name,
               ts_rank(to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')), 
                      plainto_tsquery('english', ${searchTerm})) as rank
        FROM products p
        JOIN vendors v ON p.vendor_id = v.id
        WHERE p.status = 'active'
          AND v.status = 'approved'
          AND to_tsvector('english', p.name || ' ' || COALESCE(p.description, '')) 
              @@ plainto_tsquery('english', ${searchTerm})
        ORDER BY rank DESC, p.featured DESC
        LIMIT ${limit}
      `,
    };
  }

  /**
   * Build optimized order queries
   */
  static getOrderQueries() {
    return {
      // Find user orders with items (optimized joins)
      findUserOrdersWithItems: (userId: string, limit: number = 10) => sql`
        SELECT 
          o.*,
          json_agg(
            json_build_object(
              'id', oi.id,
              'product_name', oi.product_name,
              'quantity', oi.quantity,
              'price', oi.price,
              'total', oi.total
            )
          ) as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        WHERE o.user_id = ${userId}
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT ${limit}
      `,
    };
  }
}
