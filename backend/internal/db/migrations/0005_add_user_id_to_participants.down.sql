-- Remove user_id from participants table
ALTER TABLE participants
DROP CONSTRAINT IF EXISTS fk_participants_user_id;

DROP INDEX IF EXISTS idx_participants_user_id;

ALTER TABLE participants
DROP COLUMN IF EXISTS user_id;

