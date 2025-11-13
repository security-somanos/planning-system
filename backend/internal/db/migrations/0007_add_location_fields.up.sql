-- Add contact array to locations
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS contact TEXT[] NOT NULL DEFAULT '{}';

-- Create junction table for location site managers (participants who manage the location)
CREATE TABLE IF NOT EXISTS location_site_managers (
    location_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    PRIMARY KEY (location_id, participant_id),
    CONSTRAINT fk_location_site_managers_location
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE CASCADE,
    CONSTRAINT fk_location_site_managers_participant
        FOREIGN KEY (participant_id) REFERENCES participants(id) ON DELETE CASCADE
);

-- Add index for participant lookup
CREATE INDEX IF NOT EXISTS idx_location_site_managers_participant ON location_site_managers(participant_id);

-- Add index for location lookup
CREATE INDEX IF NOT EXISTS idx_location_site_managers_location ON location_site_managers(location_id);

