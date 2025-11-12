package auth

import (
	"context"
	"net/http"

	"planning-system/backend/internal/models"
)

type contextKey string

const UserContextKey contextKey = "user"

// GetUserFromContext extracts the user from the request context
func GetUserFromContext(r *http.Request) (models.User, bool) {
	user, ok := r.Context().Value(UserContextKey).(models.User)
	return user, ok
}

// SetUserInContext sets the user in the request context
func SetUserInContext(ctx context.Context, user models.User) context.Context {
	return context.WithValue(ctx, UserContextKey, user)
}

