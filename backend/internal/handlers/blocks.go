package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) ListBlocks(w http.ResponseWriter, r *http.Request) {
	dayID := chi.URLParam(r, "dayId")
	items, err := h.sv.Blocks.ListByDay(r.Context(), dayID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list blocks")
		return
	}
	respond.List(w, http.StatusOK, items, nil)
}

func (h *Handlers) GetBlock(w http.ResponseWriter, r *http.Request) {
	dayID := chi.URLParam(r, "dayId")
	id := chi.URLParam(r, "blockId")
	item, err := h.sv.Blocks.Get(r.Context(), dayID, id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "block not found")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) CreateBlock(w http.ResponseWriter, r *http.Request) {
	dayID := chi.URLParam(r, "dayId")
	var in models.Block
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	in.DayID = dayID
	if in.Title == "" || in.StartTime == "" || (in.Type != "activity" && in.Type != "break") {
		respond.Error(w, http.StatusBadRequest, "invalid block payload")
		return
	}
	item, err := h.sv.Blocks.Create(r.Context(), in)
	if err != nil {
		respond.Error(w, http.StatusBadRequest, "failed to create block")
		return
	}
	respond.Single(w, http.StatusCreated, item)
}

func (h *Handlers) UpdateBlock(w http.ResponseWriter, r *http.Request) {
	_ = chi.URLParam(r, "dayId") // dayId not needed; block id is global
	id := chi.URLParam(r, "blockId")
	var in models.Block
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if in.Title == "" || in.StartTime == "" || (in.Type != "activity" && in.Type != "break") {
		respond.Error(w, http.StatusBadRequest, "invalid block payload")
		return
	}
	item, err := h.sv.Blocks.Update(r.Context(), id, in)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "block not found")
			return
		}
		respond.Error(w, http.StatusBadRequest, "failed to update block")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) DeleteBlock(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "blockId")
	if err := h.sv.Blocks.Delete(r.Context(), id); err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to delete block")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}


