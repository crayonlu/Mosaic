package adapters

import (
	"context"

	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// GenerationSettings resolves the auto-tag and auto-summary toggles from the
// application settings, with the previous server's defaults.
type GenerationSettings struct {
	settings *service.AppSettingsService
}

func NewGenerationSettings(settings *service.AppSettingsService) *GenerationSettings {
	return &GenerationSettings{settings: settings}
}

func (g *GenerationSettings) AutoTagEnabled(ctx context.Context) bool {
	return g.settings.Bool(ctx, "auto_tag_enabled", true)
}

func (g *GenerationSettings) AutoSummaryEnabled(ctx context.Context) bool {
	return g.settings.Bool(ctx, "auto_summary_enabled", false)
}
