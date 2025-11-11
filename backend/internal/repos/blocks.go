package repos

import (
	"context"

	"planning-system/backend/internal/models"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type BlocksRepo struct{ RepoBase }

func NewBlocksRepo(pool *pgxpool.Pool) *BlocksRepo {
	return &BlocksRepo{RepoBase{Pool: pool}}
}

func (r *BlocksRepo) ListByDay(ctx context.Context, dayID string) ([]models.Block, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT id, day_id, type, title, COALESCE(description,''), 
		       to_char(start_time,'HH24:MI'), COALESCE(to_char(end_time,'HH24:MI'),''), end_time_fixed,
		       location_id::text, COALESCE(notes,''),
		       COALESCE((SELECT array_agg(participant_id::text) FROM block_participants bp WHERE bp.block_id=b.id), '{}') AS p1,
		       COALESCE((SELECT array_agg(participant_id::text) FROM block_advance_participants bp WHERE bp.block_id=b.id), '{}') AS p2,
		       COALESCE((SELECT array_agg(participant_id::text) FROM block_met_by_participants bp WHERE bp.block_id=b.id), '{}') AS p3
		FROM blocks b
		WHERE day_id = $1
		ORDER BY start_time ASC
	`, dayID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var blocks []models.Block
	for rows.Next() {
		var blk models.Block
		var locationID *string
		var endTimeFixed bool
		if err := rows.Scan(&blk.ID, &blk.DayID, &blk.Type, &blk.Title, &blk.Description, &blk.StartTime, &blk.EndTime, &endTimeFixed, &locationID, &blk.Notes, &blk.ParticipantsIds, &blk.AdvanceParticipantIDs, &blk.MetByParticipantIDs); err != nil {
			return nil, err
		}
		blk.EndTimeFixed = &endTimeFixed
		blk.LocationID = locationID
		blk.Attachments = []string{} // TODO: implement attachments table
		blocks = append(blocks, blk)
	}
	// load schedule items
	itemRows, err := r.Pool.Query(ctx, `
		SELECT id, block_id, to_char(time,'HH24:MI'), description, COALESCE(staff_instructions,''), COALESCE(guest_instructions,''), notes
		FROM schedule_items
		WHERE block_id = ANY($1::uuid[])
		ORDER BY time ASC
	`, collectBlockIDs(blocks))
	if err != nil {
		return nil, err
	}
	defer itemRows.Close()
	itemsByBlock := map[string][]models.ScheduleItem{}
	for itemRows.Next() {
		var it models.ScheduleItem
		var notes *string
		if err := itemRows.Scan(&it.ID, &it.BlockID, &it.Time, &it.Description, &it.StaffInstructions, &it.GuestInstructions, &notes); err != nil {
			return nil, err
		}
		it.Notes = notes
		itemsByBlock[it.BlockID] = append(itemsByBlock[it.BlockID], it)
	}
	for i := range blocks {
		blocks[i].ScheduleItems = itemsByBlock[blocks[i].ID]
	}
	return blocks, rows.Err()
}

func collectBlockIDs(blks []models.Block) []string {
	ids := make([]string, 0, len(blks))
	for _, b := range blks {
		ids = append(ids, b.ID)
	}
	return ids
}

// ListByDays fetches all blocks for multiple days in a single query
func (r *BlocksRepo) ListByDays(ctx context.Context, dayIDs []string) ([]models.Block, error) {
	if len(dayIDs) == 0 {
		return []models.Block{}, nil
	}
	rows, err := r.Pool.Query(ctx, `
		SELECT id, day_id, type, title, COALESCE(description,''), 
		       to_char(start_time,'HH24:MI'), COALESCE(to_char(end_time,'HH24:MI'),''), end_time_fixed,
		       location_id::text, COALESCE(notes,''),
		       COALESCE((SELECT array_agg(participant_id::text) FROM block_participants bp WHERE bp.block_id=b.id), '{}') AS p1,
		       COALESCE((SELECT array_agg(participant_id::text) FROM block_advance_participants bp WHERE bp.block_id=b.id), '{}') AS p2,
		       COALESCE((SELECT array_agg(participant_id::text) FROM block_met_by_participants bp WHERE bp.block_id=b.id), '{}') AS p3
		FROM blocks b
		WHERE day_id = ANY($1::uuid[])
		ORDER BY day_id, start_time ASC
	`, dayIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var blocks []models.Block
	for rows.Next() {
		var blk models.Block
		var locationID *string
		var endTimeFixed bool
		if err := rows.Scan(&blk.ID, &blk.DayID, &blk.Type, &blk.Title, &blk.Description, &blk.StartTime, &blk.EndTime, &endTimeFixed, &locationID, &blk.Notes, &blk.ParticipantsIds, &blk.AdvanceParticipantIDs, &blk.MetByParticipantIDs); err != nil {
			return nil, err
		}
		blk.EndTimeFixed = &endTimeFixed
		blk.LocationID = locationID
		blk.Attachments = []string{}
		blocks = append(blocks, blk)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	
	// Load schedule items for all blocks
	if len(blocks) > 0 {
		itemRows, err := r.Pool.Query(ctx, `
			SELECT id, block_id, to_char(time,'HH24:MI'), description, COALESCE(staff_instructions,''), COALESCE(guest_instructions,''), notes
			FROM schedule_items
			WHERE block_id = ANY($1::uuid[])
			ORDER BY block_id, time ASC
		`, collectBlockIDs(blocks))
		if err != nil {
			return nil, err
		}
		defer itemRows.Close()
		itemsByBlock := map[string][]models.ScheduleItem{}
		for itemRows.Next() {
			var it models.ScheduleItem
			var notes *string
			if err := itemRows.Scan(&it.ID, &it.BlockID, &it.Time, &it.Description, &it.StaffInstructions, &it.GuestInstructions, &notes); err != nil {
				return nil, err
			}
			it.Notes = notes
			itemsByBlock[it.BlockID] = append(itemsByBlock[it.BlockID], it)
		}
		if err := itemRows.Err(); err != nil {
			return nil, err
		}
		for i := range blocks {
			blocks[i].ScheduleItems = itemsByBlock[blocks[i].ID]
			if blocks[i].ScheduleItems == nil {
				blocks[i].ScheduleItems = []models.ScheduleItem{}
			}
		}
	}
	
	return blocks, nil
}

func (r *BlocksRepo) Get(ctx context.Context, dayID, id string) (models.Block, error) {
	list, err := r.ListByDay(ctx, dayID)
	if err != nil {
		return models.Block{}, err
	}
	for _, b := range list {
		if b.ID == id {
			if b.Attachments == nil {
				b.Attachments = []string{} // ensure it's initialized
			}
			return b, nil
		}
	}
	return models.Block{}, ErrNotFound
}

func (r *BlocksRepo) Create(ctx context.Context, in models.Block) (models.Block, error) {
	if in.ID == "" {
		in.ID = uuid.NewString()
	}
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return models.Block{}, err
	}
	defer rollbackTx(tx)
	var endTimeFixed bool
	if in.EndTimeFixed != nil {
		endTimeFixed = *in.EndTimeFixed
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO blocks (id, day_id, type, title, description, start_time, end_time, end_time_fixed, location_id, notes)
		VALUES ($1,$2,$3,$4,$5,$6::time, NULLIF($7,'')::time, $8, NULLIF($9,'')::uuid, $10)
	`, in.ID, in.DayID, in.Type, in.Title, in.Description, in.StartTime, in.EndTime, endTimeFixed, nullableString(in.LocationID), in.Notes)
	if err != nil {
		return models.Block{}, err
	}
	if len(in.ParticipantsIds) > 0 {
		for _, pid := range in.ParticipantsIds {
			if _, err := tx.Exec(ctx, `INSERT INTO block_participants (block_id, participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, in.ID, pid); err != nil {
				return models.Block{}, err
			}
		}
	}
	if len(in.AdvanceParticipantIDs) > 0 {
		for _, pid := range in.AdvanceParticipantIDs {
			if _, err := tx.Exec(ctx, `INSERT INTO block_advance_participants (block_id, participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, in.ID, pid); err != nil {
				return models.Block{}, err
			}
		}
	}
	if len(in.MetByParticipantIDs) > 0 {
		for _, pid := range in.MetByParticipantIDs {
			if _, err := tx.Exec(ctx, `INSERT INTO block_met_by_participants (block_id, participant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, in.ID, pid); err != nil {
				return models.Block{}, err
			}
		}
	}
	// schedule items
	for _, si := range in.ScheduleItems {
		siID := si.ID
		if siID == "" {
			siID = uuid.NewString()
		}
		_, err := tx.Exec(ctx, `
			INSERT INTO schedule_items (id, block_id, time, description, staff_instructions, guest_instructions, notes)
			VALUES ($1,$2,$3::time,$4,$5,$6,$7)
		`, siID, in.ID, si.Time, si.Description, si.StaffInstructions, si.GuestInstructions, si.Notes)
		if err != nil {
			return models.Block{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Block{}, err
	}
	return in, nil
}

func (r *BlocksRepo) Update(ctx context.Context, id string, in models.Block) (models.Block, error) {
	tx, err := r.Pool.Begin(ctx)
	if err != nil {
		return models.Block{}, err
	}
	defer rollbackTx(tx)
	var endTimeFixed bool
	if in.EndTimeFixed != nil {
		endTimeFixed = *in.EndTimeFixed
	}
	tag, err := tx.Exec(ctx, `
		UPDATE blocks
		SET type=$2, title=$3, description=$4, start_time=$5::time, end_time=NULLIF($6,'')::time, end_time_fixed=$7, location_id=NULLIF($8,'')::uuid, notes=$9
		WHERE id=$1
	`, id, in.Type, in.Title, in.Description, in.StartTime, in.EndTime, endTimeFixed, nullableString(in.LocationID), in.Notes)
	if err != nil {
		return models.Block{}, err
	}
	if tag.RowsAffected() == 0 {
		return models.Block{}, ErrNotFound
	}
	// reset relations
	if _, err := tx.Exec(ctx, `DELETE FROM block_participants WHERE block_id=$1`, id); err != nil {
		return models.Block{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM block_advance_participants WHERE block_id=$1`, id); err != nil {
		return models.Block{}, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM block_met_by_participants WHERE block_id=$1`, id); err != nil {
		return models.Block{}, err
	}
	for _, pid := range in.ParticipantsIds {
		if _, err := tx.Exec(ctx, `INSERT INTO block_participants (block_id, participant_id) VALUES ($1,$2)`, id, pid); err != nil {
			return models.Block{}, err
		}
	}
	for _, pid := range in.AdvanceParticipantIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO block_advance_participants (block_id, participant_id) VALUES ($1,$2)`, id, pid); err != nil {
			return models.Block{}, err
		}
	}
	for _, pid := range in.MetByParticipantIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO block_met_by_participants (block_id, participant_id) VALUES ($1,$2)`, id, pid); err != nil {
			return models.Block{}, err
		}
	}
	// schedule items: replace
	if _, err := tx.Exec(ctx, `DELETE FROM schedule_items WHERE block_id=$1`, id); err != nil {
		return models.Block{}, err
	}
	for _, si := range in.ScheduleItems {
		siID := si.ID
		if siID == "" {
			siID = uuid.NewString()
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO schedule_items (id, block_id, time, description, staff_instructions, guest_instructions, notes)
			VALUES ($1,$2,$3::time,$4,$5,$6,$7)
		`, siID, id, si.Time, si.Description, si.StaffInstructions, si.GuestInstructions, si.Notes); err != nil {
			return models.Block{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return models.Block{}, err
	}
	in.ID = id
	return in, nil
}

func (r *BlocksRepo) Delete(ctx context.Context, id string) error {
	_, err := r.Pool.Exec(ctx, `DELETE FROM blocks WHERE id=$1`, id)
	return err
}

func nullableString(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}


