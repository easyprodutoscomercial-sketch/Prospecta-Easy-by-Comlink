-- Migration: Add meeting_type column to meetings table
-- Run this in your Supabase SQL editor

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'OUTRO';
