package repos

import (
	"context"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type LocationsRepo struct{ RepoBase }

func NewLocationsRepo(pool *pgxpool.Pool) *LocationsRepo {
	return &LocationsRepo{RepoBase{Pool: pool}}
}

func (r *LocationsRepo) List(ctx context.Context) ([]models.Location, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, name, COALESCE(address,''), COALESCE(google_maps_link,''), COALESCE(type,'')
		FROM locations
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.Location
	for rows.Next() {
		var m models.Location
		if err := rows.Scan(&m.ID, &m.Name, &m.Address, &m.GoogleMapsLink, &m.Type); err != nil {
			return nil, err
		}
		items = append(items, m)
	}
	return items, rows.Err()
}

func (r *LocationsRepo) Get(ctx context.Context, id string) (models.Location, error) {
	var m models.Location
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(address,''), COALESCE(google_maps_link,''), COALESCE(type,'')
		FROM locations WHERE id = $1
	`, id), &m, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, name, COALESCE(address,''), COALESCE(google_maps_link,''), COALESCE(type,'')
			FROM locations WHERE id = $1
		`, id).Scan(&m.ID, &m.Name, &m.Address, &m.GoogleMapsLink, &m.Type)
	})
	return m, err
}

func (r *LocationsRepo) Create(ctx context.Context, in models.Location) (models.Location, error) {
	if in.ID == "" {
		in.ID = uuid.NewString()
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO locations (id, name, address, google_maps_link, type)
		VALUES ($1,$2,$3,$4,$5)
	`, in.ID, in.Name, in.Address, in.GoogleMapsLink, in.Type)
	return in, err
}

func (r *LocationsRepo) Update(ctx context.Context, id string, in models.Location) (models.Location, error) {
	tag, err := r.Pool.Exec(ctx, `
		UPDATE locations
		SET name=$2, address=$3, google_maps_link=$4, type=$5
		WHERE id=$1
	`, id, in.Name, in.Address, in.GoogleMapsLink, in.Type)
	if err != nil {
		return models.Location{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Location{}, ErrNotFound
	}
	in.ID = id
	return in, nil
}

func (r *LocationsRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM locations WHERE id=$1`, id)
	return err
}


