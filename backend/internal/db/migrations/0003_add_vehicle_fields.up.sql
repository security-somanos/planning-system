-- Add new fields to vehicles table
ALTER TABLE vehicles
ADD COLUMN IF NOT EXISTS available_from TIME,
ADD COLUMN IF NOT EXISTS available_to TIME,
ADD COLUMN IF NOT EXISTS origination_location_id UUID;

-- Add index for origination_location_id
CREATE INDEX IF NOT EXISTS idx_vehicles_origination_location_id ON vehicles(origination_location_id);

