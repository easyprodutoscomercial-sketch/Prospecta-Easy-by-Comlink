-- Migration v13: Add visible_menus column to profiles
-- Controls which sidebar menu items each user can see.
-- Empty array or NULL = user sees all menus (backwards compatible).
-- Admin users always see everything regardless of this field.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS visible_menus TEXT[] DEFAULT '{}';
