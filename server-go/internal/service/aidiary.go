package service

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/retry"
)

// Auto-diary scheduler constants, reproduced from the previous server.
const (
	// AIDiarySweepInterval is how often the parent's sweep loop should call
	// ProcessDueJobs.
	AIDiarySweepInterval = 60 * time.Second
	// AIDiaryJobBatchSize bounds how many due jobs one sweep claims.
	AIDiaryJobBatchSize = 16

	aiDiaryRetryDelayMS  = int64(5 * 60 * 1000)
	maxAIDiaryErrorChars = 500

	autoDiaryEnabledKey  = "auto_diary_enabled"
	autoDiaryMinMemosKey = "auto_diary_min_memos"
	autoDiaryMinCharsKey = "auto_diary_min_chars"
)

// allowedMoodKeys are the mood keys the diary prompt accepts.
var allowedMoodKeys = []string{
	"joy", "calm", "neutral", "sadness", "anxiety", "anger", "focus", "tired",
}

// AIDiaryJob identifies one queued auto-diary generation.
type AIDiaryJob struct {
	UserID     uuid.UUID
	TargetDate domain.Date
}

// AIDiaryPayload is a validated diary the model produced.
type AIDiaryPayload struct {
	Summary   string
	MoodKey   string
	MoodScore int32
}

// AIDiaryMessage is one text turn in a diary generation prompt.
type AIDiaryMessage struct {
	Role    string
	Content string
	// Images are attached to this message as provider image parts. They are
	// only populated when the configured model declares vision support.
	Images []ImageInput
}

// AIDiaryImageProvider loads the images attached to a memo. It is declared at
// the consumer so the diary service never imports the storage or resource
// packages.
type AIDiaryImageProvider interface {
	MemoImages(ctx context.Context, userID, memoID uuid.UUID, limit int) ([]ImageInput, error)
}

// AIDiaryCompletionRequest is the narrow chat request the diary generator needs.
// It is declared here so the service never imports the provider client package;
// an adapter translates it at wiring time.
type AIDiaryCompletionRequest struct {
	Config       domain.AIConfig
	SystemPrompt string
	Messages     []AIDiaryMessage
}

// AIDiaryChatClient performs one chat completion for diary generation.
type AIDiaryChatClient interface {
	Complete(ctx context.Context, req AIDiaryCompletionRequest) (string, error)
}

// AIDiarySettings resolves the auto-diary toggles.
type AIDiarySettings interface {
	Bool(ctx context.Context, key string, fallback bool) bool
	Int(ctx context.Context, key string, fallback int32) int32
}

// AIDiaryStore is the persistence the diary scheduler needs.
type AIDiaryStore interface {
	EnqueueJob(ctx context.Context, userID uuid.UUID, targetDate domain.Date, runAfterMS, now int64) error
	ClaimDueJobs(ctx context.Context, now int64, limit int) ([]AIDiaryJob, error)
	CompleteJob(ctx context.Context, userID uuid.UUID, targetDate domain.Date, now int64) error
	FailJob(ctx context.Context, userID uuid.UUID, targetDate domain.Date, lastError string, runAfterMS, now int64) error
	DiaryForDate(ctx context.Context, userID uuid.UUID, targetDate domain.Date) (domain.Diary, error)
	CandidateMemos(ctx context.Context, userID uuid.UUID, startMS, endMS int64) ([]domain.Memo, error)
	SaveGeneratedDiary(
		ctx context.Context,
		userID uuid.UUID,
		targetDate domain.Date,
		summary, moodKey string,
		moodScore int32,
		memoIDs []uuid.UUID,
		now int64,
	) error
}

// AIDiaryService writes diary entries in the background. It decides whether a
// day has enough content, asks the configured chat model for a summary, and
// persists it without ever overwriting a user-edited diary.
type AIDiaryService struct {
	store     AIDiaryStore
	settings  AIDiarySettings
	timezones TimezoneProvider
	configs   ChatConfigProvider
	chat      AIDiaryChatClient
	images    AIDiaryImageProvider
	now       func() int64
	policy    retry.Policy
}

// NewAIDiaryService builds the scheduler. Every collaborator is required.
func NewAIDiaryService(
	store AIDiaryStore,
	settings AIDiarySettings,
	timezones TimezoneProvider,
	configs ChatConfigProvider,
	chat AIDiaryChatClient,
	images AIDiaryImageProvider,
) *AIDiaryService {
	return &AIDiaryService{
		store:     store,
		settings:  settings,
		timezones: timezones,
		configs:   configs,
		chat:      chat,
		images:    images,
		now:       func() int64 { return time.Now().UnixMilli() },
		policy:    retry.DefaultPolicy(),
	}
}

// WithClock replaces the clock. Intended for tests.
func (s *AIDiaryService) WithClock(now func() int64) *AIDiaryService {
	s.now = now
	return s
}

// WithRetryPolicy replaces the provider retry policy. Intended for tests.
func (s *AIDiaryService) WithRetryPolicy(policy retry.Policy) *AIDiaryService {
	s.policy = policy
	return s
}

// QueueJobForMemo schedules the diary for the day the memo was created in. The
// run time is the following day at 00:05 in the configured timezone. A job that
// already completed is left completed, matching the previous server.
func (s *AIDiaryService) QueueJobForMemo(ctx context.Context, memo domain.Memo) error {
	loc := s.timezones.Timezone(ctx)
	targetDate := DateFromTimestamp(memo.CreatedAt, loc)
	runAfter := ComputeRunAfter(targetDate, loc)
	if err := s.store.EnqueueJob(ctx, memo.UserID, targetDate, runAfter, s.now()); err != nil {
		return domain.Internal(err)
	}
	return nil
}

// ProcessDueJobs claims one batch of due jobs and runs them. A job that cannot
// be generated is rescheduled with its last error; it is never dropped. It
// returns how many jobs were claimed. Only a failure to claim is reported as an
// error, so the parent's loop keeps running.
func (s *AIDiaryService) ProcessDueJobs(ctx context.Context) (int, error) {
	jobs, err := s.store.ClaimDueJobs(ctx, s.now(), AIDiaryJobBatchSize)
	if err != nil {
		return 0, domain.Internal(err)
	}

	for _, job := range jobs {
		if runErr := s.runJob(ctx, job); runErr != nil {
			slog.ErrorContext(ctx, "ai diary generation failed",
				"userId", job.UserID, "date", job.TargetDate.String(), "err", runErr)
			retryAt := s.now() + aiDiaryRetryDelayMS
			if failErr := s.store.FailJob(
				ctx, job.UserID, job.TargetDate, truncateError(errorDetail(runErr)), retryAt, s.now(),
			); failErr != nil {
				return len(jobs), domain.Internal(failErr)
			}
			continue
		}
		if err := s.store.CompleteJob(ctx, job.UserID, job.TargetDate, s.now()); err != nil {
			return len(jobs), domain.Internal(err)
		}
	}
	return len(jobs), nil
}

// runJob produces one day's diary. A nil return means the job is done — either
// a diary was written or there was nothing worth generating. Any error leaves
// the job to be retried by the caller.
func (s *AIDiaryService) runJob(ctx context.Context, job AIDiaryJob) error {
	if !s.settings.Bool(ctx, autoDiaryEnabledKey, true) {
		return nil
	}

	minMemos := positiveSetting(s.settings.Int(ctx, autoDiaryMinMemosKey, 2))
	minChars := positiveSetting(s.settings.Int(ctx, autoDiaryMinCharsKey, 150))

	existing, err := s.store.DiaryForDate(ctx, job.UserID, job.TargetDate)
	if err != nil && !errors.Is(err, domain.ErrNoRows) {
		return domain.Internal(err)
	}
	if err == nil && existing.AutoGenerationLocked {
		return nil
	}

	loc := s.timezones.Timezone(ctx)
	startMS, endMS := DayBounds(job.TargetDate, loc)
	memos, err := s.store.CandidateMemos(ctx, job.UserID, startMS, endMS)
	if err != nil {
		return domain.Internal(err)
	}
	totalChars := 0
	for _, memo := range memos {
		totalChars += utf8.RuneCountInString(memo.Content)
	}
	if !ShouldGenerateDiary(len(memos), totalChars, minMemos, minChars) {
		return nil
	}

	config, err := s.configs.ChatConfig(ctx, job.UserID)
	if err != nil {
		return domain.Internal(err)
	}
	if strings.TrimSpace(config.APIKey) == "" ||
		strings.TrimSpace(config.Model) == "" ||
		strings.TrimSpace(config.BaseURL) == "" {
		return domain.Internal(errors.New("AI diary generation requires a configured bot AI model"))
	}

	// The day's images ride along when the model can see; a provider that
	// cannot is never sent image parts.
	var images map[uuid.UUID][]ImageInput
	if config.SupportsVision && s.images != nil {
		images = s.loadDiaryImages(ctx, job.UserID, memos)
	}

	var reply string
	err = retry.Do(ctx, s.policy, func(attemptCtx context.Context) error {
		text, callErr := s.chat.Complete(attemptCtx, AIDiaryCompletionRequest{
			Config:       config,
			SystemPrompt: BuildDiarySystemPrompt(),
			Messages:     BuildDiaryMessagesWithImages(job.TargetDate, memos, images, loc),
		})
		if callErr != nil {
			return callErr
		}
		reply = text
		return nil
	})
	if err != nil {
		return domain.Internal(err)
	}

	payload, err := ParseAIDiaryPayload(reply)
	if err != nil {
		return err
	}

	memoIDs := make([]uuid.UUID, len(memos))
	for index, memo := range memos {
		memoIDs[index] = memo.ID
	}
	if err := s.store.SaveGeneratedDiary(
		ctx, job.UserID, job.TargetDate, payload.Summary, payload.MoodKey,
		payload.MoodScore, memoIDs, s.now(),
	); err != nil {
		return domain.Internal(err)
	}
	return nil
}

// ShouldGenerateDiary reports whether a day holds enough material. More memos
// than the minimum is enough on its own; otherwise the total character count
// must also clear the threshold. Reproduced from the previous server.
func ShouldGenerateDiary(memoCount, totalChars, minMemos, minChars int) bool {
	return memoCount >= minMemos && (totalChars >= minChars || memoCount > minMemos)
}

// DateFromTimestamp returns the calendar day a millisecond timestamp falls on in
// the given timezone.
func DateFromTimestamp(tsMS int64, loc *time.Location) domain.Date {
	return domain.NewDate(time.Unix(tsMS/1000, 0).In(loc))
}

// ComputeRunAfter returns the millisecond instant a day's job becomes due: 00:05
// on the following day in the given timezone.
func ComputeRunAfter(targetDate domain.Date, loc *time.Location) int64 {
	next := targetDate.Time.AddDate(0, 0, 1)
	return time.Date(next.Year(), next.Month(), next.Day(), 0, 5, 0, 0, loc).UnixMilli()
}

// DayBounds returns the millisecond window that covers a calendar day in the
// given timezone.
func DayBounds(targetDate domain.Date, loc *time.Location) (int64, int64) {
	start := time.Date(
		targetDate.Time.Year(), targetDate.Time.Month(), targetDate.Time.Day(),
		0, 0, 0, 0, loc)
	return start.UnixMilli(), start.Add(24 * time.Hour).UnixMilli()
}

// TimeLabel renders a memo's creation time for the prompt.
func TimeLabel(tsMS int64, loc *time.Location) string {
	return time.UnixMilli(tsMS).In(loc).Format("15:04")
}

// BuildDiarySystemPrompt is the diary persona. It is reproduced verbatim from
// the previous server.
func BuildDiarySystemPrompt() string {
	return "You are an insightful personal diary assistant. The user provides their day's memos " +
		"with timestamps so you can understand the emotional flow of their day — when energy " +
		"shifted, how ideas developed, what led to what.\n\n" +
		"Your job: write a concise, reflective daily summary. The timestamps are for YOUR " +
		"understanding, not for the reader.\n\n" +
		"CRITICAL RULE — Never violate: Write your response in the SAME LANGUAGE as the user's " +
		"memos. If memos are in Chinese, write in Chinese. If in Japanese, write in Japanese. " +
		"And so on.\n\n" +
		"Each memo is a separate message. Memo images are shown inline with their memo. When " +
		"image limits were exceeded, text descriptions are substituted — treat these as " +
		"equivalent context for the memo they accompany.\n\n" +
		"Rules:\n" +
		"1. Identify 2-3 themes or emotional threads that run through the day. Do not list events " +
		"chronologically.\n" +
		"2. Notice connections: which ideas built on each other? where did the mood shift? what " +
		"seems unresolved?\n" +
		"3. Write with warmth and insight — like a thoughtful friend who read everything and " +
		"noticed patterns the user might have missed.\n" +
		"4. Stay grounded in the memos. If there's not enough material for a meaningful summary, " +
		"be honest rather than padding.\n" +
		"5. Keep it concise: 2-3 paragraphs is ideal. Quality over quantity.\n\n" +
		"Return only valid JSON with keys summary, moodKey, moodScore.\n" +
		"moodKey must be one of: " + strings.Join(allowedMoodKeys, ", ") + ".\n" +
		"moodScore must be an integer from 1 to 10."
}

// BuildDiaryMessages renders the target date preamble followed by one message
// per memo, in creation order.
// loadDiaryImages collects the images attached to the day's memos. A failure
// for one memo is skipped: images are an enrichment, not a requirement.
func (s *AIDiaryService) loadDiaryImages(
	ctx context.Context,
	userID uuid.UUID,
	memos []domain.Memo,
) map[uuid.UUID][]ImageInput {
	images := make(map[uuid.UUID][]ImageInput, len(memos))
	for _, memo := range memos {
		found, err := s.images.MemoImages(ctx, userID, memo.ID, diaryImageLimit)
		if err != nil {
			slog.WarnContext(ctx, "loading a memo's images for the diary",
				"memoId", memo.ID, "err", err)
			continue
		}
		if len(found) > 0 {
			images[memo.ID] = found
		}
	}
	return images
}

// diaryImageLimit bounds how many images one memo contributes.
const diaryImageLimit = 4

// diaryImageByteBudget caps how many image bytes one diary request may carry,
// so a day of large photos cannot produce an unbounded prompt.
const diaryImageByteBudget = 4 << 20 // 4 MiB

// BuildDiaryMessages renders the day's memos without images.
func BuildDiaryMessages(
	targetDate domain.Date,
	memos []domain.Memo,
	loc *time.Location,
) []AIDiaryMessage {
	return BuildDiaryMessagesWithImages(targetDate, memos, nil, loc)
}

// BuildDiaryMessagesWithImages renders the day's memos, attaching each memo's
// images up to a total byte budget. Images beyond the budget are skipped rather
// than truncated.
func BuildDiaryMessagesWithImages(
	targetDate domain.Date,
	memos []domain.Memo,
	images map[uuid.UUID][]ImageInput,
	loc *time.Location,
) []AIDiaryMessage {
	messages := make([]AIDiaryMessage, 0, len(memos)+1)
	messages = append(messages, AIDiaryMessage{
		Role: "user",
		Content: "Target date: " + targetDate.String() + ". Below are the day's memos, one per " +
			"message. Each may include inline images or text descriptions of images. Write a " +
			"theme-based daily summary. Return JSON only.",
	})

	remaining := diaryImageByteBudget
	for _, memo := range memos {
		summary := ""
		if memo.AiSummary != nil {
			summary = "\nAI Summary: " + strings.TrimSpace(*memo.AiSummary)
		}

		attached := make([]ImageInput, 0)
		for _, image := range images[memo.ID] {
			if len(image.Data) > remaining {
				slog.InfoContext(context.Background(), "skipping a diary image over the budget",
					"memoId", memo.ID, "bytes", len(image.Data), "remaining", remaining)
				continue
			}
			remaining -= len(image.Data)
			attached = append(attached, image)
		}

		messages = append(messages, AIDiaryMessage{
			Role: "user",
			Content: "[" + TimeLabel(memo.CreatedAt, loc) + "] " +
				strings.TrimSpace(memo.Content) + summary,
			Images: attached,
		})
	}
	return messages
}

// ParseAIDiaryPayload extracts and validates the JSON object the model returned.
func ParseAIDiaryPayload(raw string) (AIDiaryPayload, error) {
	start := strings.IndexByte(raw, '{')
	end := strings.LastIndexByte(raw, '}')
	if start < 0 || end < 0 || start >= end {
		return AIDiaryPayload{}, domain.InvalidInput("AI diary response missing JSON object")
	}

	var decoded struct {
		Summary   string `json:"summary"`
		MoodKey   string `json:"moodKey"`
		MoodScore int32  `json:"moodScore"`
	}
	if err := json.Unmarshal([]byte(raw[start:end+1]), &decoded); err != nil {
		return AIDiaryPayload{}, domain.InvalidInput("invalid AI diary JSON: " + err.Error())
	}

	summary := strings.TrimSpace(decoded.Summary)
	if summary == "" {
		return AIDiaryPayload{}, domain.InvalidInput("AI diary summary cannot be empty")
	}
	if !isAllowedMoodKey(decoded.MoodKey) {
		return AIDiaryPayload{}, domain.InvalidInput("invalid AI diary mood key")
	}
	if decoded.MoodScore < 1 || decoded.MoodScore > 10 {
		return AIDiaryPayload{}, domain.InvalidInput("invalid AI diary mood score")
	}
	return AIDiaryPayload{
		Summary:   summary,
		MoodKey:   decoded.MoodKey,
		MoodScore: decoded.MoodScore,
	}, nil
}

func isAllowedMoodKey(key string) bool {
	for _, allowed := range allowedMoodKeys {
		if key == allowed {
			return true
		}
	}
	return false
}

func positiveSetting(value int32) int {
	if value < 1 {
		return 1
	}
	return int(value)
}

// errorDetail unwraps a domain error so a job's last_error records the
// underlying failure rather than the generic client-facing message.
func errorDetail(err error) string {
	var domainErr *domain.Error
	if errors.As(err, &domainErr) && domainErr.Cause != nil {
		return domainErr.Cause.Error()
	}
	return err.Error()
}

func truncateError(value string) string {
	if utf8.RuneCountInString(value) <= maxAIDiaryErrorChars {
		return value
	}
	runes := []rune(value)
	return string(runes[:maxAIDiaryErrorChars]) + "..."
}
