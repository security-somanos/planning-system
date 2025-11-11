package repos

import (
	"context"
	"time"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DaysRepo struct{ RepoBase }

func NewDaysRepo(pool *pgxpool.Pool) *DaysRepo {
	return &DaysRepo{RepoBase{Pool: pool}}
}

func (r *DaysRepo) List(ctx context.Context) ([]models.Day, error) {
	// Add query timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	rows, err := r.Pool.Query(ctx, `
		SELECT id, event_id, to_char(date, 'YYYY-MM-DD') as date
		FROM days
		ORDER BY date ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var items []models.Day
	var dayIDs []string
	for rows.Next() {
		var m models.Day
		if err := rows.Scan(&m.ID, &m.EventID, &m.Date); err != nil {
			return nil, err
		}
		m.Blocks = []models.Block{}
		m.Movements = []models.Movement{}
		items = append(items, m)
		dayIDs = append(dayIDs, m.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	if len(dayIDs) == 0 {
		return items, nil
	}
	
	// Batch fetch all blocks and movements for all days
	blocksRepo := NewBlocksRepo(r.Pool)
	movementsRepo := NewMovementsRepo(r.Pool)
	
	// Fetch all blocks for all days in one go
	allBlocks, err := blocksRepo.ListByDays(ctx, dayIDs)
	if err != nil {
		return nil, err
	}
	
	// Fetch all movements for all days in one go
	allMovements, err := movementsRepo.ListByDays(ctx, dayIDs)
	if err != nil {
		return nil, err
	}
	
	// Group blocks and movements by day_id
	blocksByDay := make(map[string][]models.Block)
	for _, block := range allBlocks {
		blocksByDay[block.DayID] = append(blocksByDay[block.DayID], block)
	}
	
	movementsByDay := make(map[string][]models.Movement)
	for _, movement := range allMovements {
		movementsByDay[movement.DayID] = append(movementsByDay[movement.DayID], movement)
	}
	
	// Assign blocks and movements to days
	for i := range items {
		if blocks, ok := blocksByDay[items[i].ID]; ok {
			items[i].Blocks = blocks
		}
		if movements, ok := movementsByDay[items[i].ID]; ok {
			items[i].Movements = movements
		}
	}
	
	return items, nil
}

func (r *DaysRepo) Get(ctx context.Context, id string) (models.Day, error) {
	// Add query timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	var m models.Day
	err := scanOne(ctx, r.Pool.QueryRow(ctx, `
		SELECT id, event_id, to_char(date, 'YYYY-MM-DD')
		FROM days WHERE id = $1
	`, id), &m, func() error {
		return r.Pool.QueryRow(ctx, `
			SELECT id, event_id, to_char(date, 'YYYY-MM-DD')
			FROM days WHERE id = $1
		`, id).Scan(&m.ID, &m.EventID, &m.Date)
	})
	if err != nil {
		return m, err
	}
	// Fetch blocks and movements for this day
	blocksRepo := NewBlocksRepo(r.Pool)
	movementsRepo := NewMovementsRepo(r.Pool)
	blocks, err := blocksRepo.ListByDay(ctx, m.ID)
	if err != nil {
		return m, err
	}
	movements, err := movementsRepo.ListByDay(ctx, m.ID)
	if err != nil {
		return m, err
	}
	m.Blocks = blocks
	m.Movements = movements
	return m, nil
}

func (r *DaysRepo) CreateRange(ctx context.Context, eventID string, fromDate, toDate string) ([]models.Day, error) {
	// parse dates
	start, err := time.Parse("2006-01-02", fromDate)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse("2006-01-02", toDate)
	if err != nil {
		return nil, err
	}
	if end.Before(start) {
		start, end = end, start
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer rollbackTx(tx)

	var created []models.Day
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		id := uuid.NewString()
		_, err := tx.Exec(ctx, `
			INSERT INTO days (id, event_id, date)
			VALUES ($1,$2,$3)
			ON CONFLICT (event_id, date) DO NOTHING
		`, id, eventID, d)
		if err != nil {
			return nil, err
		}
		// capture effective id
		var out models.Day
		err = tx.QueryRow(ctx, `
			SELECT id, event_id, to_char(date,'YYYY-MM-DD')
			FROM days WHERE event_id=$1 AND date=$2
		`, eventID, d).Scan(&out.ID, &out.EventID, &out.Date)
		if err != nil {
			return nil, err
		}
		// Initialize empty arrays for blocks and movements
		out.Blocks = []models.Block{}
		out.Movements = []models.Movement{}
		created = append(created, out)
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return created, nil
}

func (r *DaysRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM days WHERE id=$1`, id)
	return err
}


