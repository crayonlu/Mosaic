package service

import (
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// RankCandidates fuses semantic similarity, recency and tag overlap into the
// relevance ordering the previous server produced. Candidates below the
// semantic floor are dropped, so a memo without an embedding never surfaces.
func RankCandidates(
	anchorTags []string,
	candidates []domain.MemoryCandidate,
	nowMs int64,
	limit int,
) []domain.RelatedMemoContext {
	scored := make([]domain.RelatedMemoContext, 0, len(candidates))
	for _, candidate := range candidates {
		semantic := candidate.VectorScore
		if semantic < 0 {
			semantic = 0
		}
		if semantic < minSemanticScore {
			continue
		}

		ageMs := float64(nowMs - candidate.CreatedAt)
		if ageMs < 0 {
			ageMs = 0
		}
		recency := math.Exp(-ageMs / (float64(retrievalRecentDays) * 86_400_000))

		tagOverlap := tagOverlapRatio(anchorTags, candidate.Tags)
		finalScore := semanticWeightMemoryRanking*semantic +
			recencyWeightMemoryRanking*recency +
			relevanceWeightTagOverlap*tagOverlap

		reasons := make([]string, 0, 3)
		if semantic > semanticReasonThreshold {
			reasons = append(reasons, "semantic")
		}
		if recency > recentReasonThreshold {
			reasons = append(reasons, "recent")
		}
		if tagOverlap > 0 {
			reasons = append(reasons, "tags")
		}
		reason := strings.Join(reasons, "+")
		if reason == "" {
			reason = "recent"
		}

		scored = append(scored, domain.RelatedMemoContext{
			MemoID:         candidate.MemoID,
			SummaryExcerpt: truncateRunes(candidate.Content, maxRetrievalExcerptRunes),
			Tags:           candidate.Tags,
			CreatedAt:      candidate.CreatedAt,
			RelevanceScore: finalScore,
			Reason:         reason,
		})
	}

	sort.SliceStable(scored, func(i, j int) bool {
		return scored[i].RelevanceScore > scored[j].RelevanceScore
	})
	if limit >= 0 && len(scored) > limit {
		scored = scored[:limit]
	}
	return scored
}

func tagOverlapRatio(anchorTags, candidateTags []string) float64 {
	if len(anchorTags) == 0 || len(candidateTags) == 0 {
		return 0
	}
	overlap := 0
	for _, tag := range anchorTags {
		if containsString(candidateTags, tag) {
			overlap++
		}
	}
	denominator := len(anchorTags)
	if len(candidateTags) > denominator {
		denominator = len(candidateTags)
	}
	return float64(overlap) / float64(denominator)
}

func containsString(values []string, wanted string) bool {
	for _, value := range values {
		if value == wanted {
			return true
		}
	}
	return false
}

// BuildDebugContext summarizes an assembled context exactly as the previous
// server reported it: candidate count, retrieved ids and prompt character size.
func BuildDebugContext(memos []domain.RelatedMemoContext) domain.BotMemoryDebugContext {
	ids := make([]uuid.UUID, 0, len(memos))
	chars := 0
	for _, memo := range memos {
		ids = append(ids, memo.MemoID)
		chars += len(memo.SummaryExcerpt) + 4
	}
	return domain.BotMemoryDebugContext{
		CandidateCount:   len(memos),
		RetrievedMemoIDs: ids,
		PromptChars:      chars,
	}
}

// AssembleRetrievedMemos joins a debug log's scored ids with the memo rows the
// debug endpoint returns. Memos without a recorded score default to "recent".
func AssembleRetrievedMemos(
	log MemoryDebugLog,
	memos []domain.Memo,
	limit *int,
) []domain.RelatedMemoContext {
	scores := make(map[uuid.UUID]MemoryScore, len(log.Scores))
	for _, score := range log.Scores {
		scores[score.MemoID] = score
	}

	retrieved := make([]domain.RelatedMemoContext, 0, len(memos))
	for _, memo := range memos {
		score, ok := scores[memo.ID]
		if !ok {
			score = MemoryScore{Score: 0, Reason: "recent"}
		}
		retrieved = append(retrieved, domain.RelatedMemoContext{
			MemoID:         memo.ID,
			SummaryExcerpt: MemoExcerpt(memo),
			Tags:           memo.Tags,
			CreatedAt:      memo.CreatedAt,
			RelevanceScore: score.Score,
			Reason:         score.Reason,
		})
	}

	sort.SliceStable(retrieved, func(i, j int) bool {
		return retrieved[i].RelevanceScore > retrieved[j].RelevanceScore
	})
	if limit != nil && *limit >= 0 && len(retrieved) > *limit {
		retrieved = retrieved[:*limit]
	}
	return retrieved
}

// MemoExcerpt prefers the AI summary and otherwise trims the body, matching the
// excerpt rule shared by the memory endpoints.
func MemoExcerpt(memo domain.Memo) string {
	if memo.AiSummary != nil && strings.TrimSpace(*memo.AiSummary) != "" {
		return *memo.AiSummary
	}
	return truncateRunes(memo.Content, maxRetrievalExcerptRunes)
}

// BuildMemoryPrefix renders the memory block injected into a reply prompt. It
// stops before MAX_MEMORY_PREFIX_CHARS so the prompt stays bounded.
func BuildMemoryPrefix(
	memos []domain.RelatedMemoContext,
	nowMs int64,
	loc *time.Location,
) string {
	if len(memos) == 0 {
		return ""
	}
	if loc == nil {
		loc = time.FixedZone("Asia/Shanghai", 8*60*60)
	}
	now := time.UnixMilli(nowMs).In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)

	items := make([]string, 0, len(memos))
	used := 0
	for _, memo := range memos {
		created := time.UnixMilli(memo.CreatedAt).In(loc)
		day := time.Date(created.Year(), created.Month(), created.Day(), 0, 0, 0, 0, loc)
		diffDays := int(today.Sub(day).Hours() / 24)

		entry := "- [" + created.Format("2006-01-02") + "; " + ageLabel(diffDays) +
			"; memo " + memo.MemoID.String() + "] " + memo.SummaryExcerpt
		entryChars := utf8.RuneCountInString(entry)
		if len(items) > 0 && used+entryChars > maxMemoryPrefixChars {
			break
		}
		used += entryChars
		items = append(items, entry)
	}
	if len(items) == 0 {
		return ""
	}
	return "---MEMORY START---\n" +
		"Historical excerpts, possibly AI summaries. Use only when directly relevant to the current message.\n" +
		"Dates describe past records. Similar topics and unnamed people may be unrelated.\n" +
		strings.Join(items, "\n") + "\n---MEMORY END---"
}

func ageLabel(diffDays int) string {
	switch {
	case diffDays == 0:
		return "today"
	case diffDays == 1:
		return "yesterday"
	case diffDays >= 2 && diffDays <= 6:
		return strconv.Itoa(diffDays) + " days ago"
	case diffDays >= 7 && diffDays <= 13:
		return "last week"
	case diffDays >= 14 && diffDays <= 27:
		return "2 weeks ago"
	case diffDays >= 28 && diffDays <= 45:
		return "a month ago"
	default:
		return strconv.Itoa(diffDays/30) + " months ago"
	}
}

// FuseHybridScores combines keyword and semantic search scores with the weights
// the previous server used for hybrid search.
func FuseHybridScores(keyword, semantic float64) float64 {
	return hybridSemanticWeight*semantic + hybridKeywordWeight*keyword
}

// HybridMatchType classifies a fused result by which signals matched.
func HybridMatchType(keyword, semantic float64) string {
	switch {
	case keyword > 0 && semantic > 0:
		return "hybrid"
	case keyword > 0:
		return "keyword"
	default:
		return "semantic"
	}
}

// HybridResultSurvives applies the final-score floor hybrid search uses when a
// semantic embedding participated in the query.
func HybridResultSurvives(finalScore float64, semanticEnabled bool) bool {
	if !semanticEnabled {
		return true
	}
	return finalScore >= hybridMinimumFinal
}

// BuildTimelineSummary groups related memos by day into a short timeline. It
// returns nil when there is nothing to summarize.
func BuildTimelineSummary(memos []domain.RelatedMemoContext, loc *time.Location) *string {
	if len(memos) == 0 {
		return nil
	}
	if loc == nil {
		loc = time.FixedZone("Asia/Shanghai", 8*60*60)
	}

	ordered := make([]domain.RelatedMemoContext, len(memos))
	copy(ordered, memos)
	sort.SliceStable(ordered, func(i, j int) bool {
		return ordered[i].CreatedAt < ordered[j].CreatedAt
	})

	type dayGroup struct {
		label string
		parts []string
	}
	groups := make([]dayGroup, 0)
	indexByDay := make(map[string]int)
	for _, memo := range ordered {
		created := time.UnixMilli(memo.CreatedAt).In(loc)
		key := created.Format("2006-01-02")
		index, ok := indexByDay[key]
		if !ok {
			index = len(groups)
			indexByDay[key] = index
			groups = append(groups, dayGroup{label: timelineLabel(created, loc)})
		}
		groups[index].parts = append(groups[index].parts, strings.TrimSpace(memo.SummaryExcerpt))
	}

	lines := make([]string, 0, len(groups))
	for _, group := range groups {
		combined := truncateRunes(strings.Join(group.parts, "; "), 200)
		lines = append(lines, group.label+": "+combined)
	}
	summary := strings.Join(lines, "\n")
	return &summary
}

func timelineLabel(created time.Time, loc *time.Location) string {
	now := time.Now().In(loc)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	day := time.Date(created.Year(), created.Month(), created.Day(), 0, 0, 0, 0, loc)
	diffDays := int(today.Sub(day).Hours() / 24)
	switch {
	case diffDays == 0:
		return "Today"
	case diffDays == 1:
		return "Yesterday"
	case diffDays < 7:
		return strconv.Itoa(diffDays) + "d ago"
	default:
		return strconv.Itoa(int(created.Month())) + "-" + strconv.Itoa(created.Day())
	}
}

func truncateRunes(value string, limit int) string {
	if limit <= 0 || utf8.RuneCountInString(value) <= limit {
		return value
	}
	runes := []rune(value)
	return string(runes[:limit])
}
