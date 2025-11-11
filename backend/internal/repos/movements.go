package repos

import (
	"context"
	"strconv"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MovementsRepo struct{ RepoBase }

func NewMovementsRepo(pool *pgxpool.Pool) *MovementsRepo {
	return &MovementsRepo{RepoBase{Pool: pool}}
}

func (r *MovementsRepo) ListByDay(ctx context.Context, dayID string) ([]models.Movement, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, day_id, title, COALESCE(description,''), 
		       from_location_id::text, to_location_id::text, 
		       to_char(from_time,'HH24:MI') AS from_time, to_time_type, 
		       COALESCE(to_char(to_time,'HH24:MI'),''), driving_minutes
		FROM movements
		WHERE day_id=$1
		ORDER BY from_time ASC
	`, dayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.Movement
	for rows.Next() {
		var m models.Movement
		var fromLoc, toLoc *string
		var toTime string
		var driving *int
		if err := rows.Scan(&m.ID, &m.DayID, &m.Title, &m.Description, &fromLoc, &toLoc, &m.FromTime, &m.ToTimeType, &toTime, &driving); err != nil {
			return nil, err
		}
		// Convert nullable strings to empty string if nil
		if fromLoc != nil {
			m.FromLocationID = *fromLoc
		} else {
			m.FromLocationID = ""
		}
		if toLoc != nil {
			m.ToLocationID = *toLoc
		} else {
			m.ToLocationID = ""
		}
		// Handle ToTime: if fixed, use time string; if driving, convert minutes to string
		if m.ToTimeType == "fixed" {
			m.ToTime = toTime
		} else if driving != nil {
			// Convert minutes to string representation
			m.ToTime = strconv.Itoa(*driving)
			// Calculate hours and minutes
			hours := *driving / 60
			minutes := *driving % 60
			if hours > 0 {
				h := hours
				m.DrivingTimeHours = &h
			}
			if minutes > 0 {
				m.DrivingTimeMinutes = &minutes
			}
		} else {
			m.ToTime = ""
		}
		items = append(items, m)
	}
	// assignments
	assignRows, err := r.Pool.Query(ctx, `
		SELECT id, movement_id, vehicle_id, driver_id::text
		FROM vehicle_assignments
		WHERE movement_id = ANY($1::uuid[])
	`, collectMovementIDs(items))
	if err != nil {
		return nil, err
	}
	defer assignRows.Close()
	assignByMovement := map[string][]models.VehicleAssignment{}
	var assignIDs []string
	for assignRows.Next() {
		var a models.VehicleAssignment
		var driver *string
		if err := assignRows.Scan(&a.ID, &a.MovementID, &a.VehicleID, &driver); err != nil {
			return nil, err
		}
		a.DriverID = driver
		assignByMovement[a.MovementID] = append(assignByMovement[a.MovementID], a)
		assignIDs = append(assignIDs, a.ID)
	}
	// passengers
	if len(assignIDs) > 0 {
		passRows, err := r.Pool.Query(ctx, `
			SELECT assignment_id, participant_id::text
			FROM vehicle_assignment_passengers
			WHERE assignment_id = ANY($1::uuid[])
		`, assignIDs)
		if err != nil {
			return nil, err
		}
		defer passRows.Close()
		passByAssign := map[string][]string{}
		for passRows.Next() {
			var aid, pid string
			if err := passRows.Scan(&aid, &pid); err != nil {
				return nil, err
			}
			passByAssign[aid] = append(passByAssign[aid], pid)
		}
		for mid, arr := range assignByMovement {
			for i := range arr {
				arr[i].ParticipantIDs = passByAssign[arr[i].ID]
			}
			assignByMovement[mid] = arr
		}
	}
	for i := range items {
		items[i].VehicleAssignments = assignByMovement[items[i].ID]
	}
	return items, rows.Err()
}

func collectMovementIDs(ms []models.Movement) []string {
	ids := make([]string, 0, len(ms))
	for _, m := range ms {
		ids = append(ids, m.ID)
	}
	return ids
}

// ListByDays fetches all movements for multiple days in a single query
func (r *MovementsRepo) ListByDays(ctx context.Context, dayIDs []string) ([]models.Movement, error) {
	if len(dayIDs) == 0 {
		return []models.Movement{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, day_id, title, COALESCE(description,''), 
		       from_location_id::text, to_location_id::text, 
		       to_char(from_time,'HH24:MI') AS from_time, to_time_type, 
		       COALESCE(to_char(to_time,'HH24:MI'),''), driving_minutes
		FROM movements
		WHERE day_id = ANY($1::uuid[])
		ORDER BY day_id, from_time ASC
	`, dayIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.Movement
	for rows.Next() {
		var m models.Movement
		var fromLoc, toLoc *string
		var toTime string
		var driving *int
		if err := rows.Scan(&m.ID, &m.DayID, &m.Title, &m.Description, &fromLoc, &toLoc, &m.FromTime, &m.ToTimeType, &toTime, &driving); err != nil {
			return nil, err
		}
		// Convert nullable strings to empty string if nil
		if fromLoc != nil {
			m.FromLocationID = *fromLoc
		} else {
			m.FromLocationID = ""
		}
		if toLoc != nil {
			m.ToLocationID = *toLoc
		} else {
			m.ToLocationID = ""
		}
		// Handle ToTime: if fixed, use time string; if driving, convert minutes to string
		if m.ToTimeType == "fixed" {
			m.ToTime = toTime
		} else if driving != nil {
			// Convert minutes to string representation
			m.ToTime = strconv.Itoa(*driving)
			// Calculate hours and minutes
			hours := *driving / 60
			minutes := *driving % 60
			if hours > 0 {
				h := hours
				m.DrivingTimeHours = &h
			}
			if minutes > 0 {
				m.DrivingTimeMinutes = &minutes
			}
		} else {
			m.ToTime = ""
		}
		items = append(items, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	// Batch fetch assignments for all movements
	if len(items) > 0 {
		assignRows, err := r.Pool.Query(ctx, `
			SELECT id, movement_id, vehicle_id, driver_id::text
			FROM vehicle_assignments
			WHERE movement_id = ANY($1::uuid[])
		`, collectMovementIDs(items))
		if err != nil {
			return nil, err
		}
		defer assignRows.Close()
		assignByMovement := map[string][]models.VehicleAssignment{}
		var assignIDs []string
		for assignRows.Next() {
			var a models.VehicleAssignment
			var driver *string
			if err := assignRows.Scan(&a.ID, &a.MovementID, &a.VehicleID, &driver); err != nil {
				return nil, err
			}
			a.DriverID = driver
			assignByMovement[a.MovementID] = append(assignByMovement[a.MovementID], a)
			assignIDs = append(assignIDs, a.ID)
		}
		if err := assignRows.Err(); err != nil {
			return nil, err
		}
		// Batch fetch passengers
		if len(assignIDs) > 0 {
			passRows, err := r.Pool.Query(ctx, `
				SELECT assignment_id, participant_id::text
				FROM vehicle_assignment_passengers
				WHERE assignment_id = ANY($1::uuid[])
			`, assignIDs)
			if err != nil {
				return nil, err
			}
			defer passRows.Close()
			passByAssign := map[string][]string{}
			for passRows.Next() {
				var aid, pid string
				if err := passRows.Scan(&aid, &pid); err != nil {
					return nil, err
				}
				passByAssign[aid] = append(passByAssign[aid], pid)
			}
			if err := passRows.Err(); err != nil {
				return nil, err
			}
			for mid, arr := range assignByMovement {
				for i := range arr {
					arr[i].ParticipantIDs = passByAssign[arr[i].ID]
					if arr[i].ParticipantIDs == nil {
						arr[i].ParticipantIDs = []string{}
					}
				}
				assignByMovement[mid] = arr
			}
		}
		for i := range items {
			items[i].VehicleAssignments = assignByMovement[items[i].ID]
			if items[i].VehicleAssignments == nil {
				items[i].VehicleAssignments = []models.VehicleAssignment{}
			}
		}
	}
	
	return items, nil
}

func (r *MovementsRepo) Get(ctx context.Context, dayID, id string) (models.Movement, error) {
	list, err := r.ListByDay(ctx, dayID)
	if err != nil {
		return models.Movement{}, err
	}
	for _, m := range list {
		if m.ID == id {
			return m, nil
		}
	}
	return models.Movement{}, ErrNotFound
}

func (r *MovementsRepo) Create(ctx context.Context, in models.Movement) (models.Movement, error) {
	if in.ID == "" {
		in.ID = uuid.NewString()
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return models.Movement{}, err
	}
	defer rollbackTx(tx)
	// Convert ToTime and driving time to DB format
	var toTime interface{}
	var drivingMinutes *int
	if in.ToTimeType == "fixed" {
		if in.ToTime != "" {
			toTime = in.ToTime
		}
	} else {
		// driving type: convert ToTime string (minutes) to int, or use DrivingTimeHours/DrivingTimeMinutes
		if in.ToTime != "" {
			if mins, err := strconv.Atoi(in.ToTime); err == nil {
				drivingMinutes = &mins
			}
		} else if in.DrivingTimeHours != nil || in.DrivingTimeMinutes != nil {
			totalMinutes := 0
			if in.DrivingTimeHours != nil {
				totalMinutes += *in.DrivingTimeHours * 60
			}
			if in.DrivingTimeMinutes != nil {
				totalMinutes += *in.DrivingTimeMinutes
			}
			drivingMinutes = &totalMinutes
		}
	}
	var fromLoc, toLoc interface{}
	if in.FromLocationID != "" {
		fromLoc = in.FromLocationID
	}
	if in.ToLocationID != "" {
		toLoc = in.ToLocationID
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO movements (id, day_id, title, description, from_location_id, to_location_id, from_time, to_time_type, to_time, driving_minutes)
		VALUES ($1,$2,$3,$4,NULLIF($5,'')::uuid,NULLIF($6,'')::uuid,$7::time,$8, NULLIF($9,'')::time, $10)
	`, in.ID, in.DayID, in.Title, in.Description, fromLoc, toLoc, in.FromTime, in.ToTimeType, toTime, drivingMinutes)
	if err != nil {
		return models.Movement{}, err
	}
	// assignments
	for _, a := range in.VehicleAssignments {
		aid := uuid.NewString()
		_, err := tx.Exec(ctx, `
			INSERT INTO vehicle_assignments (id, movement_id, vehicle_id, driver_id)
			VALUES ($1,$2,$3,NULLIF($4,'')::uuid)
		`, aid, in.ID, a.VehicleID, a.DriverID)
		if err != nil {
			return models.Movement{}, err
		}
		for _, pid := range a.ParticipantIDs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO vehicle_assignment_passengers (assignment_id, participant_id)
				VALUES ($1,$2) ON CONFLICT DO NOTHING
			`, aid, pid); err != nil {
				return models.Movement{}, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Movement{}, err
	}
	return in, nil
}

func (r *MovementsRepo) Update(ctx context.Context, id string, in models.Movement) (models.Movement, error) {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return models.Movement{}, err
	}
	defer rollbackTx(tx)
	// Convert ToTime and driving time to DB format
	var toTime interface{}
	var drivingMinutes *int
	if in.ToTimeType == "fixed" {
		if in.ToTime != "" {
			toTime = in.ToTime
		}
	} else {
		// driving type: convert ToTime string (minutes) to int, or use DrivingTimeHours/DrivingTimeMinutes
		if in.ToTime != "" {
			if mins, err := strconv.Atoi(in.ToTime); err == nil {
				drivingMinutes = &mins
			}
		} else if in.DrivingTimeHours != nil || in.DrivingTimeMinutes != nil {
			totalMinutes := 0
			if in.DrivingTimeHours != nil {
				totalMinutes += *in.DrivingTimeHours * 60
			}
			if in.DrivingTimeMinutes != nil {
				totalMinutes += *in.DrivingTimeMinutes
			}
			drivingMinutes = &totalMinutes
		}
	}
	var fromLoc, toLoc interface{}
	if in.FromLocationID != "" {
		fromLoc = in.FromLocationID
	}
	if in.ToLocationID != "" {
		toLoc = in.ToLocationID
	}
	tag, err := tx.Exec(ctx, `
		UPDATE movements
		SET title=$2, description=$3, from_location_id=NULLIF($4,'')::uuid, to_location_id=NULLIF($5,'')::uuid,
		    from_time=$6::time, to_time_type=$7, to_time=NULLIF($8,'')::time, driving_minutes=$9
		WHERE id=$1
	`, id, in.Title, in.Description, fromLoc, toLoc, in.FromTime, in.ToTimeType, toTime, drivingMinutes)
	if err != nil {
		return models.Movement{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Movement{}, ErrNotFound
	}
	// replace assignments
	if _, err := tx.Exec(ctx, `DELETE FROM vehicle_assignment_passengers WHERE assignment_id IN (SELECT id FROM vehicle_assignments WHERE movement_id=$1)`, id); err != nil {
		return models.Movement{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM vehicle_assignments WHERE movement_id=$1`, id); err != nil {
		return models.Movement{}, err
	}
	for _, a := range in.VehicleAssignments {
		aid := uuid.NewString()
		if _, err := tx.Exec(ctx, `
			INSERT INTO vehicle_assignments (id, movement_id, vehicle_id, driver_id)
			VALUES ($1,$2,$3,NULLIF($4,'')::uuid)
		`, aid, id, a.VehicleID, a.DriverID); err != nil {
			return models.Movement{}, err
		}
		for _, pid := range a.ParticipantIDs {
			if _, err := tx.Exec(ctx, `
				INSERT INTO vehicle_assignment_passengers (assignment_id, participant_id) VALUES ($1,$2)
			`, aid, pid); err != nil {
				return models.Movement{}, err
			}
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Movement{}, err
	}
	in.ID = id
	return in, nil
}

func (r *MovementsRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM movements WHERE id=$1`, id)
	return err
}

func nullablePtr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}


