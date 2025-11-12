package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"planning-system/backend/internal/config"
	"planning-system/backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"planning-system/backend/pkg/respond"
)

func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respond.JSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request"})
		return
	}

	if req.Email == "" || req.Password == "" {
		respond.JSON(w, http.StatusBadRequest, map[string]string{"error": "email and password required"})
		return
	}

	user, err := h.sv.Users.GetByEmail(r.Context(), req.Email)
	if err != nil {
		h.log.Debug().Err(err).Str("email", req.Email).Msg("login failed: user not found")
		respond.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		h.log.Debug().Err(err).Str("email", req.Email).Msg("login failed: invalid password")
		respond.JSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
		return
	}

	// Generate JWT token
	cfg := config.Load()
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"role":    user.Role,
		"exp":     time.Now().Add(24 * time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		h.log.Error().Err(err).Msg("failed to generate token")
		respond.JSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to generate token"})
		return
	}

	// Don't send password hash
	user.PasswordHash = ""
	respond.JSON(w, http.StatusOK, models.LoginResponse{
		Token: tokenString,
		User:  user,
	})
}

