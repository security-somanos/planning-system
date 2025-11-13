-- Add is_user_enabled column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_user_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for is_user_enabled filtering
CREATE INDEX IF NOT EXISTS idx_users_is_user_enabled ON users(is_user_enabled);

