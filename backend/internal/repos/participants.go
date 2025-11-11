package repos

import (
	"context"
	"strings"
	"strconv"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ParticipantsRepo struct{ RepoBase }

func NewParticipantsRepo(pool *pgxpool.Pool) *ParticipantsRepo {
	return &ParticipantsRepo{RepoBase{Pool: pool}}
}

func (r *ParticipantsRepo) List(ctx context.Context, p PageParams, search, role string) ([]models.Participant, int64, error) {
	args := []any{}
	where := []string{}
	if search != "" {
		args = append(args, "%"+strings.ToLower(search)+"%")
		where = append(where, "(LOWER(name) LIKE $"+itoa(len(args))+" OR LOWER(email) LIKE $"+itoa(len(args))+" OR LOWER(phone) LIKE $"+itoa(len(args))+")")
	}
	if role != "" {
		args = append(args, strings.ToLower(role))
		where = append(where, "EXISTS (SELECT 1 FROM unnest(roles) r WHERE LOWER(r) = $"+itoa(len(args))+")")
	}
	q := `
		SELECT id, name, roles, COALESCE(email,''), COALESCE(phone,''), languages
		FROM participants
	`
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}
	q += " ORDER BY name ASC LIMIT $" + itoa(len(args)+1) + " OFFSET $" + itoa(len(args)+2)
	args = append(args, p.Limit, p.Offset)
	rows, err := r.Pool.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]models.Participant, 0) // Initialize as empty slice, not nil
	for rows.Next() {
		var m models.Participant
		if err := rows.Scan(&m.ID, &m.Name, &m.Roles, &m.Email, &m.Phone, &m.Languages); err != nil {
			return nil, 0, err
		}
		items = append(items, m)
	}
	var total int64
	countQ := "SELECT COUNT(*) FROM participants"
	if len(where) > 0 {
		countQ += " WHERE " + strings.Join(where, " AND ")
	}
	if err := r.Pool.QueryRow(ctx, countQ, args[:len(args)-2]...).Scan(&total); err != nil {
		return nil, 0, err
	}
	return items, total, rows.Err()
}

func (r *ParticipantsRepo) Get(ctx context.Context, id string) (models.Participant, error) {
	var m models.Participant
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, name, roles, COALESCE(email,''), COALESCE(phone,''), languages
		FROM participants WHERE id = $1
	`, id), &m, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, name, roles, COALESCE(email,''), COALESCE(phone,''), languages
			FROM participants WHERE id = $1
		`, id).Scan(&m.ID, &m.Name, &m.Roles, &m.Email, &m.Phone, &m.Languages)
	})
	return m, err
}

func (r *ParticipantsRepo) Create(ctx context.Context, in models.Participant) (models.Participant, error) {
	if in.ID == "" {
		in.ID = uuid.NewString()
	}
	_, err := r.Pool.Exec(ctx, `
		INSERT INTO participants (id, name, roles, email, phone, languages)
		VALUES ($1,$2,$3,$4,$5,$6)
	`, in.ID, in.Name, in.Roles, in.Email, in.Phone, in.Languages)
	return in, err
}

func (r *ParticipantsRepo) Update(ctx context.Context, id string, in models.Participant) (models.Participant, error) {
	tag, err := r.Pool.Exec(ctx, `
		UPDATE participants
		SET name=$2, roles=$3, email=$4, phone=$5, languages=$6
		WHERE id=$1
	`, id, in.Name, in.Roles, in.Email, in.Phone, in.Languages)
	if err != nil {
		return models.Participant{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Participant{}, ErrNotFound
	}
	in.ID = id
	return in, nil
}

func (r *ParticipantsRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM participants WHERE id=$1`, id)
	return err
}

func itoa(i int) string {
	return strconv.Itoa(i)
}


