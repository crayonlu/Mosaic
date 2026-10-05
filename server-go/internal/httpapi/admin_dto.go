package httpapi

// Request and response bodies for the admin API. Field names are part of the
// wire contract with the admin UI.

type adminHealthResponse struct {
	Uptime               string `json:"uptime"`
	StartedAt            int64  `json:"startedAt"`
	Version              string `json:"version"`
	StorageType          string `json:"storageType"`
	StorageUsed          int64  `json:"storageUsed"`
	StorageUsedFormatted string `json:"storageUsedFormatted"`
	DBSize               int64  `json:"dbSize"`
	DBSizeFormatted      string `json:"dbSizeFormatted"`
}

type adminCountWithMonth struct {
	Total     int64 `json:"total"`
	ThisMonth int64 `json:"thisMonth"`
}

type adminResourceStats struct {
	Total              int64  `json:"total"`
	TotalSize          int64  `json:"totalSize"`
	TotalSizeFormatted string `json:"totalSizeFormatted"`
}

type adminBotStats struct {
	Total        int64 `json:"total"`
	AutoReply    int64 `json:"autoReply"`
	TotalReplies int64 `json:"totalReplies"`
}

type adminStatsResponse struct {
	Memos         adminCountWithMonth `json:"memos"`
	Diaries       adminCountWithMonth `json:"diaries"`
	Resources     adminResourceStats  `json:"resources"`
	Bots          adminBotStats       `json:"bots"`
	ActiveDays    int64               `json:"activeDays"`
	LongestStreak int64               `json:"longestStreak"`
}

type adminActivityEntry struct {
	Timestamp  int64   `json:"timestamp"`
	Action     string  `json:"action"`
	EntityType string  `json:"entityType"`
	EntityID   *string `json:"entityId"`
	Level      string  `json:"level"`
	Detail     string  `json:"detail"`
}

type adminActivityResponse struct {
	Entries []adminActivityEntry `json:"entries"`
}

type adminConfigResponse struct {
	Port        uint16 `json:"port"`
	StorageType string `json:"storageType"`
}

type adminAIConfigDTO struct {
	Key              string   `json:"key"`
	Provider         string   `json:"provider"`
	BaseURL          string   `json:"baseUrl"`
	APIKey           string   `json:"apiKey"`
	Model            string   `json:"model"`
	Temperature      *float64 `json:"temperature"`
	MaxTokens        *int32   `json:"maxTokens"`
	TimeoutSeconds   *int32   `json:"timeoutSeconds"`
	SupportsVision   bool     `json:"supportsVision"`
	SupportsThinking bool     `json:"supportsThinking"`
	EmbeddingDim     *int32   `json:"embeddingDim"`
	UpdatedAt        int64    `json:"updatedAt"`
}

type adminAIConfigResponse struct {
	Bot       adminAIConfigDTO `json:"bot"`
	Embedding adminAIConfigDTO `json:"embedding"`
}

// adminAIConfigPayload is the write body for either AI config key.
type adminAIConfigPayload struct {
	Provider         string   `json:"provider"`
	BaseURL          string   `json:"baseUrl"`
	APIKey           string   `json:"apiKey"`
	Model            string   `json:"model"`
	Temperature      *float64 `json:"temperature"`
	MaxTokens        *int32   `json:"maxTokens"`
	TimeoutSeconds   *int32   `json:"timeoutSeconds"`
	SupportsVision   *bool    `json:"supportsVision"`
	SupportsThinking *bool    `json:"supportsThinking"`
	EmbeddingDim     *int32   `json:"embeddingDim"`
}

type adminSettingsPayload struct {
	AutoTagEnabled     bool   `json:"autoTagEnabled"`
	AutoSummaryEnabled bool   `json:"autoSummaryEnabled"`
	AutoDiaryEnabled   bool   `json:"autoDiaryEnabled"`
	AutoDiaryMinMemos  int32  `json:"autoDiaryMinMemos"`
	AutoDiaryMinChars  int32  `json:"autoDiaryMinChars"`
	AppTimezone        string `json:"appTimezone"`
}

type adminMessageResponse struct {
	Message string `json:"message"`
}

// adminErrorResponse is the bare {"error": ...} body the static fallback uses.
type adminErrorResponse struct {
	Error string `json:"error"`
}
