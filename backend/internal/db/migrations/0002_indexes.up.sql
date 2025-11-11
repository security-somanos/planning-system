-- Foreign key indexes and frequent filters
CREATE INDEX IF NOT EXISTS idx_days_event_id ON days(event_id);
CREATE INDEX IF NOT EXISTS idx_blocks_day_id ON blocks(day_id);
CREATE INDEX IF NOT EXISTS idx_blocks_location_id ON blocks(location_id);
CREATE INDEX IF NOT EXISTS idx_schedule_items_block_id ON schedule_items(block_id);
CREATE INDEX IF NOT EXISTS idx_movements_day_id ON movements(day_id);
CREATE INDEX IF NOT EXISTS idx_movements_from_location_id ON movements(from_location_id);
CREATE INDEX IF NOT EXISTS idx_movements_to_location_id ON movements(to_location_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_movement_id ON vehicle_assignments(movement_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_vehicle_id ON vehicle_assignments(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_assignments_driver_id ON vehicle_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_block_participants_block_id ON block_participants(block_id);
CREATE INDEX IF NOT EXISTS idx_block_participants_participant_id ON block_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_block_advance_participants_block_id ON block_advance_participants(block_id);
CREATE INDEX IF NOT EXISTS idx_block_advance_participants_participant_id ON block_advance_participants(participant_id);
CREATE INDEX IF NOT EXISTS idx_block_met_by_participants_block_id ON block_met_by_participants(block_id);
CREATE INDEX IF NOT EXISTS idx_block_met_by_participants_participant_id ON block_met_by_participants(participant_id);


