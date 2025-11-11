# --- Build stage ---
    FROM golang:1.22-alpine AS builder

    # Habilitar módulos y CGO off para binario estático
    ENV CGO_ENABLED=0 \
        GOOS=linux \
        GOARCH=amd64
    
    WORKDIR /app
    
    # Copiar mod + sum
    COPY go.mod go.sum ./
    RUN go mod download
    
    # Copiar el resto del proyecto
    COPY . .
    
    # Compilar binario optimizado
    RUN go build -o server -ldflags="-s -w" ./...
    
    # --- Final stage (imagen mínima) ---
    FROM alpine:3.20
    
    WORKDIR /app
    
    # Copiamos el binario únicamente
    COPY --from=builder /app/server .
    
    # No copiamos .env — lo monta docker-compose en runtime
    EXPOSE 8080
    
    CMD ["./server"]
    