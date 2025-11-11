package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListLocations(w http.ResponseWriter, r *http.Request) {
	items, err := h.sv.Locations.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list locations")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetLocation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.sv.Locations.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "location not found")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) CreateLocation(w http.ResponseWriter, r *http.Request) {
	var in models.Location
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Name == "" {
		respond.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	item, err := h.sv.Locations.Create(r.Context(), in)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create")
		return
	}
	respond.Single(w, http.StatusCreated, item)
}

func (h *Handlers) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in models.Location
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Name == "" {
		respond.Error(w, http.StatusBadRequest, "name is required")
		return
	}
	item, err := h.sv.Locations.Update(r.Context(), id, in)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "location not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) DeleteLocation(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.sv.Locations.Delete(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


