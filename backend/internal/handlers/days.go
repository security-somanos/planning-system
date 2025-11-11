package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/models"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListDays(w http.ResponseWriter, r *http.Request) {
	items, err := h.sv.Days.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list days")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetDay(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "dayId")
	item, err := h.sv.Days.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "day not found")
		return
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


