package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/auth"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListMovements(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	dayID := chi.URLParam(r, "dayId")
	
	// Check involvement if not admin
	if user.Role != "admin" {
		involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, dayID)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to check involvement")
			return
		}
		if !involved {
			respond.Error(w, http.StatusForbidden, "access denied")
			return
		}
	}

	items, err := h.sv.Movements.ListByDay(r.Context(), dayID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list movements")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetMovement(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	dayID := chi.URLParam(r, "dayId")
	id := chi.URLParam(r, "movementId")
	
	// Check involvement if not admin
	if user.Role != "admin" {
		involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, dayID)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to check involvement")
			return
		}
		if !involved {
			respond.Error(w, http.StatusForbidden, "access denied")
			return
		}
	}

	item, err := h.sv.Movements.Get(r.Context(), dayID, id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "movement not found")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) CreateMovement(w http.ResponseWriter, r *http.Request) {
	dayID := chi.URLParam(r, "dayId")
	var in models.Movement
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.DayID = dayID
	if in.Title == "" || in.FromTime == "" || (in.ToTimeType != "fixed" && in.ToTimeType != "driving") {
		respond.Error(w, http.StatusBadRequest, "invalid movement payload")
		return
	}
	// optional capacity check for assignments-passengers omitted here
	item, err := h.sv.Movements.Create(r.Context(), in)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "failed to create movement")
		return
	}
	respond.Single(w, http.StatusCreated, item)
}

func (h *Handlers) UpdateMovement(w http.ResponseWriter, r *http.Request) {
	_ = chi.URLParam(r, "dayId")
	id := chi.URLParam(r, "movementId")
	var in models.Movement
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Title == "" || in.FromTime == "" || (in.ToTimeType != "fixed" && in.ToTimeType != "driving") {
		respond.Error(w, http.StatusBadRequest, "invalid movement payload")
		return
	}
	item, err := h.sv.Movements.Update(r.Context(), id, in)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "movement not found")
			return
		}
		respond.Error(w, http.StatusBadRequest, "failed to update movement")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) DeleteMovement(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "movementId")
	if err := h.sv.Movements.Delete(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete movement")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


