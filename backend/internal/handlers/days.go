package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/auth"
	"planning-system/backend/internal/models"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListDays(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	items, err := h.sv.Days.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list days")
		return
	}

	// Filter by involvement if not admin
	if user.Role != "admin" {
		// Get user's participant ID once for filtering vehicle assignments
		participantID, err := h.sv.Involvement.GetParticipantIDByUserID(r.Context(), user.ID)
		if err != nil {
			participantID = "" // If no participant, they can't see vehicle assignments
		}

		filtered := make([]models.Day, 0)
		for _, day := range items {
			involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, day.ID)
			if err != nil {
				h.log.Error().Err(err).Msg("failed to check involvement")
				continue
			}
			if involved {
				// Filter vehicle assignments for each movement in this day
				for i := range day.Movements {
					filteredAssignments := make([]models.VehicleAssignment, 0)
					for _, assignment := range day.Movements[i].VehicleAssignments {
						// Include if user's participant is the driver
						if assignment.DriverID != nil && *assignment.DriverID == participantID {
							filteredAssignments = append(filteredAssignments, assignment)
							continue
						}
						// Include if user's participant is in the passenger list
						for _, pid := range assignment.ParticipantIDs {
							if pid == participantID {
								filteredAssignments = append(filteredAssignments, assignment)
								break
							}
						}
					}
					day.Movements[i].VehicleAssignments = filteredAssignments
				}
				filtered = append(filtered, day)
			}
		}
		items = filtered
	}

	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetDay(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "dayId")
	item, err := h.sv.Days.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "day not found")
		return
	}

	// Check involvement if not admin
	if user.Role != "admin" {
		involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, id)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to check involvement")
			return
		}
		if !involved {
			respond.Error(w, http.StatusForbidden, "access denied")
			return
		}

		// Filter vehicle assignments to only show vehicles where user's participant is involved
		participantID, err := h.sv.Involvement.GetParticipantIDByUserID(r.Context(), user.ID)
		if err != nil {
			// If user has no participant, they can't see any vehicle assignments
			participantID = ""
		}

		// Filter vehicle assignments for each movement
		for i := range item.Movements {
			filteredAssignments := make([]models.VehicleAssignment, 0)
			for _, assignment := range item.Movements[i].VehicleAssignments {
				// Include if user's participant is the driver
				if assignment.DriverID != nil && *assignment.DriverID == participantID {
					filteredAssignments = append(filteredAssignments, assignment)
					continue
				}
				// Include if user's participant is in the passenger list
				for _, pid := range assignment.ParticipantIDs {
					if pid == participantID {
						filteredAssignments = append(filteredAssignments, assignment)
						break
					}
				}
			}
			item.Movements[i].VehicleAssignments = filteredAssignments
		}
	}

	respond.Single(w, http.StatusOK, item)
}

// CreateDays accepts an array of dates to create.
// Body: { dates: ["YYYY-MM-DD", "YYYY-MM-DD", ...] }
func (h *Handlers) CreateDays(w http.ResponseWriter, r *http.Request) {
	var in models.CreateDaysRequest
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if len(in.Dates) == 0 {
		respond.Error(w, http.StatusBadRequest, "dates array cannot be empty")
		return
	}
	// Find event_id (single-event model): pick first event
	var eventID string
	if err := h.sv.Days.Pool.QueryRow(r.Context(), `SELECT id FROM events ORDER BY start_date ASC LIMIT 1`).Scan(&eventID); err != nil || eventID == "" {
		respond.Error(w, http.StatusBadRequest, "no event found to attach days")
		return
	}
	// Create days for each date in the array
	var allCreated []models.Day
	for _, dateStr := range in.Dates {
		items, err := h.sv.Days.CreateRange(r.Context(), eventID, dateStr, dateStr)
		if err != nil {
			respond.Error(w, http.StatusBadRequest, "failed to create days: invalid date format")
			return
		}
		allCreated = append(allCreated, items...)
	}
	respond.List(w, http.StatusCreated, allCreated, nil)
}

func (h *Handlers) DeleteDay(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "dayId")
	if err := h.sv.Days.Delete(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete day")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


