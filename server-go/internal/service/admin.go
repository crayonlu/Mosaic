package service

import (
	"context"
	"fmt"
	"log/slog"
	"strconv"
	"time"

	"github.com/crayonlu/mosaic/server-go/internal/admin"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// AdminStatsStore supplies the runtime figures the dashboard reports. It is
// declared here so the admin service never imports another module's package.
type AdminStatsStore interface {
	StorageUsed(ctx context.Context) (int64, error)
	DatabaseSize(ctx context.Context) (int64, error)
	AdminCounts(ctx context.Context, monthStart, monthEnd int64, tz string) (admin.Counts, error)
}

// AdminSettingsStore reads and writes the app_settings key/value table.
type AdminSettingsStore interface {
	GetString(ctx context.Context, key, fallback string) (string, error)
	GetBool(ctx context.Context, key string, fallback bool) (bool, error)
	GetInt(ctx context.Context, key string, fallback int32) (int32, error)
	SetString(ctx context.Context, key, value string) error
}

// AdminBackfiller regenerates embeddings for memos that lack them.
type AdminBackfiller interface {
	BackfillMissing(ctx context.Context) (indexed, failed, users int64, err error)
}

// AdminDeps carries every collaborator the admin service needs. Each field is
// a required constructor argument.
type AdminDeps struct {
	Users      ManagedUserStore
	Stats      AdminStatsStore
	Settings   AdminSettingsStore
	AIConfig   AdminAIConfigStore
	Backfiller AdminBackfiller
	Activity   *admin.ActivityLog
	Config     AdminConfig
	StartedAt  time.Time
	Version    string
}

// AdminConfig is the safe subset of server configuration the dashboard shows.
type AdminConfig struct {
	Port        uint16
	StorageType string
}

// AdminService coordinates the administrative dashboard.
type AdminService struct {
	deps AdminDeps
	now  func() time.Time
}

func NewAdminService(deps AdminDeps) *AdminService {
	return &AdminService{deps: deps, now: time.Now}
}

// WithClock replaces the clock. Intended for tests that assert uptime.
func (s *AdminService) WithClock(now func() time.Time) *AdminService {
	s.now = now
	return s
}

// AdminHealth is the runtime figure set reported by the health endpoint.
type AdminHealth struct {
	Uptime               string
	StartedAt            int64
	Version              string
	StorageType          string
	StorageUsed          int64
	StorageUsedFormatted string
	DBSize               int64
	DBSizeFormatted      string
}

// Health reports storage use, database size, and process uptime.
func (s *AdminService) Health(ctx context.Context) AdminHealth {
	storageUsed, err := s.deps.Stats.StorageUsed(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "admin health: storage used", "err", err)
		storageUsed = 0
	}
	dbSize, err := s.deps.Stats.DatabaseSize(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "admin health: database size", "err", err)
		dbSize = 0
	}

	elapsed := s.now().Sub(s.deps.StartedAt).Milliseconds()
	days := elapsed / 86400000
	hours := (elapsed % 86400000) / 3600000

	return AdminHealth{
		Uptime:               fmt.Sprintf("%dd %dh", days, hours),
		StartedAt:            s.deps.StartedAt.UnixMilli(),
		Version:              s.deps.Version,
		StorageType:          s.deps.Config.StorageType,
		StorageUsed:          storageUsed,
		StorageUsedFormatted: formatSize(storageUsed),
		DBSize:               dbSize,
		DBSizeFormatted:      formatSize(dbSize),
	}
}

// AdminCountWithMonth is a total paired with the current month's share.
type AdminCountWithMonth struct {
	Total     int64
	ThisMonth int64
}

// AdminResourceStats is the resource total and its occupied bytes.
type AdminResourceStats struct {
	Total              int64
	TotalSize          int64
	TotalSizeFormatted string
}

// AdminBotStats is the bot tally.
type AdminBotStats struct {
	Total        int64
	AutoReply    int64
	TotalReplies int64
}

// AdminStats is the dashboard's aggregate statistics.
type AdminStats struct {
	Memos         AdminCountWithMonth
	Diaries       AdminCountWithMonth
	Resources     AdminResourceStats
	Bots          AdminBotStats
	ActiveDays    int64
	LongestStreak int64
}

// Stats gathers global counts for the current month in the app timezone.
func (s *AdminService) Stats(ctx context.Context) (AdminStats, error) {
	tzName, err := s.deps.Settings.GetString(ctx, "app_timezone", "Asia/Shanghai")
	if err != nil {
		return AdminStats{}, domain.Internal(err)
	}
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		loc, tzName = time.UTC, "UTC"
	}

	now := s.now().In(loc)
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	monthEnd := monthStart.AddDate(0, 1, 0)

	counts, err := s.deps.Stats.AdminCounts(ctx, monthStart.UnixMilli(), monthEnd.UnixMilli(), tzName)
	if err != nil {
		slog.ErrorContext(ctx, "admin stats: counts", "err", err)
	}

	return AdminStats{
		Memos:   AdminCountWithMonth{Total: counts.MemosTotal, ThisMonth: counts.MemosMonth},
		Diaries: AdminCountWithMonth{Total: counts.DiariesTotal, ThisMonth: counts.DiariesMonth},
		Resources: AdminResourceStats{
			Total:              counts.ResourcesTotal,
			TotalSize:          counts.ResourcesSize,
			TotalSizeFormatted: formatSize(counts.ResourcesSize),
		},
		Bots: AdminBotStats{
			Total:        counts.BotsTotal,
			AutoReply:    counts.BotsAutoReply,
			TotalReplies: counts.RepliesTotal,
		},
		ActiveDays: counts.ActiveDays,
	}, nil
}

// ListActivity returns up to limit entries, newest first.
func (s *AdminService) ListActivity(limit int, level *string) []admin.Entry {
	return s.deps.Activity.List(limit, level)
}

// Config returns the safe configuration subset.
func (s *AdminService) Config() AdminConfig {
	return s.deps.Config
}

// StartBackfill records the request and runs the backfill in the background,
// so the HTTP response returns immediately.
func (s *AdminService) StartBackfill(ctx context.Context) {
	s.deps.Activity.RecordInfo(
		"backfill_memory_started", "system", nil, "Memory backfill started")

	go func() {
		indexed, failed, users, err := s.deps.Backfiller.BackfillMissing(context.WithoutCancel(ctx))
		if err != nil {
			slog.Error("memory backfill failed", "err", err)
			s.deps.Activity.Record(admin.Entry{
				Timestamp:  time.Now().UnixMilli(),
				Action:     "backfill_memory_failed",
				EntityType: "system",
				Level:      "error",
				Detail:     "Memory backfill failed: " + err.Error(),
			})
			return
		}
		s.deps.Activity.RecordInfo("backfill_memory_completed", "system", nil, fmt.Sprintf(
			"Memory backfill complete: %d indexed, %d failed, %d users", indexed, failed, users))
	}()
}

// AdminSettings is the app-settings payload shared by read and write.
type AdminSettings struct {
	AutoTagEnabled     bool
	AutoSummaryEnabled bool
	AutoDiaryEnabled   bool
	AutoDiaryMinMemos  int32
	AutoDiaryMinChars  int32
	AppTimezone        string
}

// GetSettings reads the six settings the dashboard manages.
func (s *AdminService) GetSettings(ctx context.Context) (AdminSettings, error) {
	autoTag, err := s.deps.Settings.GetBool(ctx, "auto_tag_enabled", true)
	if err != nil {
		return AdminSettings{}, domain.Internal(err)
	}
	autoSummary, err := s.deps.Settings.GetBool(ctx, "auto_summary_enabled", false)
	if err != nil {
		return AdminSettings{}, domain.Internal(err)
	}
	autoDiary, err := s.deps.Settings.GetBool(ctx, "auto_diary_enabled", true)
	if err != nil {
		return AdminSettings{}, domain.Internal(err)
	}
	minMemos, err := s.deps.Settings.GetInt(ctx, "auto_diary_min_memos", 2)
	if err != nil {
		return AdminSettings{}, domain.Internal(err)
	}
	minChars, err := s.deps.Settings.GetInt(ctx, "auto_diary_min_chars", 150)
	if err != nil {
		return AdminSettings{}, domain.Internal(err)
	}
	tzName, err := s.deps.Settings.GetString(ctx, "app_timezone", "Asia/Shanghai")
	if err != nil {
		return AdminSettings{}, domain.Internal(err)
	}
	return AdminSettings{
		AutoTagEnabled:     autoTag,
		AutoSummaryEnabled: autoSummary,
		AutoDiaryEnabled:   autoDiary,
		AutoDiaryMinMemos:  minMemos,
		AutoDiaryMinChars:  minChars,
		AppTimezone:        tzName,
	}, nil
}

// UpdateSettings validates and stores the managed settings.
func (s *AdminService) UpdateSettings(ctx context.Context, in AdminSettings) error {
	if in.AutoDiaryMinMemos < 1 || in.AutoDiaryMinChars < 1 {
		return domain.InvalidInput("auto diary thresholds must be positive")
	}
	if _, err := time.LoadLocation(in.AppTimezone); err != nil {
		return domain.InvalidInput("invalid timezone: must be a valid IANA timezone name")
	}

	values := map[string]string{
		"auto_tag_enabled":     strconv.FormatBool(in.AutoTagEnabled),
		"auto_summary_enabled": strconv.FormatBool(in.AutoSummaryEnabled),
		"auto_diary_enabled":   strconv.FormatBool(in.AutoDiaryEnabled),
		"auto_diary_min_memos": strconv.Itoa(int(in.AutoDiaryMinMemos)),
		"auto_diary_min_chars": strconv.Itoa(int(in.AutoDiaryMinChars)),
		"app_timezone":         in.AppTimezone,
	}
	for key, value := range values {
		if err := s.deps.Settings.SetString(ctx, key, value); err != nil {
			return domain.Internal(err)
		}
	}
	return nil
}

func formatSize(bytes int64) string {
	const (
		kb = int64(1024)
		mb = kb * 1024
		gb = mb * 1024
	)
	switch {
	case bytes >= gb:
		return fmt.Sprintf("%.1f GB", float64(bytes)/float64(gb))
	case bytes >= mb:
		return fmt.Sprintf("%.1f MB", float64(bytes)/float64(mb))
	case bytes >= kb:
		return fmt.Sprintf("%.1f KB", float64(bytes)/float64(kb))
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}
