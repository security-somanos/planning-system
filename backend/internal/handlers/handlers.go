package handlers

import (
	"net/http"

	"github.com/rs/zerolog"
	"planning-system/backend/internal/services"
	"planning-system/backend/pkg/respond"
)

type Handlers struct {
	log zerolog.Logger
	sv  *services.Services
}

func New(log zerolog.Logger, sv *services.Services) *Handlers {
	return &Handlers{log: log, sv: sv}
}

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	respond.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}


