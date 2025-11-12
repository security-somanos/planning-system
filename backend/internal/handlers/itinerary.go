package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/auth"
	"planning-system/backend/internal/models"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) Itinerary(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	items, err := h.sv.Itinerary.Itinerary(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to build itinerary")
		return
	}

	// Filter by involvement if not admin
	if user.Role != "admin" {
		filtered := make([]models.ItineraryDay, 0)
		for _, item := range items {
			involved, err := h.sv.Involvement.IsUserInvolvedInDay(r.Context(), user.ID, item.Day.ID)
			if err != nil {
				h.log.Error().Err(err).Msg("failed to check involvement")
				continue
			}
			if involved {
				filtered = append(filtered, item)
			}
		}
		items = filtered
	}

	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) Agenda(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	participantID := chi.URLParam(r, "participantId")
	
	// Check if participant belongs to user if not admin
	if user.Role != "admin" {
		participant, err := h.sv.Participants.Get(r.Context(), participantID)
		if err != nil {
			respond.Error(w, http.StatusNotFound, "participant not found")
			return
		}
		if participant.UserID == nil || *participant.UserID != user.ID {
			respond.Error(w, http.StatusForbidden, "access denied")
			return
		}
	}

	items, err := h.sv.Itinerary.Agenda(r.Context(), participantID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to build agenda")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}


