-- Add rep_name, address, biz_cert_url columns to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS rep_name varchar(100);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS biz_cert_url varchar(500);
