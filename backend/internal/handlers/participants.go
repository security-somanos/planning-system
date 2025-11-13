package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"
	"golang.org/x/crypto/bcrypt"
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
	var req models.CreateParticipantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}
	if req.Name == "" {
		respond.Error(w, http.StatusBadRequest, "name is required")
		return
	}

	// Create participant
	participant := models.Participant{
		Name:      req.Name,
		Roles:     req.Roles,
		Email:     req.Email,
		Phone:     req.Phone,
		Languages: req.Languages,
	}

	// If password is provided, create a user account
	if req.Password != "" {
		if req.Email == "" {
			respond.Error(w, http.StatusBadRequest, "email is required when creating a user account")
			return
		}

		// Hash password
		passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			h.log.Error().Err(err).Msg("failed to hash password")
			respond.Error(w, http.StatusInternalServerError, "failed to create user")
			return
		}

		// Determine if user is enabled (default to false if not specified)
		isUserEnabled := false
		if req.IsUserEnabled != nil {
			isUserEnabled = *req.IsUserEnabled
		}

		// Create user
		user, err := h.sv.Users.Create(r.Context(), req.Email, string(passwordHash), "user", isUserEnabled)
		if err != nil {
			// Check for unique constraint violation
			if err.Error() == "duplicate key value violates unique constraint \"users_email_key\"" {
				respond.Error(w, http.StatusConflict, "email already exists")
				return
			}
			h.log.Error().Err(err).Msg("failed to create user")
			respond.Error(w, http.StatusInternalServerError, "failed to create user")
			return
		}

		participant.UserID = &user.ID
	}

	item, err := h.sv.Participants.Create(r.Context(), participant)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to create participant")
		return
	}

	// Fetch the created participant with user info
	item, err = h.sv.Participants.Get(r.Context(), item.ID)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch created participant")
		return
	}

	respond.Single(w, http.StatusCreated, item)
}

func (h *Handlers) UpdateParticipant(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.UpdateParticipantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}

	// Get existing participant
	existing, err := h.sv.Participants.Get(r.Context(), id)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "participant not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to get participant")
		return
	}

	// Update participant fields
	participant := existing
	if req.Name != "" {
		participant.Name = req.Name
	}
	if req.Roles != nil {
		participant.Roles = req.Roles
	}
	if req.Email != "" {
		participant.Email = req.Email
	}
	if req.Phone != "" {
		participant.Phone = req.Phone
	}
	if req.Languages != nil {
		participant.Languages = req.Languages
	}

	// Handle user account updates
	if req.Password != "" || req.IsUserEnabled != nil {
		if existing.UserID == nil {
			// Create user account if it doesn't exist
			if req.Email == "" {
				respond.Error(w, http.StatusBadRequest, "email is required when creating a user account")
				return
			}

			passwordHash := ""
			if req.Password != "" {
				hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
				if err != nil {
					h.log.Error().Err(err).Msg("failed to hash password")
					respond.Error(w, http.StatusInternalServerError, "failed to create user")
					return
				}
				passwordHash = string(hash)
			} else {
				// If no password provided but enabling user, we need a password
				respond.Error(w, http.StatusBadRequest, "password is required when creating a user account")
				return
			}

			isUserEnabled := false
			if req.IsUserEnabled != nil {
				isUserEnabled = *req.IsUserEnabled
			}

			user, err := h.sv.Users.Create(r.Context(), req.Email, passwordHash, "user", isUserEnabled)
			if err != nil {
				if err.Error() == "duplicate key value violates unique constraint \"users_email_key\"" {
					respond.Error(w, http.StatusConflict, "email already exists")
					return
				}
				h.log.Error().Err(err).Msg("failed to create user")
				respond.Error(w, http.StatusInternalServerError, "failed to create user")
				return
			}
			participant.UserID = &user.ID
		} else {
			// Update existing user
			if req.Password != "" {
				passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
				if err != nil {
					h.log.Error().Err(err).Msg("failed to hash password")
					respond.Error(w, http.StatusInternalServerError, "failed to update password")
					return
				}
				if err := h.sv.Users.UpdatePassword(r.Context(), *existing.UserID, string(passwordHash)); err != nil {
					h.log.Error().Err(err).Msg("failed to update password")
					respond.Error(w, http.StatusInternalServerError, "failed to update password")
					return
				}
			}

			if req.IsUserEnabled != nil {
				_, err := h.sv.Users.Update(r.Context(), *existing.UserID, nil, nil, req.IsUserEnabled)
				if err != nil {
					h.log.Error().Err(err).Msg("failed to update user enabled status")
					respond.Error(w, http.StatusInternalServerError, "failed to update user enabled status")
					return
				}
			}
		}
	}

	item, err := h.sv.Participants.Update(r.Context(), id, participant)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "participant not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}

	// Fetch updated participant with user info
	item, err = h.sv.Participants.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to fetch updated participant")
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


