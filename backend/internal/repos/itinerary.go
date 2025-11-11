package repos

import (
	"context"
	"time"

	"planning-system/backend/internal/models"

	"github.com/jackc/pgx/v5/pgxpool"
)

type ItineraryRepo struct{ RepoBase }

func NewItineraryRepo(pool *pgxpool.Pool) *ItineraryRepo {
	return &ItineraryRepo{RepoBase{Pool: pool}}
}

func (r *ItineraryRepo) Itinerary(ctx context.Context) ([]models.ItineraryDay, error) {
	// Add query timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// list days
	rows, err := r.Pool.Query(ctx, `
		SELECT id, event_id, to_char(date,'YYYY-MM-DD') FROM days ORDER BY date ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var days []models.Day
	var dayIDs []string
	for rows.Next() {
		var d models.Day
		if err := rows.Scan(&d.ID, &d.EventID, &d.Date); err != nil {
			return nil, err
		}
		days = append(days, d)
		dayIDs = append(dayIDs, d.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	if len(dayIDs) == 0 {
		return []models.ItineraryDay{}, nil
	}
	
	// Batch fetch blocks and movements
	blocksRepo := NewBlocksRepo(r.Pool)
	movementsRepo := NewMovementsRepo(r.Pool)
	
	allBlocks, err := blocksRepo.ListByDays(ctx, dayIDs)
	if err != nil {
		return nil, err
	}
	
	allMovements, err := movementsRepo.ListByDays(ctx, dayIDs)
	if err != nil {
		return nil, err
	}
	
	// Group by day_id
	blocksByDay := make(map[string][]models.Block)
	for _, block := range allBlocks {
		blocksByDay[block.DayID] = append(blocksByDay[block.DayID], block)
	}
	
	movementsByDay := make(map[string][]models.Movement)
	for _, movement := range allMovements {
		movementsByDay[movement.DayID] = append(movementsByDay[movement.DayID], movement)
	}
	
	// Build output
	var out []models.ItineraryDay
	for _, d := range days {
		blocks := blocksByDay[d.ID]
		if blocks == nil {
			blocks = []models.Block{}
		}
		movements := movementsByDay[d.ID]
		if movements == nil {
			movements = []models.Movement{}
		}
		out = append(out, models.ItineraryDay{
			Day:       d,
			Blocks:    blocks,
			Movements: movements,
		})
	}
	return out, nil
}

func (r *ItineraryRepo) Agenda(ctx context.Context, participantID string) ([]models.AgendaItem, error) {
	// Add query timeout
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	rows, err := r.Pool.Query(ctx, `
		SELECT d.id, to_char(d.date,'YYYY-MM-DD'),
		       b.id, b.day_id, b.type, b.title, COALESCE(b.description,''), 
		       to_char(b.start_time,'HH24:MI'), COALESCE(to_char(b.end_time,'HH24:MI'),''), b.end_time_fixed,
		       b.location_id::text, COALESCE(b.notes,'')
		FROM blocks b
		JOIN days d ON d.id = b.day_id
		JOIN block_participants bp ON bp.block_id = b.id AND bp.participant_id = $1
		ORDER BY d.date ASC, b.start_time ASC
	`, participantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []models.AgendaItem
	for rows.Next() {
		var di models.AgendaItem
		var blk models.Block
		var locationID *string
		var endTimeFixed bool
		if err := rows.Scan(&di.DayID, &di.Date, &blk.ID, &blk.DayID, &blk.Type, &blk.Title, &blk.Description, &blk.StartTime, &blk.EndTime, &endTimeFixed, &locationID, &blk.Notes); err != nil {
			return nil, err
		}
		blk.EndTimeFixed = &endTimeFixed
		blk.LocationID = locationID
		blk.Attachments = []string{} // ensure it's initialized
		di.Block = blk
		items = append(items, di)
	}
	return items, rows.Err()
}


