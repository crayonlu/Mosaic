package httpapi

import (
	"encoding/json"
	"strings"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// Request and response bodies for the memo endpoints. Field names are part of
// the wire contract with installed clients.

type createMemoRequest struct {
	Content     string   `json:"content" validate:"required"`
	Tags        []string `json:"tags"`
	DiaryDate   *string  `json:"diaryDate"`
	ResourceIDs []string `json:"resourceIds"`
	AiSummary   *string  `json:"aiSummary"`
}

// updateMemoRequest holds optional fields. DiaryDate is kept raw so an explicit
// null (detach from the diary) can be told apart from an absent field.
type updateMemoRequest struct {
	Content     *string         `json:"content"`
	Tags        *[]string       `json:"tags"`
	ResourceIDs *[]string       `json:"resourceIds"`
	IsArchived  *bool           `json:"isArchived"`
	DiaryDate   json.RawMessage `json:"diaryDate"`
	AiSummary   *string         `json:"aiSummary"`
}

type archiveMemoRequest struct {
	DiaryDate *string `json:"diaryDate"`
}

type clipRequest struct {
	ClipType   string  `json:"clipType" validate:"required"`
	URL        *string `json:"url"`
	Content    *string `json:"content"`
	ResourceID *string `json:"resourceId"`
	UserNote   *string `json:"userNote"`
}

type resourceResponse struct {
	ID            string         `json:"id"`
	MemoID        *string        `json:"memoId"`
	Filename      string         `json:"filename"`
	ResourceType  string         `json:"resourceType"`
	MimeType      string         `json:"mimeType"`
	Size          int64          `json:"size"`
	StorageType   *string        `json:"storageType"`
	StoragePath   *string        `json:"storagePath"`
	URL           string         `json:"url"`
	ThumbnailURL  *string        `json:"thumbnailUrl"`
	Metadata      map[string]any `json:"metadata"`
	AiDescription *string        `json:"aiDescription"`
	CreatedAt     int64          `json:"createdAt"`
}

type memoResponse struct {
	ID            string             `json:"id"`
	Content       string             `json:"content"`
	Tags          []string           `json:"tags"`
	IsArchived    bool               `json:"isArchived"`
	DiaryDate     *string            `json:"diaryDate"`
	AiSummary     *string            `json:"aiSummary"`
	CreatedAt     int64              `json:"createdAt"`
	UpdatedAt     int64              `json:"updatedAt"`
	RevisionCount int32              `json:"revisionCount"`
	Resources     []resourceResponse `json:"resources"`
}

type memoRevisionResponse struct {
	ID             string   `json:"id"`
	MemoID         string   `json:"memoId"`
	RevisionNumber int32    `json:"revisionNumber"`
	Content        string   `json:"content"`
	Tags           []string `json:"tags"`
	AiSummary      *string  `json:"aiSummary"`
	CreatedAt      int64    `json:"createdAt"`
}

type botReplyResponse struct {
	ID              string  `json:"id"`
	MemoID          string  `json:"memoId"`
	BotID           string  `json:"botId"`
	Content         string  `json:"content"`
	ThinkingContent *string `json:"thinkingContent"`
	ParentReplyID   *string `json:"parentReplyId"`
	UserQuestion    *string `json:"userQuestion"`
	RevisionNumber  *int32  `json:"revisionNumber"`
	CreatedAt       int64   `json:"createdAt"`
}

type memoDetailResponse struct {
	Memo       memoResponse           `json:"memo"`
	Revisions  []memoRevisionResponse `json:"revisions"`
	BotReplies []botReplyNodeResponse `json:"botReplies"`
}

// searchMemosResponse is deliberately not the paginated envelope: the previous
// server returned a distinct shape carrying semanticEnabled.
type searchMemosResponse struct {
	Memos           []memoResponse `json:"memos"`
	Total           int64          `json:"total"`
	Page            uint32         `json:"page"`
	PageSize        uint32         `json:"pageSize"`
	SemanticEnabled bool           `json:"semanticEnabled"`
}

type paginatedMemoResponse struct {
	Items      []memoResponse `json:"items"`
	Total      int64          `json:"total"`
	Page       uint32         `json:"page"`
	PageSize   uint32         `json:"pageSize"`
	TotalPages uint32         `json:"totalPages"`
}

type clipResultResponse struct {
	Title         string   `json:"title"`
	Content       string   `json:"content"`
	AiSummary     string   `json:"aiSummary"`
	Tags          []string `json:"tags"`
	SourceURL     *string  `json:"sourceUrl"`
	SourceType    string   `json:"sourceType"`
	OriginalTitle *string  `json:"originalTitle"`
}

func toMemoResponse(memo service.MemoWithResources) memoResponse {
	resources := make([]resourceResponse, 0, len(memo.Resources))
	for _, resource := range memo.Resources {
		resources = append(resources, toResourceResponse(resource))
	}
	return memoResponse{
		ID:            memo.Memo.ID.String(),
		Content:       memo.Memo.Content,
		Tags:          memoStringList(memo.Memo.Tags),
		IsArchived:    memo.Memo.IsArchived,
		DiaryDate:     domain.StringOrNil(memo.Memo.DiaryDate),
		AiSummary:     memo.Memo.AiSummary,
		CreatedAt:     memo.Memo.CreatedAt,
		UpdatedAt:     memo.Memo.UpdatedAt,
		RevisionCount: memo.Memo.RevisionCount,
		Resources:     resources,
	}
}

func toPaginatedMemoResponse(page domain.Paginated[service.MemoWithResources]) paginatedMemoResponse {
	items := make([]memoResponse, 0, len(page.Items))
	for _, memo := range page.Items {
		items = append(items, toMemoResponse(memo))
	}
	return paginatedMemoResponse{
		Items:      items,
		Total:      page.Total,
		Page:       page.Page,
		PageSize:   page.PageSize,
		TotalPages: page.TotalPages,
	}
}

func toMemoResponses(memos []service.MemoWithResources) []memoResponse {
	items := make([]memoResponse, 0, len(memos))
	for _, memo := range memos {
		items = append(items, toMemoResponse(memo))
	}
	return items
}

func toResourceResponse(resource domain.Resource) resourceResponse {
	storageType := resource.StorageType
	storagePath := resource.StoragePath
	metadata := resource.Metadata
	if metadata == nil {
		metadata = map[string]any{}
	}
	response := resourceResponse{
		ID:            resource.ID.String(),
		MemoID:        memoUUIDString(resource.MemoID),
		Filename:      resource.Filename,
		ResourceType:  resource.Type,
		MimeType:      resource.MimeType,
		Size:          resource.FileSize,
		StorageType:   &storageType,
		StoragePath:   &storagePath,
		URL:           domain.DownloadRoute(resource.ID),
		Metadata:      metadata,
		AiDescription: resource.AiDescription,
		CreatedAt:     resource.CreatedAt,
	}
	if strings.HasPrefix(resource.MimeType, "video/") {
		thumbnail := domain.ThumbnailRoute(resource.ID)
		response.ThumbnailURL = &thumbnail
	}
	return response
}

func toRevisionResponse(revision domain.MemoRevision) memoRevisionResponse {
	return memoRevisionResponse{
		ID:             revision.ID.String(),
		MemoID:         revision.MemoID.String(),
		RevisionNumber: revision.RevisionNumber,
		Content:        revision.Content,
		Tags:           memoStringList(revision.Tags),
		AiSummary:      revision.AiSummary,
		CreatedAt:      revision.CreatedAt,
	}
}

func toRevisionResponses(revisions []domain.MemoRevision) []memoRevisionResponse {
	items := make([]memoRevisionResponse, 0, len(revisions))
	for _, revision := range revisions {
		items = append(items, toRevisionResponse(revision))
	}
	return items
}

func toBotReplyResponse(reply domain.BotReply) botReplyResponse {
	return botReplyResponse{
		ID:              reply.ID.String(),
		MemoID:          reply.MemoID.String(),
		BotID:           reply.BotID.String(),
		Content:         reply.Content,
		ThinkingContent: reply.ThinkingContent,
		ParentReplyID:   memoUUIDString(reply.ParentReplyID),
		UserQuestion:    reply.UserQuestion,
		RevisionNumber:  reply.RevisionNumber,
		CreatedAt:       reply.CreatedAt,
	}
}

func toBotReplyResponses(replies []domain.BotReply) []botReplyResponse {
	items := make([]botReplyResponse, 0, len(replies))
	for _, reply := range replies {
		items = append(items, toBotReplyResponse(reply))
	}
	return items
}

func toClipResultResponse(result service.ClipResult) clipResultResponse {
	return clipResultResponse{
		Title:         result.Title,
		Content:       result.Content,
		AiSummary:     result.AiSummary,
		Tags:          memoStringList(result.Tags),
		SourceURL:     result.SourceURL,
		SourceType:    result.SourceType,
		OriginalTitle: result.OriginalTitle,
	}
}

func memoStringList(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func memoUUIDString(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	rendered := id.String()
	return &rendered
}
