package httpapi

import (
	"encoding/json"
	"strings"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
	"github.com/crayonlu/mosaic/server-go/internal/service"
)

// Request and response bodies for the bot endpoints. Field names are part of
// the wire contract with installed clients.

type botMemoryStatsDTO struct {
	TotalContextsBuilt int64  `json:"totalContextsBuilt"`
	LastContextAt      *int64 `json:"lastContextAt"`
}

type botSummaryDTO struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	AvatarURL *string `json:"avatarUrl"`
}

type botResponse struct {
	ID          string             `json:"id"`
	Name        string             `json:"name"`
	AvatarURL   *string            `json:"avatarUrl"`
	Description string             `json:"description"`
	Tags        []string           `json:"tags"`
	AutoReply   bool               `json:"autoReply"`
	SortOrder   int32              `json:"sortOrder"`
	Model       *string            `json:"model"`
	AIConfig    map[string]any     `json:"aiConfig"`
	CreatedAt   int64              `json:"createdAt"`
	UpdatedAt   int64              `json:"updatedAt"`
	MemoryStats *botMemoryStatsDTO `json:"memoryStats"`
}

type botReplyNodeResponse struct {
	ID              string                 `json:"id"`
	MemoID          string                 `json:"memoId"`
	Bot             botSummaryDTO          `json:"bot"`
	Content         string                 `json:"content"`
	ThinkingContent *string                `json:"thinkingContent"`
	ParentReplyID   *string                `json:"parentReplyId"`
	UserQuestion    *string                `json:"userQuestion"`
	RevisionNumber  *int32                 `json:"revisionNumber"`
	CreatedAt       int64                  `json:"createdAt"`
	Children        []botReplyNodeResponse `json:"children"`
	ThreadCount     int64                  `json:"threadCount"`
	LatestReplyID   string                 `json:"latestReplyId"`
}

type botThreadMessageDTO struct {
	ID              string   `json:"id"`
	Role            string   `json:"role"`
	Content         string   `json:"content"`
	ThinkingContent *string  `json:"thinkingContent"`
	ResourceIDs     []string `json:"resourceIds"`
	CreatedAt       int64    `json:"createdAt"`
}

type botThreadResponse struct {
	MemoID        string                `json:"memoId"`
	Bot           botSummaryDTO         `json:"bot"`
	Messages      []botThreadMessageDTO `json:"messages"`
	LatestReplyID string                `json:"latestReplyId"`
}

type createBotRequest struct {
	Name        string         `json:"name" validate:"required"`
	AvatarURL   *string        `json:"avatarUrl"`
	Description string         `json:"description"`
	Tags        []string       `json:"tags"`
	AutoReply   *bool          `json:"autoReply"`
	Model       *string        `json:"model"`
	AIConfig    map[string]any `json:"aiConfig"`
}

// updateBotRequest keeps the nullable fields raw so an absent field can be told
// apart from an explicit null, which clears the stored value.
type updateBotRequest struct {
	Name        *string         `json:"name"`
	Description *string         `json:"description"`
	Tags        *[]string       `json:"tags"`
	AutoReply   *bool           `json:"autoReply"`
	SortOrder   *int32          `json:"sortOrder"`
	AvatarURL   json.RawMessage `json:"avatarUrl"`
	Model       json.RawMessage `json:"model"`
	AIConfig    json.RawMessage `json:"aiConfig"`
}

type reorderBotsRequest struct {
	Order []string `json:"order" validate:"required"`
}

type replyToBotRequest struct {
	Question    string   `json:"question" validate:"required"`
	ResourceIDs []string `json:"resourceIds"`
}

func (req createBotRequest) toInput() service.CreateBotInput {
	autoReply := true
	if req.AutoReply != nil {
		autoReply = *req.AutoReply
	}
	return service.CreateBotInput{
		Name:        req.Name,
		AvatarURL:   req.AvatarURL,
		Description: req.Description,
		Tags:        req.Tags,
		AutoReply:   autoReply,
		Model:       req.Model,
		AIConfig:    req.AIConfig,
	}
}

func (req updateBotRequest) toInput() (service.UpdateBotInput, error) {
	input := service.UpdateBotInput{
		Name:        req.Name,
		Description: req.Description,
		Tags:        req.Tags,
		AutoReply:   req.AutoReply,
		SortOrder:   req.SortOrder,
	}

	set, avatarURL, err := decodeNullableString(req.AvatarURL, "avatarUrl")
	if err != nil {
		return input, err
	}
	input.SetAvatar, input.AvatarURL = set, avatarURL

	set, model, err := decodeNullableString(req.Model, "model")
	if err != nil {
		return input, err
	}
	input.SetModel, input.Model = set, model

	if len(req.AIConfig) > 0 {
		input.SetAIConfig = true
		if strings.TrimSpace(string(req.AIConfig)) != "null" {
			var config map[string]any
			if err := json.Unmarshal(req.AIConfig, &config); err != nil {
				return input, domain.InvalidInput("aiConfig must be an object or null")
			}
			input.AIConfig = config
		}
	}
	return input, nil
}

func decodeNullableString(raw json.RawMessage, field string) (bool, *string, error) {
	if len(raw) == 0 {
		return false, nil, nil
	}
	if strings.TrimSpace(string(raw)) == "null" {
		return true, nil, nil
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return false, nil, domain.InvalidInputf("%s must be a string or null", field)
	}
	return true, &value, nil
}

func toBotResponse(bot domain.Bot) botResponse {
	return botResponse{
		ID:          bot.ID.String(),
		Name:        bot.Name,
		AvatarURL:   bot.AvatarURL,
		Description: bot.Description,
		Tags:        botStringList(bot.Tags),
		AutoReply:   bot.AutoReply,
		SortOrder:   bot.SortOrder,
		Model:       bot.Model,
		AIConfig:    bot.AIConfig,
		CreatedAt:   bot.CreatedAt,
		UpdatedAt:   bot.UpdatedAt,
	}
}

func toBotViewResponse(view service.BotView) botResponse {
	response := toBotResponse(view.Bot)
	response.MemoryStats = &botMemoryStatsDTO{
		TotalContextsBuilt: view.Stats.TotalContextsBuilt,
		LastContextAt:      view.Stats.LastContextAt,
	}
	return response
}

func toBotViewResponses(views []service.BotView) []botResponse {
	responses := make([]botResponse, 0, len(views))
	for _, view := range views {
		responses = append(responses, toBotViewResponse(view))
	}
	return responses
}

func toBotReplyNodeResponse(node domain.BotReplyNode) botReplyNodeResponse {
	children := make([]botReplyNodeResponse, 0, len(node.Children))
	for _, child := range node.Children {
		children = append(children, toBotReplyNodeResponse(child))
	}
	return botReplyNodeResponse{
		ID:              node.Reply.ID.String(),
		MemoID:          node.Reply.MemoID.String(),
		Bot:             toBotSummaryDTO(node.Bot),
		Content:         node.Reply.Content,
		ThinkingContent: node.Reply.ThinkingContent,
		ParentReplyID:   botUUIDString(node.Reply.ParentReplyID),
		UserQuestion:    node.Reply.UserQuestion,
		RevisionNumber:  node.Reply.RevisionNumber,
		CreatedAt:       node.Reply.CreatedAt,
		Children:        children,
		ThreadCount:     node.ThreadCount,
		LatestReplyID:   node.LatestReplyID.String(),
	}
}

func toBotReplyNodeResponses(nodes []domain.BotReplyNode) []botReplyNodeResponse {
	responses := make([]botReplyNodeResponse, 0, len(nodes))
	for _, node := range nodes {
		responses = append(responses, toBotReplyNodeResponse(node))
	}
	return responses
}

func toBotThreadResponse(thread domain.BotThread) botThreadResponse {
	messages := make([]botThreadMessageDTO, 0, len(thread.Messages))
	for _, message := range thread.Messages {
		messages = append(messages, botThreadMessageDTO{
			ID:              message.ID.String(),
			Role:            message.Role,
			Content:         message.Content,
			ThinkingContent: message.ThinkingContent,
			ResourceIDs:     botUUIDStrings(message.ResourceIDs),
			CreatedAt:       message.CreatedAt,
		})
	}
	return botThreadResponse{
		MemoID:        thread.MemoID.String(),
		Bot:           toBotSummaryDTO(thread.Bot),
		Messages:      messages,
		LatestReplyID: thread.LatestReplyID.String(),
	}
}

func toBotSummaryDTO(summary domain.BotSummary) botSummaryDTO {
	return botSummaryDTO{
		ID:        summary.ID.String(),
		Name:      summary.Name,
		AvatarURL: summary.AvatarURL,
	}
}

func botStringList(values []string) []string {
	if values == nil {
		return []string{}
	}
	return values
}

func botUUIDString(id *uuid.UUID) *string {
	if id == nil {
		return nil
	}
	rendered := id.String()
	return &rendered
}

func botUUIDStrings(ids []uuid.UUID) []string {
	rendered := make([]string, 0, len(ids))
	for _, id := range ids {
		rendered = append(rendered, id.String())
	}
	return rendered
}

func parseUUIDList(stringsToParse []string) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(stringsToParse))
	for _, value := range stringsToParse {
		id, err := uuid.Parse(value)
		if err != nil {
			return nil, domain.InvalidUUID(err)
		}
		ids = append(ids, id)
	}
	return ids, nil
}
