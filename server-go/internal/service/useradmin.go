package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/auth"
	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// ManagedUserStore is the persistence the user-administration endpoints need.
// It is deliberately separate from UserStore so the auth files stay untouched.
type ManagedUserStore interface {
	ByID(ctx context.Context, id uuid.UUID) (domain.User, error)
	ExistsByUsername(ctx context.Context, username string) (bool, error)
	Create(ctx context.Context, username, passwordHash, role string, mustChangePassword bool, now int64) (domain.User, error)
	CountUsers(ctx context.Context) (int64, error)
	ListUsers(ctx context.Context, limit, offset int) ([]domain.User, error)
	UpdateManagedUser(ctx context.Context, id uuid.UUID, isActive bool, role string, passwordHash *string, mustChangePassword bool, now int64) (domain.User, error)
}

// ManagedUserUpdate carries the partial changes an administrator may request.
type ManagedUserUpdate struct {
	IsActive      *bool
	Role          *string
	ResetPassword *string
}

// maxUserPageSize matches the previous server's clamp on the users listing.
const maxUserPageSize = 100

// CreateUser creates a regular account with a password change pending, and
// records the action.
func (s *AdminService) CreateUser(
	ctx context.Context,
	adminID, username, password string,
) (domain.User, error) {
	if strings.TrimSpace(username) == "" {
		return domain.User{}, domain.InvalidInput("Username cannot be empty")
	}
	if len(password) < domain.MinimumPasswordLength {
		return domain.User{}, domain.InvalidInput("Password must be at least 8 characters")
	}

	exists, err := s.deps.Users.ExistsByUsername(ctx, username)
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}
	if exists {
		return domain.User{}, domain.InvalidInput("Username already exists")
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return domain.User{}, err
	}

	user, err := s.deps.Users.Create(ctx, username, hash, domain.RoleUser, true, time.Now().Unix())
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}

	id := user.ID.String()
	s.deps.Activity.RecordInfo("create_user", "user", &id,
		fmt.Sprintf("Admin %s created user %s", adminID, user.Username))
	return user, nil
}

// ListUsers returns one page of accounts plus the total count. The requested
// page size is clamped before it reaches the store.
func (s *AdminService) ListUsers(
	ctx context.Context,
	page, pageSize int,
) ([]domain.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 1
	}
	if pageSize > maxUserPageSize {
		pageSize = maxUserPageSize
	}

	total, err := s.deps.Users.CountUsers(ctx)
	if err != nil {
		return nil, 0, domain.Internal(err)
	}
	users, err := s.deps.Users.ListUsers(ctx, pageSize, (page-1)*pageSize)
	if err != nil {
		return nil, 0, domain.Internal(err)
	}
	if users == nil {
		users = []domain.User{}
	}
	return users, total, nil
}

// UpdateManagedUser applies active/role/reset-password changes, refusing
// self-demotion and self-disable.
func (s *AdminService) UpdateManagedUser(
	ctx context.Context,
	adminID, targetID string,
	in ManagedUserUpdate,
) (domain.User, error) {
	targetUUID, err := uuid.Parse(targetID)
	if err != nil {
		return domain.User{}, domain.InvalidUUID(err)
	}
	adminUUID, err := uuid.Parse(adminID)
	if err != nil {
		return domain.User{}, domain.InvalidUUID(err)
	}

	if targetUUID == adminUUID {
		if in.IsActive != nil && !*in.IsActive {
			return domain.User{}, domain.InvalidInput("Cannot disable your own account")
		}
		if in.Role != nil && *in.Role != domain.RoleAdmin {
			return domain.User{}, domain.InvalidInput("Cannot demote your own account")
		}
	}

	user, err := s.deps.Users.ByID(ctx, targetUUID)
	if errors.Is(err, domain.ErrNoRows) {
		return domain.User{}, domain.UserNotFound()
	}
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}

	newIsActive := user.IsActive
	if in.IsActive != nil {
		newIsActive = *in.IsActive
	}
	newRole := user.Role
	if in.Role != nil {
		newRole = *in.Role
	}
	if newRole != domain.RoleAdmin && newRole != domain.RoleUser {
		return domain.User{}, domain.InvalidInput("Role must be 'admin' or 'user'")
	}

	var passwordHash *string
	newMustChange := user.MustChangePassword
	if in.ResetPassword != nil {
		if len(*in.ResetPassword) < domain.MinimumPasswordLength {
			return domain.User{}, domain.InvalidInput("Password must be at least 8 characters")
		}
		hash, err := auth.HashPassword(*in.ResetPassword)
		if err != nil {
			return domain.User{}, err
		}
		passwordHash = &hash
		newMustChange = true
	}

	updated, err := s.deps.Users.UpdateManagedUser(
		ctx, targetUUID, newIsActive, newRole, passwordHash, newMustChange, time.Now().Unix())
	if errors.Is(err, domain.ErrNoRows) {
		return domain.User{}, domain.UserNotFound()
	}
	if err != nil {
		return domain.User{}, domain.Internal(err)
	}

	id := updated.ID.String()
	s.deps.Activity.RecordInfo("update_user", "user", &id,
		fmt.Sprintf("Admin %s updated user %s", adminID, updated.Username))
	return updated, nil
}

// --- Per-user and server AI configuration administration. ---

// AdminAIConfigStore persists server-wide and per-user AI configurations.
type AdminAIConfigStore interface {
	ServerAIConfig(ctx context.Context, key string) (domain.ServerAIConfig, error)
	UpsertServerAIConfig(ctx context.Context, key string, cfg domain.AIConfig, embeddingDim *int32, now int64) (domain.ServerAIConfig, error)
	UserAIConfig(ctx context.Context, userID uuid.UUID) (domain.UserAIConfig, error)
	UpsertUserAIConfig(ctx context.Context, userID uuid.UUID, cfg domain.AIConfig, now int64) (domain.UserAIConfig, error)
}

// AdminAIConfigView is the wire representation of one AI configuration.
type AdminAIConfigView struct {
	Key              string
	Provider         string
	BaseURL          string
	APIKey           string
	Model            string
	Temperature      *float64
	MaxTokens        *int32
	TimeoutSeconds   *int32
	SupportsVision   bool
	SupportsThinking bool
	EmbeddingDim     *int32
	UpdatedAt        int64
}

// AdminAIConfigPair is the bot/embedding pair the config endpoint returns.
type AdminAIConfigPair struct {
	Bot       AdminAIConfigView
	Embedding AdminAIConfigView
}

// AdminAIConfigInput is a write request for either AI configuration key.
type AdminAIConfigInput struct {
	Provider         string
	BaseURL          string
	APIKey           string
	Model            string
	Temperature      *float64
	MaxTokens        *int32
	TimeoutSeconds   *int32
	SupportsVision   *bool
	SupportsThinking *bool
	EmbeddingDim     *int32
}

// AdminAIConfig returns the caller's own chat config and the server embedding
// config.
func (s *AdminService) AdminAIConfig(ctx context.Context, adminID string) (AdminAIConfigPair, error) {
	bot, err := s.userAIConfigView(ctx, adminID)
	if err != nil {
		return AdminAIConfigPair{}, err
	}
	embedding, err := s.embeddingAIConfigView(ctx)
	if err != nil {
		return AdminAIConfigPair{}, err
	}
	return AdminAIConfigPair{Bot: bot, Embedding: embedding}, nil
}

// AdminUserAIConfig returns any user's chat configuration.
func (s *AdminService) AdminUserAIConfig(ctx context.Context, userID string) (AdminAIConfigView, error) {
	return s.userAIConfigView(ctx, userID)
}

// UpdateAdminAIConfig writes the "bot" (caller's own) or "embedding" config.
func (s *AdminService) UpdateAdminAIConfig(
	ctx context.Context,
	adminID, key string,
	in AdminAIConfigInput,
) (AdminAIConfigView, error) {
	switch key {
	case domain.AIKeyEmbedding:
		stored, err := s.deps.AIConfig.UpsertServerAIConfig(
			ctx, key, in.config(), in.EmbeddingDim, s.now().UnixMilli())
		if err != nil {
			return AdminAIConfigView{}, domain.Internal(err)
		}
		return serverAIConfigView(stored), nil
	case domain.AIKeyChat:
		return s.upsertUserAIConfig(ctx, adminID, in)
	default:
		return AdminAIConfigView{}, domain.InvalidInput("Unsupported AI config key")
	}
}

// UpdateAdminUserAIConfig writes any user's chat configuration.
func (s *AdminService) UpdateAdminUserAIConfig(
	ctx context.Context,
	userID string,
	in AdminAIConfigInput,
) (AdminAIConfigView, error) {
	return s.upsertUserAIConfig(ctx, userID, in)
}

func (s *AdminService) userAIConfigView(ctx context.Context, userID string) (AdminAIConfigView, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		// The previous server treated an unparseable caller as having no config.
		return emptyBotAIConfigView(), nil
	}
	stored, err := s.deps.AIConfig.UserAIConfig(ctx, id)
	if errors.Is(err, domain.ErrNoRows) {
		return emptyBotAIConfigView(), nil
	}
	if err != nil {
		return AdminAIConfigView{}, domain.Internal(err)
	}
	return userAIConfigView(stored), nil
}

func (s *AdminService) embeddingAIConfigView(ctx context.Context) (AdminAIConfigView, error) {
	stored, err := s.deps.AIConfig.ServerAIConfig(ctx, domain.AIKeyEmbedding)
	if errors.Is(err, domain.ErrNoRows) {
		return emptyAIConfigView(domain.AIKeyEmbedding), nil
	}
	if err != nil {
		return AdminAIConfigView{}, domain.Internal(err)
	}
	return serverAIConfigView(stored), nil
}

func (s *AdminService) upsertUserAIConfig(
	ctx context.Context,
	userID string,
	in AdminAIConfigInput,
) (AdminAIConfigView, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return AdminAIConfigView{}, domain.InvalidUUID(err)
	}
	stored, err := s.deps.AIConfig.UpsertUserAIConfig(ctx, id, in.config(), s.now().UnixMilli())
	if err != nil {
		return AdminAIConfigView{}, domain.Internal(err)
	}
	return userAIConfigView(stored), nil
}

func (in AdminAIConfigInput) config() domain.AIConfig {
	return domain.AIConfig{
		Provider:         in.Provider,
		BaseURL:          in.BaseURL,
		APIKey:           in.APIKey,
		Model:            in.Model,
		Temperature:      in.Temperature,
		MaxTokens:        in.MaxTokens,
		TimeoutSeconds:   in.TimeoutSeconds,
		SupportsVision:   boolOr(in.SupportsVision, false),
		SupportsThinking: boolOr(in.SupportsThinking, false),
	}
}

func userAIConfigView(c domain.UserAIConfig) AdminAIConfigView {
	return AdminAIConfigView{
		Key:              domain.AIKeyChat,
		Provider:         c.Provider,
		BaseURL:          c.BaseURL,
		APIKey:           c.APIKey,
		Model:            c.Model,
		Temperature:      c.Temperature,
		MaxTokens:        c.MaxTokens,
		TimeoutSeconds:   c.TimeoutSeconds,
		SupportsVision:   c.SupportsVision,
		SupportsThinking: c.SupportsThinking,
		UpdatedAt:        c.UpdatedAt,
	}
}

// serverAIConfigView clears the runtime capability flags, matching the
// previous server's admin responses.
func serverAIConfigView(c domain.ServerAIConfig) AdminAIConfigView {
	return AdminAIConfigView{
		Key:              c.Key,
		Provider:         c.Provider,
		BaseURL:          c.BaseURL,
		APIKey:           c.APIKey,
		Model:            c.Model,
		Temperature:      c.Temperature,
		MaxTokens:        c.MaxTokens,
		TimeoutSeconds:   c.TimeoutSeconds,
		SupportsVision:   false,
		SupportsThinking: false,
		EmbeddingDim:     c.EmbeddingDim,
		UpdatedAt:        c.UpdatedAt,
	}
}

func emptyBotAIConfigView() AdminAIConfigView {
	return emptyAIConfigView(domain.AIKeyChat)
}

func emptyAIConfigView(key string) AdminAIConfigView {
	return AdminAIConfigView{Key: key, Provider: "openai"}
}

func boolOr(value *bool, fallback bool) bool {
	if value == nil {
		return fallback
	}
	return *value
}
