package repos

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type RepoBase struct {
	Pool *pgxpool.Pool
}

func NewBase(pool *pgxpool.Pool) RepoBase {
	return RepoBase{Pool: pool}
}

var ErrNotFound = errors.New("not found")

type PageParams struct {
	Limit  int
	Offset int
}

func ParsePagination(limitStr, offsetStr string) PageParams {
	limit := 50
	offset := 0
	if limitStr != "" {
		if v, err := strconv.Atoi(limitStr); err == nil && v > 0 && v <= 200 {
			limit = v
		}
	}
	if offsetStr != "" {
		if v, err := strconv.Atoi(offsetStr); err == nil && v >= 0 {
			offset = v
		}
	}
	return PageParams{Limit: limit, Offset: offset}
}

func scanOne[T any](ctx context.Context, q pgx.Row, dest *T, scanner func() error) error {
	if err := scanner(); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// rollbackTx safely rolls back a transaction using a background context
// to ensure rollback completes even if the request context is cancelled
func rollbackTx(tx pgx.Tx) {
	// Use background context with timeout for rollback
	bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = tx.Rollback(bgCtx)
}

// queryWithTimeout adds a timeout to a context for database queries
func queryWithTimeout(ctx context.Context, timeout time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, timeout)
}


