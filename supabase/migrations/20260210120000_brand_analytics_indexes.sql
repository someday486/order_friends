-- Brand analytics performance indexes
-- orders.brand_id is auto-set by trigger but has no index,
-- causing full table scans on brand-level analytics queries.

CREATE INDEX IF NOT EXISTS idx_orders_brand_id
ON orders(brand_id);

CREATE INDEX IF NOT EXISTS idx_orders_brand_created_status
ON orders(brand_id, created_at DESC, status);
