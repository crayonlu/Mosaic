package service

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// ClipArticle is the page the html2llm service returned for a URL.
type ClipArticle struct {
	Title   string
	Content string
}

// ClipFetcher retrieves a page for the clip endpoint. Implementations live
// outside the service package so no HTTP client type leaks in here.
type ClipFetcher interface {
	Fetch(ctx context.Context, url string) (ClipArticle, error)
}

// MemoWithResources is a memo together with the files attached to it.
type MemoWithResources struct {
	Memo      domain.Memo
	Resources []domain.Resource
}

// CreateMemoInput is a decoded create request.
type CreateMemoInput struct {
	Content     string
	Tags        []string
	DiaryDate   *domain.Date
	ResourceIDs []string
	AiSummary   *string
}

// UpdateMemoInput carries only the fields the request supplied. ClearDiaryDate

// ClipInput is a decoded clip request.
type ClipInput struct {
	ClipType   string
	URL        *string
	Content    *string
	ResourceID *string
	UserNote   *string
}

// ClipResult is the extracted article the clip endpoint returns.
type ClipResult struct {
	Title         string
	Content       string
	AiSummary     string
	Tags          []string
	SourceURL     *string
	SourceType    string
	OriginalTitle *string
}

// Clip extracts a page, a passage or an image for the client to turn into a
// memo. The model refines it into a title, summary, body and tags; the previous
// server's fetch through html2llm is unchanged.
func (s *MemoService) Clip(ctx context.Context, userID string, input ClipInput) (ClipResult, error) {
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return ClipResult{}, domain.InvalidUUID(err)
	}

	config, err := s.configs.ChatConfig(ctx, userUUID)
	if err != nil {
		return ClipResult{}, translate(err)
	}

	switch input.ClipType {
	case "url":
		if input.URL == nil || strings.TrimSpace(*input.URL) == "" {
			return ClipResult{}, domain.InvalidInput("URL is required for url clip")
		}
		article, err := s.clips.Fetch(ctx, *input.URL)
		if err != nil {
			return ClipResult{}, translate(err)
		}

		truncated := truncateRunes(article.Content, clipContentLimit)
		result, err := s.callClipAI(ctx, config,
			clipAIInput(article.Title+"\n\n---\n\n"+truncated, input.UserNote), "url", nil)
		if err != nil {
			return ClipResult{}, err
		}

		source := *input.URL
		original := article.Title
		result.SourceURL = &source
		result.SourceType = "url"
		result.OriginalTitle = &original
		return result, nil

	case "text":
		if input.Content == nil {
			return ClipResult{}, domain.InvalidInput("Content is required for text clip")
		}
		result, err := s.callClipAI(ctx, config,
			clipAIInput(*input.Content, input.UserNote), "text", nil)
		if err != nil {
			return ClipResult{}, err
		}
		result.SourceType = "text"
		return result, nil

	case "image":
		if input.ResourceID == nil || strings.TrimSpace(*input.ResourceID) == "" {
			return ClipResult{}, domain.InvalidInput("resourceId is required for image clip")
		}
		resourceID, err := uuid.Parse(strings.TrimSpace(*input.ResourceID))
		if err != nil {
			return ClipResult{}, domain.InvalidInput("Invalid resourceId")
		}

		images, err := s.images.OwnedImages(ctx, userUUID, []uuid.UUID{resourceID}, 1)
		if err != nil {
			return ClipResult{}, translate(err)
		}
		if len(images) == 0 {
			return ClipResult{}, domain.ResourceNotFound()
		}

		result, err := s.callClipAI(ctx, config,
			clipAIInput("Describe this image and generate a suitable title and summary.", input.UserNote),
			"image", images)
		if err != nil {
			return ClipResult{}, err
		}
		result.SourceType = "image"
		return result, nil

	default:
		return ClipResult{}, domain.InvalidInputf("unknown clip type: %s", input.ClipType)
	}
}

// ExtractCSXTitle reads the (title ...) form from html2llm's CSX output. It
// reports false when the form is absent or empty.
func ExtractCSXTitle(csx string) (string, bool) {
	const marker = "(title "
	start := strings.Index(csx, marker)
	if start < 0 {
		return "", false
	}

	rest := csx[start+len(marker):]
	depth := 1
	end := -1
	for offset, ch := range rest {
		switch ch {
		case '(':
			depth++
		case ')':
			depth--
			if depth == 0 {
				end = offset
			}
		}
		if end >= 0 {
			break
		}
	}
	if end < 0 {
		return "", false
	}

	title := strings.TrimSpace(rest[:end])
	title = strings.TrimPrefix(title, "\"")
	title = strings.TrimSuffix(title, "\"")
	if title == "" {
		return "", false
	}
	return title, true
}
