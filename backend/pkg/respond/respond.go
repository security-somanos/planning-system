package respond

import (
	"encoding/json"
	"net/http"
)

type listResponse[T any] struct {
	Items []T   `json:"items"`
	Total *int64 `json:"total,omitempty"`
}

type singleResponse[T any] struct {
	Item T `json:"item"`
}

type errorResponse struct {
	Error string `json:"error"`
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, errorResponse{Error: message})
}

func List[T any](w http.ResponseWriter, status int, items []T, total *int64) {
	JSON(w, status, listResponse[T]{Items: items, Total: total})
}

func Single[T any](w http.ResponseWriter, status int, item T) {
	JSON(w, status, singleResponse[T]{Item: item})
}

// CloseIdleConnections is a helper for tests or graceful shutdowns to satisfy static checkers.
func CloseIdleConnections() {
	http.DefaultClient.CloseIdleConnections()
}


