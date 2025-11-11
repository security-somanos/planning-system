-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Events
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- Days
CREATE TABLE IF NOT EXISTS days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    date DATE NOT NULL,
    CONSTRAINT unique_event_date UNIQUE (event_id, date)
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    google_maps_link TEXT,
    type TEXT
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label TEXT NOT NULL,
    make TEXT,
    model TEXT,
    license_plate TEXT,
    capacity INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
    notes TEXT
);

-- Participants
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    roles TEXT[] NOT NULL DEFAULT '{}',
    email TEXT,
    phone TEXT,
    languages TEXT[] NOT NULL DEFAULT '{}'
);

-- Blocks
CREATE TABLE IF NOT EXISTS blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('activity','break')),
    title TEXT NOT NULL,
    description TEXT,
    start_time TIME NOT NULL,
    end_time TIME,
    end_time_fixed BOOLEAN NOT NULL DEFAULT FALSE,
    location_id UUID,
    notes TEXT
);

-- Block relations
CREATE TABLE IF NOT EXISTS block_participants (
    block_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    PRIMARY KEY (block_id, participant_id)
);
CREATE TABLE IF NOT EXISTS block_advance_participants (
    block_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    PRIMARY KEY (block_id, participant_id)
);
CREATE TABLE IF NOT EXISTS block_met_by_participants (
    block_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    PRIMARY KEY (block_id, participant_id)
);

-- Schedule Items
CREATE TABLE IF NOT EXISTS schedule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL,
    time TIME NOT NULL,
    description TEXT NOT NULL,
    staff_instructions TEXT,
    guest_instructions TEXT,
    notes TEXT
);

-- Movements
CREATE TABLE IF NOT EXISTS movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    from_location_id UUID,
    to_location_id UUID,
    from_time TIME NOT NULL,
    to_time_type TEXT NOT NULL CHECK (to_time_type IN ('fixed','driving')),
    to_time TIME,
    driving_minutes INTEGER,
    CONSTRAINT movement_time_check CHECK (
        (to_time_type = 'fixed' AND to_time IS NOT NULL AND driving_minutes IS NULL) OR
        (to_time_type = 'driving' AND to_time IS NULL AND driving_minutes IS NOT NULL)
    )
);

-- Vehicle Assignments
CREATE TABLE IF NOT EXISTS vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movement_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    driver_id UUID
);

CREATE TABLE IF NOT EXISTS vehicle_assignment_passengers (
    assignment_id UUID NOT NULL,
    participant_id UUID NOT NULL,
    PRIMARY KEY (assignment_id, participant_id)
);


