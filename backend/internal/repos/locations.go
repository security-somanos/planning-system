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
		SELECT id, name, COALESCE(address,''), COALESCE(google_maps_link,''), COALESCE(type,''), COALESCE(contact, '{}')
		FROM locations
		ORDER BY name ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.Location
	locationIDs := make([]string, 0)
	locationMap := make(map[string]*models.Location)
	
	for rows.Next() {
		var m models.Location
		if err := rows.Scan(&m.ID, &m.Name, &m.Address, &m.GoogleMapsLink, &m.Type, &m.Contact); err != nil {
			return nil, err
		}
		m.SiteManagerIDs = []string{}
		items = append(items, m)
		locationIDs = append(locationIDs, m.ID)
		locationMap[m.ID] = &items[len(items)-1]
	}
	
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	// Load site managers for all locations
	if len(locationIDs) > 0 {
		managerRows, err := r.Pool.Query(ctx, `
			SELECT location_id, participant_id
			FROM location_site_managers
			WHERE location_id = ANY($1::uuid[])
		`, locationIDs)
		if err != nil {
			return nil, err
		}
		defer managerRows.Close()
		
		for managerRows.Next() {
			var locationID, participantID string
			if err := managerRows.Scan(&locationID, &participantID); err != nil {
				return nil, err
			}
			if loc, ok := locationMap[locationID]; ok {
				loc.SiteManagerIDs = append(loc.SiteManagerIDs, participantID)
			}
		}
		if err := managerRows.Err(); err != nil {
			return nil, err
		}
	}
	
	return items, nil
}

func (r *LocationsRepo) Get(ctx context.Context, id string) (models.Location, error) {
	var m models.Location
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(address,''), COALESCE(google_maps_link,''), COALESCE(type,''), COALESCE(contact, '{}')
		FROM locations WHERE id = $1
	`, id), &m, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, name, COALESCE(address,''), COALESCE(google_maps_link,''), COALESCE(type,''), COALESCE(contact, '{}')
			FROM locations WHERE id = $1
		`, id).Scan(&m.ID, &m.Name, &m.Address, &m.GoogleMapsLink, &m.Type, &m.Contact)
	})
	if err != nil {
		return m, err
	}
	
	// Load site managers
	m.SiteManagerIDs = []string{}
	managerRows, err := r.Pool.Query(ctx, `
		SELECT participant_id
		FROM location_site_managers
		WHERE location_id = $1
	`, id)
	if err != nil {
		return m, err
	}
	defer managerRows.Close()
	
	for managerRows.Next() {
		var participantID string
		if err := managerRows.Scan(&participantID); err != nil {
			return m, err
		}
		m.SiteManagerIDs = append(m.SiteManagerIDs, participantID)
	}
	
	return m, managerRows.Err()
}

func (r *LocationsRepo) Create(ctx context.Context, in models.Location) (models.Location, error) {
	if in.ID == "" {
		in.ID = uuid.NewString()
	}
	
	// Ensure contact is not nil
	if in.Contact == nil {
		in.Contact = []string{}
	}
	
	// Start transaction
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback(ctx)
	
	// Insert location
	_, err = tx.Exec(ctx, `
		INSERT INTO locations (id, name, address, google_maps_link, type, contact)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, in.ID, in.Name, in.Address, in.GoogleMapsLink, in.Type, in.Contact)
	if err != nil {
		return models.Location{}, err
	}
	
	// Insert site managers
	if len(in.SiteManagerIDs) > 0 {
		for _, participantID := range in.SiteManagerIDs {
			_, err = tx.Exec(ctx, `
				INSERT INTO location_site_managers (location_id, participant_id)
				VALUES ($1, $2)
			`, in.ID, participantID)
			if err != nil {
				return models.Location{}, err
			}
		}
	}
	
	if err = tx.Commit(ctx); err != nil {
		return models.Location{}, err
	}
	
	return in, nil
}

func (r *LocationsRepo) Update(ctx context.Context, id string, in models.Location) (models.Location, error) {
	// Ensure contact is not nil
	if in.Contact == nil {
		in.Contact = []string{}
	}
	
	// Start transaction
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return models.Location{}, err
	}
	defer tx.Rollback(ctx)
	
	// Update location
	tag, err := tx.Exec(ctx, `
		UPDATE locations
		SET name=$2, address=$3, google_maps_link=$4, type=$5, contact=$6
		WHERE id=$1
	`, id, in.Name, in.Address, in.GoogleMapsLink, in.Type, in.Contact)
	if err != nil {
		return models.Location{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Location{}, ErrNotFound
	}
	
	// Delete existing site managers
	_, err = tx.Exec(ctx, `DELETE FROM location_site_managers WHERE location_id = $1`, id)
	if err != nil {
		return models.Location{}, err
	}
	
	// Insert new site managers
	if len(in.SiteManagerIDs) > 0 {
		for _, participantID := range in.SiteManagerIDs {
			_, err = tx.Exec(ctx, `
				INSERT INTO location_site_managers (location_id, participant_id)
				VALUES ($1, $2)
			`, id, participantID)
			if err != nil {
				return models.Location{}, err
			}
		}
	}
	
	if err = tx.Commit(ctx); err != nil {
		return models.Location{}, err
	}
	
	in.ID = id
	return in, nil
}

func (r *LocationsRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM locations WHERE id=$1`, id)
	return err
}


