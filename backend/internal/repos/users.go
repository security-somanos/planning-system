package repos

import (
	"context"
	"time"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type UsersRepo struct{ RepoBase }

func NewUsersRepo(pool *pgxpool.Pool) *UsersRepo {
	return &UsersRepo{RepoBase{Pool: pool}}
}

func (r *UsersRepo) GetByEmail(ctx context.Context, email string) (models.User, error) {
	var u models.User
	var createdAt, updatedAt time.Time
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, role, is_user_enabled, created_at, updated_at
		FROM users WHERE email = $1
	`, email), &u, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, email, password_hash, role, is_user_enabled, created_at, updated_at
			FROM users WHERE email = $1
		`, email).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.IsUserEnabled, &createdAt, &updatedAt)
	})
	if err == nil {
		u.CreatedAt = createdAt.Format(time.RFC3339)
		u.UpdatedAt = updatedAt.Format(time.RFC3339)
	}
	return u, err
}

func (r *UsersRepo) Get(ctx context.Context, id string) (models.User, error) {
	var u models.User
	var createdAt, updatedAt time.Time
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, email, password_hash, role, is_user_enabled, created_at, updated_at
		FROM users WHERE id = $1
	`, id), &u, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, email, password_hash, role, is_user_enabled, created_at, updated_at
			FROM users WHERE id = $1
		`, id).Scan(&u.ID, &u.Email, &u.PasswordHash, &u.Role, &u.IsUserEnabled, &createdAt, &updatedAt)
	})
	if err == nil {
		u.CreatedAt = createdAt.Format(time.RFC3339)
		u.UpdatedAt = updatedAt.Format(time.RFC3339)
	}
	return u, err
}

func (r *UsersRepo) List(ctx context.Context, p PageParams) ([]models.User, int64, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, email, role, is_user_enabled, created_at, updated_at
		FROM users
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`, p.Limit, p.Offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]models.User, 0)
	for rows.Next() {
		var u models.User
		var createdAt, updatedAt time.Time
		if err := rows.Scan(&u.ID, &u.Email, &u.Role, &u.IsUserEnabled, &createdAt, &updatedAt); err != nil {
			return nil, 0, err
		}
		u.CreatedAt = createdAt.Format(time.RFC3339)
		u.UpdatedAt = updatedAt.Format(time.RFC3339)
		items = append(items, u)
	}
	var total int64
	if err := r.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&total); err != nil {
		return nil, 0, err
	}
	return items, total, rows.Err()
}

func (r *UsersRepo) Create(ctx context.Context, email, passwordHash, role string, isUserEnabled bool) (models.User, error) {
	id := uuid.NewString()
	now := time.Now()
	var u models.User
	var createdAt, updatedAt time.Time
	err := r.Pool.QueryRow(ctx, `
		INSERT INTO users (id, email, password_hash, role, is_user_enabled, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, email, role, is_user_enabled, created_at, updated_at
	`, id, email, passwordHash, role, isUserEnabled, now, now).Scan(&u.ID, &u.Email, &u.Role, &u.IsUserEnabled, &createdAt, &updatedAt)
	if err == nil {
		u.CreatedAt = createdAt.Format(time.RFC3339)
		u.UpdatedAt = updatedAt.Format(time.RFC3339)
	}
	return u, err
}

func (r *UsersRepo) Update(ctx context.Context, id string, email, role *string, isUserEnabled *bool) (models.User, error) {
	now := time.Now()
	var u models.User
	var createdAt, updatedAt time.Time

	// Build dynamic update query
	updates := []string{"updated_at = $1"}
	args := []interface{}{now}
	argIdx := 2

	if email != nil {
		updates = append(updates, "email = $"+itoa(argIdx))
		args = append(args, *email)
		argIdx++
	}
	if role != nil {
		updates = append(updates, "role = $"+itoa(argIdx))
		args = append(args, *role)
		argIdx++
	}
	if isUserEnabled != nil {
		updates = append(updates, "is_user_enabled = $"+itoa(argIdx))
		args = append(args, *isUserEnabled)
		argIdx++
	}

	args = append(args, id)
	query := `
		UPDATE users
		SET ` + joinStrings(updates, ", ") + `
		WHERE id = $` + itoa(argIdx) + `
		RETURNING id, email, role, is_user_enabled, created_at, updated_at
	`

	err := r.Pool.QueryRow(ctx, query, args...).Scan(&u.ID, &u.Email, &u.Role, &u.IsUserEnabled, &createdAt, &updatedAt)
	if err != nil {
		return models.User{}, err
	}
	u.CreatedAt = createdAt.Format(time.RFC3339)
	u.UpdatedAt = updatedAt.Format(time.RFC3339)
	return u, nil
}

// UpdatePassword updates the password hash for a user
func (r *UsersRepo) UpdatePassword(ctx context.Context, id string, passwordHash string) error {
	now := time.Now()
	_, err := r.Pool.Exec(ctx, `
		UPDATE users
		SET password_hash = $1, updated_at = $2
		WHERE id = $3
	`, passwordHash, now, id)
	return err
}

func (r *UsersRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM users WHERE id=$1`, id)
	return err
}

// Count returns the total number of users in the database
func (r *UsersRepo) Count(ctx context.Context) (int64, error) {
	var count int64
	err := r.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	return count, err
}

func joinStrings(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
