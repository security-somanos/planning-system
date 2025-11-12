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

func (h *Handlers) ListLocations(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	items, err := h.sv.Locations.List(r.Context())
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list locations")
		return
	}

	// Filter by involvement if not admin
	if user.Role != "admin" {
		locationIDs, err := h.sv.Involvement.GetLocationsForUser(r.Context(), user.ID)
		if err != nil {
			h.log.Error().Err(err).Msg("failed to get locations for user")
			respond.Error(w, http.StatusInternalServerError, "failed to filter locations")
			return
		}
		
		// Create a map for quick lookup
		locationIDMap := make(map[string]bool)
		for _, lid := range locationIDs {
			locationIDMap[lid] = true
		}
		
		// Filter locations
		filtered := make([]models.Location, 0)
		for _, location := range items {
			if locationIDMap[location.ID] {
				filtered = append(filtered, location)
			}
		}
		items = filtered
	}

	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetLocation(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.GetUserFromContext(r)
	if !ok {
		respond.Error(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id := chi.URLParam(r, "id")
	item, err := h.sv.Locations.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "location not found")
		return
	}

	// Check involvement if not admin
	if user.Role != "admin" {
		involved, err := h.sv.Involvement.IsUserInvolvedWithLocation(r.Context(), user.ID, id)
		if err != nil {
			respond.Error(w, http.StatusInternalServerError, "failed to check involvement")
			return
		}
		if !involved {
			respond.Error(w, http.StatusForbidden, "access denied")
			return
		}
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


