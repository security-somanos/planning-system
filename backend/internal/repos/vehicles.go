package repos

import (
	"context"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type VehiclesRepo struct{ RepoBase }

func NewVehiclesRepo(pool *pgxpool.Pool) *VehiclesRepo {
	return &VehiclesRepo{RepoBase{Pool: pool}}
}

func (r *VehiclesRepo) List(ctx context.Context) ([]models.Vehicle, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, label, COALESCE(make,''), COALESCE(model,''), COALESCE(license_plate,''), capacity, COALESCE(notes,''),
		       to_char(available_from,'HH24:MI'), to_char(available_to,'HH24:MI'), origination_location_id::text
		FROM vehicles
		ORDER BY label ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.Vehicle
	for rows.Next() {
		var m models.Vehicle
		var capacity *int
		var availableFrom, availableTo, originationLocationID *string
		if err := rows.Scan(&m.ID, &m.Label, &m.Make, &m.Model, &m.LicensePlate, &capacity, &m.Notes, &availableFrom, &availableTo, &originationLocationID); err != nil {
			return nil, err
		}
		m.Capacity = capacity
		m.AvailableFrom = availableFrom
		m.AvailableTo = availableTo
		m.OriginationLocationID = originationLocationID
		items = append(items, m)
	}
	return items, rows.Err()
}

func (r *VehiclesRepo) Get(ctx context.Context, id string) (models.Vehicle, error) {
	var m models.Vehicle
	var capacity *int
	var availableFrom, availableTo, originationLocationID *string
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, label, COALESCE(make,''), COALESCE(model,''), COALESCE(license_plate,''), capacity, COALESCE(notes,''),
		       to_char(available_from,'HH24:MI'), to_char(available_to,'HH24:MI'), origination_location_id::text
		FROM vehicles WHERE id = $1
	`, id), &m, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, label, COALESCE(make,''), COALESCE(model,''), COALESCE(license_plate,''), capacity, COALESCE(notes,''),
			       to_char(available_from,'HH24:MI'), to_char(available_to,'HH24:MI'), origination_location_id::text
			FROM vehicles WHERE id = $1
		`, id).Scan(&m.ID, &m.Label, &m.Make, &m.Model, &m.LicensePlate, &capacity, &m.Notes, &availableFrom, &availableTo, &originationLocationID)
	})
	if err == nil {
		m.Capacity = capacity
		m.AvailableFrom = availableFrom
		m.AvailableTo = availableTo
		m.OriginationLocationID = originationLocationID
	}
	return m, err
}

func (r *VehiclesRepo) Create(ctx context.Context, in models.Vehicle) (models.Vehicle, error) {
	if in.ID == "" {
		in.ID = uuid.NewString()
	}
	var availableFrom, availableTo interface{}
	if in.AvailableFrom != nil && *in.AvailableFrom != "" {
		availableFrom = *in.AvailableFrom
	}
	if in.AvailableTo != nil && *in.AvailableTo != "" {
		availableTo = *in.AvailableTo
	}
	var capacity interface{}
	if in.Capacity != nil {
		capacity = *in.Capacity
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO vehicles (id, label, make, model, license_plate, capacity, notes, available_from, available_to, origination_location_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, in.ID, in.Label, in.Make, in.Model, in.LicensePlate, capacity, in.Notes, availableFrom, availableTo, in.OriginationLocationID)
	return in, err
}

func (r *VehiclesRepo) Update(ctx context.Context, id string, in models.Vehicle) (models.Vehicle, error) {
	var availableFrom, availableTo interface{}
	if in.AvailableFrom != nil && *in.AvailableFrom != "" {
		availableFrom = *in.AvailableFrom
	}
	if in.AvailableTo != nil && *in.AvailableTo != "" {
		availableTo = *in.AvailableTo
	}
	var capacity interface{}
	if in.Capacity != nil {
		capacity = *in.Capacity
	}
	tag, err := r.Pool.Exec(ctx, `
		UPDATE vehicles
		SET label=$2, make=$3, model=$4, license_plate=$5, capacity=$6, notes=$7, available_from=$8, available_to=$9, origination_location_id=$10
		WHERE id=$1
	`, id, in.Label, in.Make, in.Model, in.LicensePlate, capacity, in.Notes, availableFrom, availableTo, in.OriginationLocationID)
	if err != nil {
		return models.Vehicle{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Vehicle{}, ErrNotFound
	}
	in.ID = id
	return in, nil
}

func (r *VehiclesRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM vehicles WHERE id=$1`, id)
	return err
}


