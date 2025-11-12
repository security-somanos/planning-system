package repos

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// InvolvementRepo provides methods to check if a user is involved in data
type InvolvementRepo struct{ RepoBase }

func NewInvolvementRepo(pool *pgxpool.Pool) *InvolvementRepo {
	return &InvolvementRepo{RepoBase{Pool: pool}}
}

// IsUserInvolvedInDay checks if a user (via their participant) is involved in a day
// A user is involved if their participant is referenced in any block or movement of that day
func (r *InvolvementRepo) IsUserInvolvedInDay(ctx context.Context, userID, dayID string) (bool, error) {
	var count int64
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participants p
		WHERE p.user_id = $1
		AND (
			-- Participant in blocks
			EXISTS (
				SELECT 1 FROM blocks b
				JOIN block_participants bp ON bp.block_id = b.id
				WHERE b.day_id = $2 AND bp.participant_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM blocks b
				JOIN block_advance_participants bp ON bp.block_id = b.id
				WHERE b.day_id = $2 AND bp.participant_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM blocks b
				JOIN block_met_by_participants bp ON bp.block_id = b.id
				WHERE b.day_id = $2 AND bp.participant_id = p.id
			)
			-- Participant in movements (as driver or passenger)
			OR EXISTS (
				SELECT 1 FROM movements m
				JOIN vehicle_assignments va ON va.movement_id = m.id
				WHERE m.day_id = $2 AND va.driver_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM movements m
				JOIN vehicle_assignments va ON va.movement_id = m.id
				JOIN vehicle_assignment_passengers vap ON vap.assignment_id = va.id
				WHERE m.day_id = $2 AND vap.participant_id = p.id
			)
		)
	`, userID, dayID).Scan(&count)
	return count > 0, err
}

// IsUserInvolvedInBlock checks if a user is involved in a specific block
func (r *InvolvementRepo) IsUserInvolvedInBlock(ctx context.Context, userID, blockID string) (bool, error) {
	var count int64
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participants p
		WHERE p.user_id = $1
		AND (
			EXISTS (SELECT 1 FROM block_participants bp WHERE bp.block_id = $2 AND bp.participant_id = p.id)
			OR EXISTS (SELECT 1 FROM block_advance_participants bp WHERE bp.block_id = $2 AND bp.participant_id = p.id)
			OR EXISTS (SELECT 1 FROM block_met_by_participants bp WHERE bp.block_id = $2 AND bp.participant_id = p.id)
		)
	`, userID, blockID).Scan(&count)
	return count > 0, err
}

// IsUserInvolvedInMovement checks if a user is involved in a specific movement
func (r *InvolvementRepo) IsUserInvolvedInMovement(ctx context.Context, userID, movementID string) (bool, error) {
	var count int64
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participants p
		WHERE p.user_id = $1
		AND (
			EXISTS (
				SELECT 1 FROM vehicle_assignments va
				WHERE va.movement_id = $2 AND va.driver_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM vehicle_assignments va
				JOIN vehicle_assignment_passengers vap ON vap.assignment_id = va.id
				WHERE va.movement_id = $2 AND vap.participant_id = p.id
			)
		)
	`, userID, movementID).Scan(&count)
	return count > 0, err
}

// GetParticipantIDByUserID gets the participant ID for a given user ID
func (r *InvolvementRepo) GetParticipantIDByUserID(ctx context.Context, userID string) (string, error) {
	var participantID string
	err := r.Pool.QueryRow(ctx, `
		SELECT id FROM participants WHERE user_id = $1 LIMIT 1
	`, userID).Scan(&participantID)
	return participantID, err
}

// IsUserInvolvedWithVehicle checks if a user is involved with a specific vehicle
// A user is involved if their participant is assigned to this vehicle in any movement (as driver or passenger)
func (r *InvolvementRepo) IsUserInvolvedWithVehicle(ctx context.Context, userID, vehicleID string) (bool, error) {
	var count int64
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participants p
		WHERE p.user_id = $1
		AND (
			-- Participant is driver of a vehicle assignment
			EXISTS (
				SELECT 1 FROM vehicle_assignments va
				WHERE va.vehicle_id = $2 AND va.driver_id = p.id
			)
			-- Participant is passenger in a vehicle assignment
			OR EXISTS (
				SELECT 1 FROM vehicle_assignments va
				JOIN vehicle_assignment_passengers vap ON vap.assignment_id = va.id
				WHERE va.vehicle_id = $2 AND vap.participant_id = p.id
			)
		)
	`, userID, vehicleID).Scan(&count)
	return count > 0, err
}

// IsUserInvolvedWithLocation checks if a user is involved with a specific location
// A user is involved if their participant is in a block that uses this location,
// or in a movement that goes from/to this location
func (r *InvolvementRepo) IsUserInvolvedWithLocation(ctx context.Context, userID, locationID string) (bool, error) {
	var count int64
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM participants p
		WHERE p.user_id = $1
		AND (
			-- Participant in blocks that use this location
			EXISTS (
				SELECT 1 FROM blocks b
				JOIN block_participants bp ON bp.block_id = b.id
				WHERE b.location_id = $2 AND bp.participant_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM blocks b
				JOIN block_advance_participants bp ON bp.block_id = b.id
				WHERE b.location_id = $2 AND bp.participant_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM blocks b
				JOIN block_met_by_participants bp ON bp.block_id = b.id
				WHERE b.location_id = $2 AND bp.participant_id = p.id
			)
			-- Participant in movements that go from/to this location
			OR EXISTS (
				SELECT 1 FROM movements m
				JOIN vehicle_assignments va ON va.movement_id = m.id
				WHERE (m.from_location_id = $2 OR m.to_location_id = $2) AND va.driver_id = p.id
			)
			OR EXISTS (
				SELECT 1 FROM movements m
				JOIN vehicle_assignments va ON va.movement_id = m.id
				JOIN vehicle_assignment_passengers vap ON vap.assignment_id = va.id
				WHERE (m.from_location_id = $2 OR m.to_location_id = $2) AND vap.participant_id = p.id
			)
		)
	`, userID, locationID).Scan(&count)
	return count > 0, err
}

// GetVehiclesForUser returns all vehicle IDs where the user is involved
func (r *InvolvementRepo) GetVehiclesForUser(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT DISTINCT va.vehicle_id
		FROM participants p
		JOIN vehicle_assignments va ON (va.driver_id = p.id)
		WHERE p.user_id = $1
		UNION
		SELECT DISTINCT va.vehicle_id
		FROM participants p
		JOIN vehicle_assignment_passengers vap ON vap.participant_id = p.id
		JOIN vehicle_assignments va ON va.id = vap.assignment_id
		WHERE p.user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var vehicleIDs []string
	for rows.Next() {
		var vehicleID string
		if err := rows.Scan(&vehicleID); err != nil {
			return nil, err
		}
		vehicleIDs = append(vehicleIDs, vehicleID)
	}
	return vehicleIDs, rows.Err()
}

// GetLocationsForUser returns all location IDs where the user is involved
func (r *InvolvementRepo) GetLocationsForUser(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT DISTINCT b.location_id
		FROM participants p
		JOIN block_participants bp ON bp.participant_id = p.id
		JOIN blocks b ON b.id = bp.block_id
		WHERE p.user_id = $1 AND b.location_id IS NOT NULL
		UNION
		SELECT DISTINCT b.location_id
		FROM participants p
		JOIN block_advance_participants bp ON bp.participant_id = p.id
		JOIN blocks b ON b.id = bp.block_id
		WHERE p.user_id = $1 AND b.location_id IS NOT NULL
		UNION
		SELECT DISTINCT b.location_id
		FROM participants p
		JOIN block_met_by_participants bp ON bp.participant_id = p.id
		JOIN blocks b ON b.id = bp.block_id
		WHERE p.user_id = $1 AND b.location_id IS NOT NULL
		UNION
		SELECT DISTINCT m.from_location_id
		FROM participants p
		JOIN vehicle_assignments va ON va.driver_id = p.id
		JOIN movements m ON m.id = va.movement_id
		WHERE p.user_id = $1 AND m.from_location_id IS NOT NULL
		UNION
		SELECT DISTINCT m.to_location_id
		FROM participants p
		JOIN vehicle_assignments va ON va.driver_id = p.id
		JOIN movements m ON m.id = va.movement_id
		WHERE p.user_id = $1 AND m.to_location_id IS NOT NULL
		UNION
		SELECT DISTINCT m.from_location_id
		FROM participants p
		JOIN vehicle_assignment_passengers vap ON vap.participant_id = p.id
		JOIN vehicle_assignments va ON va.id = vap.assignment_id
		JOIN movements m ON m.id = va.movement_id
		WHERE p.user_id = $1 AND m.from_location_id IS NOT NULL
		UNION
		SELECT DISTINCT m.to_location_id
		FROM participants p
		JOIN vehicle_assignment_passengers vap ON vap.participant_id = p.id
		JOIN vehicle_assignments va ON va.id = vap.assignment_id
		JOIN movements m ON m.id = va.movement_id
		WHERE p.user_id = $1 AND m.to_location_id IS NOT NULL
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var locationIDs []string
	for rows.Next() {
		var locationID string
		if err := rows.Scan(&locationID); err != nil {
			return nil, err
		}
		locationIDs = append(locationIDs, locationID)
	}
	return locationIDs, rows.Err()
}

