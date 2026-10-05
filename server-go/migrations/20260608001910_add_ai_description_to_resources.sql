-- +goose Up
ALTER TABLE resources ADD COLUMN IF NOT EXISTS ai_description TEXT;
