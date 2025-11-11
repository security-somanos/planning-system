package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListParticipants(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := repos.ParsePagination(q.Get("limit"), q.Get("offset"))
	items, total, err := h.sv.Participants.List(r.Context(), page, q.Get("search"), q.Get("role"))
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list participants")
		return
	}
	respond.List(w, http.StatusOK, items, &total)
}

func (h *Handlers) GetParticipant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.sv.Participants.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "participant not found")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) CreateParticipant(w http.ResponseWriter, r *http.Request) {
	var in models.Participant
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Name == "" {
		respond.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	item, err := h.sv.Participants.Create(r.Context(), in)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create")
		return
	}
	respond.Single(w, http.StatusCreated, item)
}

func (h *Handlers) UpdateParticipant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in models.Participant
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Name == "" {
		respond.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	item, err := h.sv.Participants.Update(r.Context(), id, in)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "participant not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) DeleteParticipant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.sv.Participants.Delete(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


