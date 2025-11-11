package config

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

type Config struct {
	Env         string
	Port        string
	DatabaseURL string
	LogLevel    string
	CORSOrigins []string
	AutoMigrate bool
	AutoSeed    bool
}

func Load() Config {
	// Read directly from environment variables
	// .env files are only for local development or docker-compose injection
	cfg := Config{
		Env:         getEnv("ENV", "dev"),
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", ""),
		LogLevel:    strings.ToLower(getEnv("LOG_LEVEL", "info")),
		AutoMigrate: getEnv("AUTO_MIGRATE", "true") == "true",
		AutoSeed:    getEnv("AUTO_SEED", "true") == "true",
	}
	cors := getEnv("CORS_ORIGINS", "")
	if cors == "" {
		// allow common local dev ports by default
		cfg.CORSOrigins = []string{
			"http://localhost:3000",
			"http://localhost:5173",
			"http://127.0.0.1:3000",
			"http://127.0.0.1:5173",
		}
	} else {
		parts := strings.Split(cors, ",")
		for i := range parts {
			parts[i] = strings.TrimSpace(parts[i])
		}
		cfg.CORSOrigins = parts
	}
	return cfg
}

func NewLogger(cfg Config) zerolog.Logger {
	level := zerolog.InfoLevel
	switch cfg.LogLevel {
	case "debug":
		level = zerolog.DebugLevel
	case "warn":
		level = zerolog.WarnLevel
	case "error":
		level = zerolog.ErrorLevel
	}
	output := zerolog.New(os.Stdout).With().Timestamp().Logger()
	zerolog.TimeFieldFormat = time.RFC3339
	return output.Level(level)
}

func getEnv(key, def string) string {
	val := os.Getenv(key)
	if val == "" {
		return def
	}
	return val
}
