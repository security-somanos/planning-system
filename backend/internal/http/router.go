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

	// Health (public)
	r.Get("/health", h.Health)

	// Setup route (public) - creates test user only if no users exist
	r.Post("/setup/test-user", h.CreateTestUser)

	// Auth routes (public)
	r.Post("/auth/login", h.Login)

	// Protected routes - require authentication
	r.Group(func(r chi.Router) {
		r.Use(AuthMiddleware(cfg, logger))

		// Admin routes - require admin role
		r.Group(func(r chi.Router) {
			r.Use(RequireAdmin)
			// Users management (admin only)
			r.Route("/admin/users", func(r chi.Router) {
				r.Get("/", h.ListUsers)
				r.Post("/", h.CreateUser)
				r.Route("/{id}", func(r chi.Router) {
					r.Get("/", h.GetUser)
					r.Put("/", h.UpdateUser)
					r.Delete("/", h.DeleteUser)
				})
			})
		})

		// Regular authenticated routes
		// Locations - users can read locations they're involved in, admin can do everything
		r.Route("/locations", func(r chi.Router) {
			r.Get("/", h.ListLocations)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.GetLocation)
				r.Group(func(r chi.Router) {
					r.Use(RequireAdmin)
					r.Put("/", h.UpdateLocation)
					r.Delete("/", h.DeleteLocation)
				})
			})
			r.Group(func(r chi.Router) {
				r.Use(RequireAdmin)
				r.Post("/", h.CreateLocation)
			})
		})

		// Vehicles - users can read vehicles they're involved in, admin can do everything
		r.Route("/vehicles", func(r chi.Router) {
			r.Get("/", h.ListVehicles)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.GetVehicle)
				r.Group(func(r chi.Router) {
					r.Use(RequireAdmin)
					r.Put("/", h.UpdateVehicle)
					r.Delete("/", h.DeleteVehicle)
				})
			})
			r.Group(func(r chi.Router) {
				r.Use(RequireAdmin)
				r.Post("/", h.CreateVehicle)
			})
		})

		// Participants (admin only for now, can be extended)
		r.Route("/participants", func(r chi.Router) {
			r.Use(RequireAdmin)
			r.Get("/", h.ListParticipants)
			r.Post("/", h.CreateParticipant)
			r.Route("/{id}", func(r chi.Router) {
				r.Get("/", h.GetParticipant)
				r.Put("/", h.UpdateParticipant)
				r.Delete("/", h.DeleteParticipant)
			})
		})

		// Days - users can only access days they're involved in
		r.Route("/days", func(r chi.Router) {
			r.Get("/", h.ListDays)
			r.Group(func(r chi.Router) {
				r.Use(RequireAdmin)
				r.Post("/", h.CreateDays)
			})
			r.Route("/{dayId}", func(r chi.Router) {
				r.Get("/", h.GetDay)
				r.Group(func(r chi.Router) {
					r.Use(RequireAdmin)
					r.Delete("/", h.DeleteDay)
				})
				// Blocks
				r.Route("/blocks", func(r chi.Router) {
					r.Get("/", h.ListBlocks)
					r.Group(func(r chi.Router) {
						r.Use(RequireAdmin)
						r.Post("/", h.CreateBlock)
					})
					r.Route("/{blockId}", func(r chi.Router) {
						r.Get("/", h.GetBlock)
						r.Group(func(r chi.Router) {
							r.Use(RequireAdmin)
							r.Put("/", h.UpdateBlock)
							r.Delete("/", h.DeleteBlock)
						})
					})
				})
				// Movements
				r.Route("/movements", func(r chi.Router) {
					r.Get("/", h.ListMovements)
					r.Group(func(r chi.Router) {
						r.Use(RequireAdmin)
						r.Post("/", h.CreateMovement)
					})
					r.Route("/{movementId}", func(r chi.Router) {
						r.Get("/", h.GetMovement)
						r.Group(func(r chi.Router) {
							r.Use(RequireAdmin)
							r.Put("/", h.UpdateMovement)
							r.Delete("/", h.DeleteMovement)
						})
					})
				})
			})
		})

		// Itinerary and Agenda - users can only access their own data
		r.Get("/itinerary", h.Itinerary)
		r.Get("/agenda/{participantId}", h.Agenda)

		// PDF export - users can only export data they're involved in
		r.Get("/export/pdf", h.ExportPDF)
		// User-specific PDF export with their name on cover
		r.Get("/export/pdf/my-itinerary", h.ExportMyItineraryPDF)
	})

	return r
}
