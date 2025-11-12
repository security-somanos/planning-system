package services

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"planning-system/backend/internal/repos"
)

type Services struct {
	Locations    *repos.LocationsRepo
	Vehicles     *repos.VehiclesRepo
	Participants *repos.ParticipantsRepo
	Days         *repos.DaysRepo
	Blocks       *repos.BlocksRepo
	Movements    *repos.MovementsRepo
	Itinerary    *repos.ItineraryRepo
	Users        *repos.UsersRepo
	Involvement  *repos.InvolvementRepo
}

func New(pool *pgxpool.Pool) *Services {
	return &Services{
		Locations:    repos.NewLocationsRepo(pool),
		Vehicles:     repos.NewVehiclesRepo(pool),
		Participants: repos.NewParticipantsRepo(pool),
		Days:         repos.NewDaysRepo(pool),
		Blocks:       repos.NewBlocksRepo(pool),
		Movements:    repos.NewMovementsRepo(pool),
		Itinerary:    repos.NewItineraryRepo(pool),
		Users:        repos.NewUsersRepo(pool),
		Involvement:  repos.NewInvolvementRepo(pool),
	}
}


