package seed

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

func Run(ctx context.Context, pool *pgxpool.Pool, logger zerolog.Logger) error {
	// Idempotent: check if at least one event exists
	var count int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM events`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		logger.Info().Msg("seed: data already exists, skipping")
		return nil
	}

	logger.Info().Msg("seed: inserting demo data")
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Event
	eventID := uuid.New()
	start := time.Now().UTC().Truncate(24 * time.Hour)
	end := start.AddDate(0, 0, 2)
	_, err = tx.Exec(ctx, `
		INSERT INTO events (id, name, description, start_date, end_date)
		VALUES ($1,$2,$3,$4,$5)
	`, eventID, "Default Event", "Demo seeded event", start, end)
	if err != nil {
		return err
	}

	// Locations
	var locUni = uuid.New()
	var locAirport = uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO locations (id, name, address, google_maps_link, type)
		VALUES
		($1,'İstanbul Üniversitesi','Karaağaç, İstanbul Üniversitesi Merkez Kampüsü, 34500 Beyazıt/Büyükçekmece/İstanbul, Turquía','https://maps.app.goo.gl/HrZ5GAfDcykZDQU19','campus'),
		($2,'Aeropuerto de Estambul','Tayakadın, Terminal Caddesi No:1, 34283 Arnavutköy/İstanbul, Turquía','https://maps.app.goo.gl/Fpeygpd1w1uusbXp6','airport')
	`, locUni, locAirport)
	if err != nil {
		return err
	}

	// Participants
	alice := uuid.New()
	bob := uuid.New()
	carol := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO participants (id, name, roles, email, phone, languages)
		VALUES
		($1,'Alice Johnson', ARRAY['VIP'], 'alice@example.com', '+1 555-0100', ARRAY['English','French']),
		($2,'Bob Lee', ARRAY['press'], 'bob@example.com', '+1 555-0101', ARRAY['English','Spanish','Chinese (Mandarin)']),
		($3,'Carol Smith', ARRAY['staff'], 'carol@example.com', '+90 555-0102', ARRAY['English','Turkish'])
	`, alice, bob, carol)
	if err != nil {
		return err
	}

	// Vehicles
	van := uuid.New()
	sedan := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO vehicles (id, label, make, model, license_plate, capacity, notes)
		VALUES
		($1,'Shuttle Van','Mercedes','Vito','34 ABC 123', 8, 'Spacious van'),
		($2,'VIP Sedan','BMW','5 Series','34 VIP 001', 3, 'Comfort for VIP')
	`, van, sedan)
	if err != nil {
		return err
	}

	// Days (2 days)
	day1 := uuid.New()
	day2 := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO days (id, event_id, date) VALUES
		($1,$3,$4),
		($2,$3,$5)
	`, day1, day2, eventID, start, start.AddDate(0, 0, 1))
	if err != nil {
		return err
	}

	// Blocks (with relations and schedule items)
	block1 := uuid.New()
	block2 := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO blocks (id, day_id, type, title, description, start_time, end_time, end_time_fixed, location_id, notes)
		VALUES
		($1,$3,'activity','Campus Tour','Guided tour', '09:00','10:30', TRUE, $5, 'Bring ID'),
		($2,$4,'break','Coffee Break','Snacks and coffee', '10:30','11:00', TRUE, $5, 'Lounge area')
	`, block1, block2, day1, day1, locUni)
	if err != nil {
		return err
	}
	// Block participants
	_, err = tx.Exec(ctx, `
		INSERT INTO block_participants (block_id, participant_id) VALUES
		($1,$2),($1,$3),($2,$4)
	`, block1, alice, bob, carol)
	if err != nil {
		return err
	}
	// Advance and Met-by
	_, err = tx.Exec(ctx, `
		INSERT INTO block_advance_participants (block_id, participant_id) VALUES
		($1,$2)
	`, block1, carol)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO block_met_by_participants (block_id, participant_id) VALUES
		($1,$2)
	`, block1, carol)
	if err != nil {
		return err
	}
	// Schedule items
	_, err = tx.Exec(ctx, `
		INSERT INTO schedule_items (id, block_id, time, description, staff_instructions, guest_instructions, notes)
		VALUES
		(gen_random_uuid(), $1, '09:00', 'Assemble at main gate', 'Check badges', 'Welcome!', 'Be on time'),
		(gen_random_uuid(), $1, '09:30', 'Visit library', 'Coordinate access', 'Enjoy the tour', NULL),
		(gen_random_uuid(), $2, '10:30', 'Coffee served', NULL, NULL, 'Allergy notice: nuts')
	`, block1, block2)
	if err != nil {
		return err
	}

	// Movements: one fixed, one driving
	move1 := uuid.New()
	move2 := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO movements (id, day_id, title, description, from_location_id, to_location_id, from_time, to_time_type, to_time, driving_minutes)
		VALUES
		($1,$3,'Airport Pickup','Pickup VIP from airport',$5,$6,'08:00','fixed','09:00',NULL),
		($2,$4,'Transfer to Campus','Drive from airport to campus',$6,$5,'11:00','driving',NULL,60)
	`, move1, move2, day1, day2, locUni, locAirport)
	if err != nil {
		return err
	}
	// Vehicle assignments and passengers
	assign1 := uuid.New()
	assign2 := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO vehicle_assignments (id, movement_id, vehicle_id, driver_id) VALUES
		($1,$3,$5,$6),
		($2,$4,$7,$6)
	`, assign1, assign2, move1, move2, sedan, carol, van)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO vehicle_assignment_passengers (assignment_id, participant_id) VALUES
		($1,$2),
		($1,$3),
		($4,$2)
	`, assign1, alice, bob, assign2)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}
	logger.Info().Msg("seed: demo data inserted")
	return nil
}


