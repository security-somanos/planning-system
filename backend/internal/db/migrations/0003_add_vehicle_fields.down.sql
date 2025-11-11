-- Remove new fields from vehicles table
ALTER TABLE vehicles
DROP COLUMN IF EXISTS origination_location_id,
DROP COLUMN IF EXISTS available_to,
DROP COLUMN IF EXISTS available_from;

