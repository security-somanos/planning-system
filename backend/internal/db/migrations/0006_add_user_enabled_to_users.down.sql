-- Remove is_user_enabled index
DROP INDEX IF EXISTS idx_users_is_user_enabled;

-- Remove is_user_enabled column
ALTER TABLE users
DROP COLUMN IF EXISTS is_user_enabled;

