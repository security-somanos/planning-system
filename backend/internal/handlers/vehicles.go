package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListVehicles(w http.ResponseWriter, r *http.Request) {
	items, err := h.sv.Vehicles.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list vehicles")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetVehicle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.sv.Vehicles.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "vehicle not found")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) CreateVehicle(w http.ResponseWriter, r *http.Request) {
	var in models.Vehicle
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Label == "" {
		respond.Error(w, http.StatusBadRequest, "label required")
		return
	}
	if in.Capacity != nil && *in.Capacity < 0 {
		respond.Error(w, http.StatusBadRequest, "capacity must be non-negative")
		return
	}
	item, err := h.sv.Vehicles.Create(r.Context(), in)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create")
		return
	}
	respond.Single(w, http.StatusCreated, item)
}

func (h *Handlers) UpdateVehicle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var in models.Vehicle
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Label == "" {
		respond.Error(w, http.StatusBadRequest, "label required")
		return
	}
	if in.Capacity != nil && *in.Capacity < 0 {
		respond.Error(w, http.StatusBadRequest, "capacity must be non-negative")
		return
	}
	item, err := h.sv.Vehicles.Update(r.Context(), id, in)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "vehicle not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) DeleteVehicle(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.sv.Vehicles.Delete(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


