SHELL := /bin/sh

.PHONY: dev build migrate-up migrate-down seed tidy

dev:
	go run ./cmd/api

build:
	go build -o bin/api ./cmd/api

migrate-up:
	go run ./cmd/migrate -dir=up

migrate-down:
	go run ./cmd/migrate -dir=down

seed:
	go run ./cmd/seed

tidy:
	go mod tidy


