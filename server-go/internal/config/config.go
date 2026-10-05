// Package config loads runtime configuration from the environment.
package config

import (
	"fmt"
	"os"
	"strings"

	"github.com/caarlos0/env/v11"
	"github.com/joho/godotenv"
)

// StorageType selects the blob storage backend.
type StorageType string

const (
	StorageLocal StorageType = "local"
	StorageR2    StorageType = "r2"
)

// UnmarshalText normalises STORAGE_TYPE. Values other than "r2" select local
// storage, matching the previous server.
func (s *StorageType) UnmarshalText(text []byte) error {
	if strings.EqualFold(string(text), string(StorageR2)) {
		*s = StorageR2
		return nil
	}
	*s = StorageLocal
	return nil
}

// Config holds every value the server reads at startup.
type Config struct {
	DatabaseURL       string      `env:"DATABASE_URL,required"`
	JWTSecret         string      `env:"JWT_SECRET,required"`
	Port              uint16      `env:"PORT" envDefault:"8080"`
	StorageType       StorageType `env:"STORAGE_TYPE" envDefault:"local"`
	FFmpegBinary      string      `env:"FFMPEG_BINARY" envDefault:"ffmpeg"`
	LocalStoragePath  string      `env:"LOCAL_STORAGE_PATH" envDefault:"./storage"`
	R2Endpoint        string      `env:"R2_ENDPOINT"`
	R2Bucket          string      `env:"R2_BUCKET"`
	R2AccessKeyID     string      `env:"R2_ACCESS_KEY_ID"`
	R2SecretAccessKey string      `env:"R2_SECRET_ACCESS_KEY"`
	AdminUsername     string      `env:"ADMIN_USERNAME" envDefault:"admin"`
	AdminPassword     string      `env:"ADMIN_PASSWORD,required"`
	HTML2LLMURL       string      `env:"HTML2LLM_URL" envDefault:"https://html2llm.cyncyn.xyz"`
	MigrationsDir     string      `env:"MIGRATIONS_DIR" envDefault:"./migrations"`
	AllowedOrigins    []string    `env:"ALLOWED_ORIGINS" envSeparator:","`
}

// Load reads configuration from the environment, loading a .env file first when
// one is present.
func Load() (*Config, error) {
	if err := godotenv.Load(); err != nil && !os.IsNotExist(err) {
		return nil, fmt.Errorf("loading .env: %w", err)
	}

	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return nil, fmt.Errorf("loading configuration: %w", err)
	}
	return &cfg, nil
}
