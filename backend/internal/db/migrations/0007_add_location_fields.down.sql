-- Remove indexes
DROP INDEX IF EXISTS idx_location_site_managers_location;
DROP INDEX IF EXISTS idx_location_site_managers_participant;

-- Drop junction table
DROP TABLE IF EXISTS location_site_managers;

-- Remove contact column
ALTER TABLE locations
DROP COLUMN IF EXISTS contact;

