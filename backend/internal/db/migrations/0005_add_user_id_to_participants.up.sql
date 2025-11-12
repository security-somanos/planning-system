-- Add user_id to participants table
ALTER TABLE participants
ADD COLUMN IF NOT EXISTS user_id UUID;

-- Add foreign key constraint
ALTER TABLE participants
ADD CONSTRAINT fk_participants_user_id
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for user_id lookup
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);

