package http

import (
	"net/http"
	"time"

	"planning-system/backend/internal/config"
	"planning-system/backend/internal/handlers"
	"planning-system/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"
)

func NewRouter(cfg config.Config, logger zerolog.Logger, pool *pgxpool.Pool) http.Handler {
	r := chi.NewRouter()

	// CORS enabled - allow all origins
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false, // Must be false when using wildcard origin
		MaxAge:           300,
	}))
	r.Use(RequestLogger(logger))
	r.Use(Recoverer(logger))
	r.Use(Timeout(60 * time.Second))

	// Services and handlers
	svcs := services.New(pool)
	h := handlers.New(logger, svcs)

	// Health
	r.Get("/health", h.Health)

	// Locations
	r.Route("/locations", func(r chi.Router) {
		r.Get("/", h.ListLocations)
		r.Post("/", h.CreateLocation)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.GetLocation)
			r.Put("/", h.UpdateLocation)
			r.Delete("/", h.DeleteLocation)
		})
	})

	// Vehicles
	r.Route("/vehicles", func(r chi.Router) {
		r.Get("/", h.ListVehicles)
		r.Post("/", h.CreateVehicle)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.GetVehicle)
			r.Put("/", h.UpdateVehicle)
			r.Delete("/", h.DeleteVehicle)
		})
	})

	// Participants
	r.Route("/participants", func(r chi.Router) {
		r.Get("/", h.ListParticipants)
		r.Post("/", h.CreateParticipant)
		r.Route("/{id}", func(r chi.Router) {
			r.Get("/", h.GetParticipant)
			r.Put("/", h.UpdateParticipant)
			r.Delete("/", h.DeleteParticipant)
		})
	})

	// Days
	r.Route("/days", func(r chi.Router) {
		r.Get("/", h.ListDays)
		r.Post("/", h.CreateDays) // supports single or range
		r.Route("/{dayId}", func(r chi.Router) {
			r.Get("/", h.GetDay)
			r.Delete("/", h.DeleteDay)
			// Blocks
			r.Route("/blocks", func(r chi.Router) {
				r.Get("/", h.ListBlocks)
				r.Post("/", h.CreateBlock)
				r.Route("/{blockId}", func(r chi.Router) {
					r.Get("/", h.GetBlock)
					r.Put("/", h.UpdateBlock)
					r.Delete("/", h.DeleteBlock)
				})
			})
			// Movements
			r.Route("/movements", func(r chi.Router) {
				r.Get("/", h.ListMovements)
				r.Post("/", h.CreateMovement)
				r.Route("/{movementId}", func(r chi.Router) {
					r.Get("/", h.GetMovement)
					r.Put("/", h.UpdateMovement)
					r.Delete("/", h.DeleteMovement)
				})
			})
		})
	})

	// Itinerary and Agenda
	r.Get("/itinerary", h.Itinerary)
	r.Get("/agenda/{participantId}", h.Agenda)

	// PDF export
	r.Get("/export/pdf", h.ExportPDF)

	return r
}
