package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) Itinerary(w http.ResponseWriter, r *http.Request) {
	items, err := h.sv.Itinerary.Itinerary(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to build itinerary")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) Agenda(w http.ResponseWriter, r *http.Request) {
	participantID := chi.URLParam(r, "participantId")
	items, err := h.sv.Itinerary.Agenda(r.Context(), participantID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to build agenda")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}


