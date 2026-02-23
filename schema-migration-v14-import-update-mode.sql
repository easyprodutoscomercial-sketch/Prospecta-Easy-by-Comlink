-- Migration v14: Add "updated" status to import and updated_count column
-- Run this in the Supabase SQL Editor

-- 1) Add updated_count column to import_runs
ALTER TABLE import_runs ADD COLUMN IF NOT EXISTS updated_count INT NOT NULL DEFAULT 0;

-- 2) Drop old CHECK constraint on import_run_items.status and recreate with 'updated'
ALTER TABLE import_run_items DROP CONSTRAINT IF EXISTS import_run_items_status_check;
ALTER TABLE import_run_items ADD CONSTRAINT import_run_items_status_check
  CHECK (status IN ('created', 'updated', 'duplicate', 'invalid'));
