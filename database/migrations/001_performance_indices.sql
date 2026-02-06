-- Performance Optimization: Database Indices
-- Version: 1.0.0
-- Date: 2026-02-06
-- Description: Creates indices for high-traffic tables to improve query performance

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- For text search
CREATE EXTENSION IF NOT EXISTS pg_stat_statements; -- For query monitoring

-- Note: CREATE INDEX CONCURRENTLY cannot run inside a transaction block
-- So we removed BEGIN/COMMIT to allow concurrent index creation

-- ============================================================
-- ORDERS TABLE INDICES
-- ============================================================

-- Composite index for branch filtering with status and sorting
-- Optimizes: GET /orders?branchId=X&status=Y ORDER BY created_at
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_branch_status_created
ON orders(branch_id, status, created_at DESC);

-- Index for order number lookups
-- Optimizes: GET /orders/:orderNo
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_order_no
ON orders(order_no);

-- Index for customer phone lookups
-- Optimizes: Search orders by customer phone
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_customer_phone
ON orders(customer_phone);

-- Index for date range queries
-- Optimizes: Analytics and reports by date
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at
ON orders(created_at DESC);

-- Composite index for efficient pagination
-- Optimizes: Paginated order listing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_branch_created_pagination
ON orders(branch_id, created_at DESC, id);

-- ============================================================
-- ORDER ITEMS TABLE INDICES
-- ============================================================

-- Index for getting items by order
-- Optimizes: GET /orders/:id (order details)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_order_id
ON order_items(order_id);

-- Index for product sales analysis
-- Optimizes: Product performance reports
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_id
ON order_items(product_id);

-- Composite index for product sales over time
-- Optimizes: Time-series product analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_order_items_product_created
ON order_items(product_id, created_at DESC);

-- ============================================================
-- PRODUCTS TABLE INDICES
-- ============================================================

-- Composite index for product listing by branch and category
-- Optimizes: GET /products?branchId=X&categoryId=Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_branch_category
ON products(branch_id, category_id, sort_order);

-- Index for filtering active/hidden products
-- Optimizes: GET /products?branchId=X&isActive=true
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_branch_hidden
ON products(branch_id, is_hidden, sort_order);

-- Trigram index for text search on product names
-- Optimizes: Product search by name (partial matching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_name_trgm
ON products USING gin(name gin_trgm_ops);

-- Full-text search index (Korean language)
-- Optimizes: Advanced product search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_fulltext
ON products USING gin(to_tsvector('korean', name || ' ' || COALESCE(description, '')));

-- ============================================================
-- PRODUCT INVENTORY TABLE INDICES
-- ============================================================

-- Composite index for inventory lookups
-- Optimizes: GET /inventory?branchId=X&productId=Y
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_branch_product
ON product_inventory(branch_id, product_id);

-- Partial index for low stock alerts
-- Optimizes: Finding products with low inventory
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_low_stock
ON product_inventory(branch_id, qty_available)
WHERE qty_available < 10;

-- Partial index for available products
-- Optimizes: Finding products in stock
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_available
ON product_inventory(branch_id)
WHERE qty_available > 0;

-- ============================================================
-- MEMBERS TABLE INDICES
-- ============================================================

-- Composite index for permission checks
-- Optimizes: Auth middleware, permission validation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_user_branch
ON members(user_id, branch_id);

-- Index for listing branch members
-- Optimizes: GET /members?branchId=X
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_branch_role
ON members(branch_id, role);

-- Index for user lookups
-- Optimizes: User permission checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_user_id
ON members(user_id);

-- ============================================================
-- INVENTORY LOGS TABLE INDICES
-- ============================================================

-- Composite index for product history
-- Optimizes: Product inventory audit trail
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_logs_product_created
ON inventory_logs(product_id, created_at DESC);

-- Composite index for branch activity
-- Optimizes: Branch inventory activity logs
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_logs_branch_created
ON inventory_logs(branch_id, created_at DESC);

-- Index for order-related inventory changes
-- Optimizes: Tracking inventory changes by order
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inventory_logs_reference
ON inventory_logs(reference_type, reference_id);

-- ============================================================
-- BRANCHES TABLE INDICES
-- ============================================================

-- Index for brand lookups
-- Optimizes: GET /branches?brandId=X
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_branches_brand_id
ON branches(brand_id);

-- ============================================================
-- BRANDS TABLE INDICES
-- ============================================================

-- Index for owner lookups
-- Optimizes: GET /brands (user's brands)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_brands_owner_id
ON brands(owner_id);

-- ============================================================
-- ANALYZE TABLES
-- ============================================================
-- Update table statistics for query planner

ANALYZE orders;
ANALYZE order_items;
ANALYZE products;
ANALYZE product_inventory;
ANALYZE members;
ANALYZE inventory_logs;
ANALYZE branches;
ANALYZE brands;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check for missing indices on foreign keys
SELECT
    c.conrelid::regclass AS "table",
    STRING_AGG(a.attname, ', ') AS columns,
    pg_size_pretty(pg_relation_size(c.conrelid)) AS "table_size"
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
WHERE c.contype = 'f'
  AND NOT EXISTS (
      SELECT 1 FROM pg_index i
      WHERE i.indrelid = c.conrelid
      AND i.indkey::int[] @> c.conkey::int[]
  )
GROUP BY c.conrelid
ORDER BY pg_relation_size(c.conrelid) DESC;
