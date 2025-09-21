#!/usr/bin/env tsx

import { join } from "path";
import { readFile } from "fs/promises";
import {
  closeDatabase,
  getConnectionPool,
  initializeDatabase,
} from "../src/core/database/connection.ts";
import { logger } from "../src/utils/logger.ts";

/**
 * Performance optimization script
 * Runs database optimizations and performance enhancements
 */
async function optimizePerformance() {
  try {
    logger.info("Starting performance optimization...");

    // Initialize database connection
    await initializeDatabase();
    const pool = getConnectionPool();

    // Read and execute performance optimization migration
    const migrationPath = join(
      process.cwd(),
      "src/core/database/migrations/0001_performance_optimization.sql"
    );
    const migrationSQL = await readFile(migrationPath, "utf-8");

    logger.info("Executing performance optimization migration...");
    await pool.unsafe(migrationSQL);

    // Update table statistics
    logger.info("Updating table statistics...");
    await pool`SELECT update_table_statistics()`;

    // Cleanup expired sessions
    logger.info("Cleaning up expired sessions...");
    const [cleanupResult] =
      await pool`SELECT cleanup_expired_sessions() as deleted_count`;
    logger.info(`Cleaned up ${cleanupResult.deleted_count} expired sessions`);

    // Get performance recommendations
    logger.info("Getting performance recommendations...");
    const recommendations =
      await pool`SELECT * FROM get_performance_recommendations()`;

    if (recommendations.length > 0) {
      logger.info("Performance recommendations:");
      recommendations.forEach((rec, index) => {
        logger.info(
          `${index + 1}. [${rec.priority}] ${rec.recommendation_type}: ${
            rec.description
          }`
        );
        logger.info(`   Action: ${rec.action}`);
      });
    } else {
      logger.info("No performance recommendations at this time");
    }

    // Check index usage
    logger.info("Checking index usage...");
    const indexUsage = await pool`
      SELECT indexname, idx_scan, 
             CASE 
               WHEN idx_scan = 0 THEN 'Never used'
               WHEN idx_scan < 100 THEN 'Rarely used'
               ELSE 'Frequently used'
             END as usage_status
      FROM pg_stat_user_indexes 
      WHERE schemaname = 'public'
      ORDER BY idx_scan DESC
      LIMIT 10
    `;

    logger.info("Top 10 indexes by usage:");
    indexUsage.forEach((idx, index) => {
      logger.info(
        `${index + 1}. ${idx.indexname}: ${idx.idx_scan} scans (${
          idx.usage_status
        })`
      );
    });

    // Check table sizes
    logger.info("Checking table sizes...");
    const tableSizes = await pool`
      SELECT tablename, 
             pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC
      LIMIT 5
    `;

    logger.info("Top 5 largest tables:");
    tableSizes.forEach((table, index) => {
      logger.info(`${index + 1}. ${table.tablename}: ${table.size}`);
    });

    // Test query performance
    logger.info("Testing query performance...");
    const testQueries = [
      {
        name: "Active users by tenant",
        query: pool`
          SELECT tenant_id, count(*) as user_count
          FROM users 
          WHERE is_active = true 
          GROUP BY tenant_id
        `,
      },
      {
        name: "Published content by type",
        query: pool`
          SELECT content_type, count(*) as content_count
          FROM contents 
          WHERE status = 'published'
          GROUP BY content_type
        `,
      },
      {
        name: "Media by type and tenant",
        query: pool`
          SELECT tenant_id, media_type, count(*) as media_count
          FROM media 
          GROUP BY tenant_id, media_type
          ORDER BY tenant_id, media_count DESC
        `,
      },
    ];

    for (const testQuery of testQueries) {
      const startTime = Date.now();
      const result = await testQuery.query;
      const duration = Date.now() - startTime;

      logger.info(
        `Query "${testQuery.name}": ${duration}ms (${result.length} rows)`
      );

      // Record performance metric
      await pool`SELECT record_performance_metric(${testQuery.name}, ${duration}, 'ms')`;
    }

    // Vacuum and analyze for optimal performance
    logger.info("Running VACUUM ANALYZE for optimal performance...");
    await pool`VACUUM ANALYZE`;

    logger.info("Performance optimization completed successfully!");

    // Summary
    logger.info("=".repeat(60));
    logger.info("PERFORMANCE OPTIMIZATION SUMMARY");
    logger.info("=".repeat(60));
    logger.info("✅ Database indexes optimized");
    logger.info("✅ Table statistics updated");
    logger.info("✅ Expired sessions cleaned up");
    logger.info("✅ Performance monitoring enabled");
    logger.info("✅ Query cache system configured");
    logger.info("✅ Database maintenance functions created");
    logger.info("=".repeat(60));
  } catch (error) {
    logger.error("Performance optimization failed:", error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run optimization if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  optimizePerformance().catch((error) => {
    logger.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { optimizePerformance };
