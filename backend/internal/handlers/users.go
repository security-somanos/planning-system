package handlers

import (
	"encoding/json"
	"net/http"

	"planning-system/backend/internal/models"
	"planning-system/backend/internal/repos"
	"planning-system/backend/pkg/respond"

	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

func (h *Handlers) ListUsers(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page := repos.ParsePagination(q.Get("limit"), q.Get("offset"))
	items, total, err := h.sv.Users.List(r.Context(), page)
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "failed to list users")
		return
	}
	respond.List(w, http.StatusOK, items, &total)
}

func (h *Handlers) GetUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	item, err := h.sv.Users.Get(r.Context(), id)
	if err != nil {
		respond.Error(w, http.StatusNotFound, "user not found")
		return
	}
	respond.Single(w, http.StatusOK, item)
}

func (h *Handlers) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}

	if req.Email == "" || req.Password == "" {
		respond.Error(w, http.StatusBadRequest, "email and password are required")
		return
	}

	if req.Role != "admin" && req.Role != "user" {
		respond.Error(w, http.StatusBadRequest, "role must be 'admin' or 'user'")
		return
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to hash password")
		respond.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	user, err := h.sv.Users.Create(r.Context(), req.Email, string(passwordHash), req.Role)
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

	respond.Single(w, http.StatusCreated, user)
}

func (h *Handlers) UpdateUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req models.UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.Error(w, http.StatusBadRequest, "invalid json")
		return
	}

	var email *string
	var role *string

	if req.Email != "" {
		email = &req.Email
	}
	if req.Role != "" {
		if req.Role != "admin" && req.Role != "user" {
			respond.Error(w, http.StatusBadRequest, "role must be 'admin' or 'user'")
			return
		}
		role = &req.Role
	}

	user, err := h.sv.Users.Update(r.Context(), id, email, role)
	if err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "user not found")
			return
		}
		h.log.Error().Err(err).Msg("failed to update user")
		respond.Error(w, http.StatusInternalServerError, "failed to update user")
		return
	}

	respond.Single(w, http.StatusOK, user)
}

func (h *Handlers) DeleteUser(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := h.sv.Users.Delete(r.Context(), id); err != nil {
		if err == repos.ErrNotFound {
			respond.Error(w, http.StatusNotFound, "user not found")
			return
		}
		respond.Error(w, http.StatusInternalServerError, "failed to delete")
		return
	}
	respond.JSON(w, http.StatusNoContent, nil)
}

// CreateTestUser creates a test admin user only if no users exist in the database
// This is a public endpoint for initial setup
func (h *Handlers) CreateTestUser(w http.ResponseWriter, r *http.Request) {
	// Check if any users exist
	count, err := h.sv.Users.Count(r.Context())
	if err != nil {
		h.log.Error().Err(err).Msg("failed to check user count")
		respond.Error(w, http.StatusInternalServerError, "failed to check users")
		return
	}

	if count > 0 {
		respond.Error(w, http.StatusForbidden, "users already exist")
		return
	}

	// Create test admin user
	testEmail := "admin@test.com"
	testPassword := "admin123"
	testRole := "admin"

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.DefaultCost)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to hash password")
		respond.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	user, err := h.sv.Users.Create(r.Context(), testEmail, string(passwordHash), testRole)
	if err != nil {
		h.log.Error().Err(err).Msg("failed to create test user")
		respond.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	respond.JSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Test user created successfully",
		"user": map[string]interface{}{
			"id":    user.ID,
			"email": user.Email,
			"role":  user.Role,
		},
		"credentials": map[string]string{
			"email":    testEmail,
			"password": testPassword,
		},
	})
}
