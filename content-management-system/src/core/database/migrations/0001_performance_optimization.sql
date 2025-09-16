-- Performance optimization migration
-- Adds indexes and optimizations for task 15.1

-- ============================================================================
-- USERS TABLE PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for tenant + role queries (common in authorization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant_role_active 
ON users (tenant_id, role, is_active) 
WHERE is_active = true;

-- Index for email verification queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_verification 
ON users (email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Index for password reset queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_password_reset 
ON users (password_reset_token, password_reset_expires_at) 
WHERE password_reset_token IS NOT NULL;

-- Partial index for active users only (most common queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_active_created 
ON users (created_at DESC) 
WHERE is_active = true;

-- ============================================================================
-- USER SESSIONS TABLE PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for session cleanup queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires_active 
ON user_sessions (expires_at, is_active) 
WHERE is_active = true;

-- Index for user session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_active_created 
ON user_sessions (user_id, is_active, created_at DESC) 
WHERE is_active = true;

-- ============================================================================
-- CONTENTS TABLE PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for published content queries (most common)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_tenant_status_published 
ON contents (tenant_id, status, published_at DESC) 
WHERE status = 'published';

-- Index for content search and filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_type_status_created 
ON contents (content_type, status, created_at DESC);

-- Index for author's content queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_author_status_updated 
ON contents (author_id, status, updated_at DESC) 
WHERE author_id IS NOT NULL;

-- Index for scheduled content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_scheduled 
ON contents (scheduled_at) 
WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- Full-text search index for content
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_search 
ON contents USING gin(to_tsvector('english', title || ' ' || coalesce(excerpt, '') || ' ' || coalesce(body, '')));

-- Index for content versioning
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_original_version_latest 
ON contents (original_id, version DESC, is_latest_version) 
WHERE original_id IS NOT NULL;

-- Index for content hierarchy
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contents_parent_status 
ON contents (parent_id, status) 
WHERE parent_id IS NOT NULL;

-- ============================================================================
-- MEDIA TABLE PERFORMANCE INDEXES
-- ============================================================================

-- Composite index for media queries by type and tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_tenant_type_created 
ON media (tenant_id, media_type, created_at DESC);

-- Index for file deduplication
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_hash_size 
ON media (hash, size) 
WHERE hash IS NOT NULL;

-- Index for media processing status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_processing_status 
ON media (processing_status, created_at) 
WHERE is_processed = false;

-- Index for public media queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_public_type 
ON media (is_public, media_type, created_at DESC) 
WHERE is_public = true;

-- Index for uploader's media
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_uploader_created 
ON media (uploader_id, created_at DESC) 
WHERE uploader_id IS NOT NULL;

-- Index for folder organization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_media_folder_type_created 
ON media (folder_id, media_type, created_at DESC);

-- ============================================================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================================================

-- View for monitoring slow queries (requires pg_stat_statements extension)
CREATE OR REPLACE VIEW slow_queries AS
SELECT 
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    rows,
    100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
WHERE mean_exec_time > 100  -- Queries taking more than 100ms on average
ORDER BY mean_exec_time DESC;

-- View for monitoring index usage
CREATE OR REPLACE VIEW index_usage AS
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan,
    CASE 
        WHEN idx_scan = 0 THEN 'Never used'
        WHEN idx_scan < 100 THEN 'Rarely used'
        ELSE 'Frequently used'
    END as usage_status
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- View for monitoring table sizes
CREATE OR REPLACE VIEW table_sizes AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to analyze table statistics
CREATE OR REPLACE FUNCTION update_table_statistics()
RETURNS void AS $$
BEGIN
    ANALYZE users;
    ANALYZE user_sessions;
    ANALYZE user_permissions;
    ANALYZE contents;
    ANALYZE content_versions;
    ANALYZE content_categories;
    ANALYZE content_tags;
    ANALYZE media;
    ANALYZE media_folders;
    ANALYZE media_transformations;
    ANALYZE media_usage;
    ANALYZE tenants;
    
    RAISE NOTICE 'Table statistics updated successfully';
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < NOW() OR is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Cleaned up % expired sessions', deleted_count;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get performance recommendations
CREATE OR REPLACE FUNCTION get_performance_recommendations()
RETURNS TABLE(
    recommendation_type text,
    description text,
    priority text,
    action text
) AS $$
BEGIN
    -- Check for unused indexes
    RETURN QUERY
    SELECT 
        'Unused Index'::text,
        'Index ' || indexname || ' on table ' || tablename || ' is never used'::text,
        'Medium'::text,
        'Consider dropping this index: DROP INDEX ' || indexname::text
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0;
    
    -- Check for tables without primary keys
    RETURN QUERY
    SELECT 
        'Missing Primary Key'::text,
        'Table ' || tablename || ' does not have a primary key'::text,
        'High'::text,
        'Add a primary key to improve performance'::text
    FROM information_schema.tables t
    LEFT JOIN information_schema.table_constraints tc 
        ON t.table_name = tc.table_name 
        AND tc.constraint_type = 'PRIMARY KEY'
    WHERE t.table_schema = 'public' 
        AND tc.constraint_name IS NULL;
    
    -- Check for large tables without recent ANALYZE
    RETURN QUERY
    SELECT 
        'Stale Statistics'::text,
        'Table ' || schemaname || '.' || tablename || ' has stale statistics'::text,
        'Medium'::text,
        'Run ANALYZE on this table'::text
    FROM pg_stat_user_tables
    WHERE last_analyze < NOW() - INTERVAL '7 days'
        AND n_tup_ins + n_tup_upd + n_tup_del > 1000;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- QUERY RESULT CACHING SETUP
-- ============================================================================

-- Create a simple query cache table for frequently accessed data
CREATE TABLE IF NOT EXISTS query_cache (
    cache_key varchar(255) PRIMARY KEY,
    cache_value jsonb NOT NULL,
    expires_at timestamp NOT NULL,
    created_at timestamp DEFAULT NOW()
);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_query_cache_expires 
ON query_cache (expires_at);

-- Function to get cached query result
CREATE OR REPLACE FUNCTION get_cached_query(key text)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT cache_value INTO result
    FROM query_cache
    WHERE cache_key = key 
        AND expires_at > NOW();
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to set cached query result
CREATE OR REPLACE FUNCTION set_cached_query(key text, value jsonb, ttl_seconds integer DEFAULT 300)
RETURNS void AS $$
BEGIN
    INSERT INTO query_cache (cache_key, cache_value, expires_at)
    VALUES (key, value, NOW() + (ttl_seconds || ' seconds')::interval)
    ON CONFLICT (cache_key) 
    DO UPDATE SET 
        cache_value = EXCLUDED.cache_value,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_query_cache()
RETURNS integer AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM query_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PERFORMANCE MONITORING SETUP
-- ============================================================================

-- Enable pg_stat_statements if available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_available_extensions 
        WHERE name = 'pg_stat_statements'
    ) THEN
        CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
        RAISE NOTICE 'pg_stat_statements extension enabled for query monitoring';
    ELSE
        RAISE NOTICE 'pg_stat_statements extension not available';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not enable pg_stat_statements: %', SQLERRM;
END $$;

-- Create performance monitoring table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id serial PRIMARY KEY,
    metric_name varchar(100) NOT NULL,
    metric_value numeric NOT NULL,
    metric_unit varchar(20),
    recorded_at timestamp DEFAULT NOW()
);

-- Index for performance metrics queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name_time 
ON performance_metrics (metric_name, recorded_at DESC);

-- Function to record performance metric
CREATE OR REPLACE FUNCTION record_performance_metric(
    name text, 
    value numeric, 
    unit text DEFAULT 'ms'
)
RETURNS void AS $$
BEGIN
    INSERT INTO performance_metrics (metric_name, metric_value, metric_unit)
    VALUES (name, value, unit);
    
    -- Keep only last 10000 records per metric to prevent unbounded growth
    DELETE FROM performance_metrics 
    WHERE id IN (
        SELECT id FROM performance_metrics 
        WHERE metric_name = name 
        ORDER BY recorded_at DESC 
        OFFSET 10000
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Performance optimization migration completed successfully';
    RAISE NOTICE 'Added % indexes for query optimization', (
        SELECT count(*) 
        FROM pg_indexes 
        WHERE indexname LIKE 'idx_%'
    );
    RAISE NOTICE 'Created performance monitoring views and functions';
    RAISE NOTICE 'Run SELECT * FROM get_performance_recommendations() to see optimization suggestions';
END $$;