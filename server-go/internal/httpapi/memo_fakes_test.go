package httpapi

import (
	"context"
	"sort"
	"strings"
	"sync"

	"github.com/google/uuid"

	"github.com/crayonlu/mosaic/server-go/internal/domain"
)

// fakeMemoStore is an in-memory service.MemoStore that mirrors the SQL
// semantics the service relies on.
type fakeMemoStore struct {
	mu        sync.Mutex
	memos     map[uuid.UUID]domain.Memo
	revisions map[uuid.UUID][]domain.MemoRevision
	resources map[uuid.UUID][]domain.Resource
	replies   map[uuid.UUID][]domain.BotReply
}

func newFakeMemoStore() *fakeMemoStore {
	return &fakeMemoStore{
		memos:     map[uuid.UUID]domain.Memo{},
		revisions: map[uuid.UUID][]domain.MemoRevision{},
		resources: map[uuid.UUID][]domain.Resource{},
		replies:   map[uuid.UUID][]domain.BotReply{},
	}
}

func (f *fakeMemoStore) Create(_ context.Context, memo domain.Memo, initial domain.MemoRevision) (domain.Memo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	memo.Tags = memoSortedStrings(memo.Tags)
	f.memos[memo.ID] = memo
	f.revisions[memo.ID] = append(f.revisions[memo.ID], initial)
	return memo, nil
}

func (f *fakeMemoStore) ByID(_ context.Context, userID, memoID uuid.UUID) (domain.Memo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID || memo.IsDeleted {
		return domain.Memo{}, domain.ErrNoRows
	}
	return memo, nil
}

func (f *fakeMemoStore) Update(
	_ context.Context,
	userID, memoID uuid.UUID,
	content *string,
	tags *[]string,
	isArchived *bool,
	diaryDate *domain.Date,
	clearDiaryDate bool,
	aiSummary *string,
	now int64,
) (domain.Memo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID || memo.IsDeleted {
		return domain.Memo{}, domain.ErrNoRows
	}

	if content != nil {
		memo.Content = *content
	}
	if tags != nil {
		memo.Tags = memoSortedStrings(*tags)
	}
	if isArchived != nil {
		memo.IsArchived = *isArchived
	}
	if diaryDate != nil {
		memo.DiaryDate = diaryDate
	} else if clearDiaryDate {
		memo.DiaryDate = nil
	}
	if aiSummary != nil {
		memo.AiSummary = aiSummary
	}
	memo.UpdatedAt = memoGreatest(now, memo.UpdatedAt+1)

	if content != nil {
		memo.RevisionCount++
		f.revisions[memoID] = append(f.revisions[memoID], domain.MemoRevision{
			ID:             uuid.New(),
			MemoID:         memo.ID,
			UserID:         memo.UserID,
			RevisionNumber: memo.RevisionCount,
			Content:        memo.Content,
			Tags:           memoSortedStrings(memo.Tags),
			AiSummary:      memo.AiSummary,
			CreatedAt:      now,
		})
	}

	f.memos[memoID] = memo
	return memo, nil
}

func (f *fakeMemoStore) SoftDelete(_ context.Context, userID, memoID uuid.UUID, now int64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID {
		return domain.ErrNoRows
	}
	memo.IsDeleted = true
	memo.UpdatedAt = memoGreatest(now, memo.UpdatedAt+1)
	f.memos[memoID] = memo
	return nil
}

func (f *fakeMemoStore) SetArchived(
	_ context.Context,
	userID, memoID uuid.UUID,
	archived bool,
	diaryDate *domain.Date,
	now int64,
) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID || memo.IsDeleted {
		return domain.ErrNoRows
	}
	memo.IsArchived = archived
	if archived && diaryDate != nil {
		memo.DiaryDate = diaryDate
	}
	memo.UpdatedAt = memoGreatest(now, memo.UpdatedAt+1)
	f.memos[memoID] = memo
	return nil
}

func (f *fakeMemoStore) List(
	_ context.Context,
	userID uuid.UUID,
	filter domain.MemoListFilter,
	offset uint32,
) ([]domain.Memo, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var matched []domain.Memo
	for _, memo := range f.memos {
		if memo.UserID != userID || memo.IsDeleted {
			continue
		}
		switch {
		case filter.Search != nil:
			if !memoContainsFold(memo.Content, *filter.Search) &&
				!memoTagsContainFold(memo.Tags, *filter.Search) {
				continue
			}
		case filter.DiaryDate != nil:
			if memo.DiaryDate == nil || memo.DiaryDate.String() != filter.DiaryDate.String() || !memo.IsArchived {
				continue
			}
		case filter.Archived != nil:
			if memo.IsArchived != *filter.Archived {
				continue
			}
		}
		matched = append(matched, memo)
	}

	memoSortByCreatedDesc(matched)
	return memoPageOf(matched, offset, filter.PageSize), int64(len(matched)), nil
}

func (f *fakeMemoStore) ByCreatedDate(
	_ context.Context,
	userID uuid.UUID,
	startMS, endMS int64,
	archived *bool,
) ([]domain.Memo, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var matched []domain.Memo
	for _, memo := range f.memos {
		if memo.UserID != userID || memo.IsDeleted {
			continue
		}
		if memo.CreatedAt < startMS || memo.CreatedAt >= endMS {
			continue
		}
		if archived != nil && memo.IsArchived != *archived {
			continue
		}
		matched = append(matched, memo)
	}
	memoSortByCreatedDesc(matched)
	return matched, nil
}

func (f *fakeMemoStore) Search(
	_ context.Context,
	userID uuid.UUID,
	query domain.MemoSearchQuery,
	fromMS, toMS *int64,
	offset uint32,
) ([]domain.Memo, int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	var matched []domain.Memo
	for _, memo := range f.memos {
		if memo.UserID != userID || memo.IsDeleted {
			continue
		}
		if query.Query != "" && !memoContainsFold(memo.Content, query.Query) &&
			!memoTagsContainFold(memo.Tags, query.Query) {
			continue
		}
		if query.IsArchived != nil && memo.IsArchived != *query.IsArchived {
			continue
		}
		if !memoHasAllTags(memo.Tags, query.Tags) {
			continue
		}
		if fromMS != nil && memo.CreatedAt < *fromMS {
			continue
		}
		if toMS != nil && memo.CreatedAt >= *toMS {
			continue
		}
		matched = append(matched, memo)
	}

	memoSortByCreatedDesc(matched)
	return memoPageOf(matched, offset, query.PageSize), int64(len(matched)), nil
}

func (f *fakeMemoStore) TagCounts(_ context.Context, userID uuid.UUID) ([]domain.TagCount, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	counts := map[string]int64{}
	for _, memo := range f.memos {
		if memo.UserID != userID || memo.IsDeleted {
			continue
		}
		for _, tag := range memo.Tags {
			counts[tag]++
		}
	}

	names := make([]string, 0, len(counts))
	for name := range counts {
		names = append(names, name)
	}
	sort.Strings(names)

	tags := make([]domain.TagCount, 0, len(names))
	for _, name := range names {
		tags = append(tags, domain.TagCount{Tag: name, Count: counts[name]})
	}
	return tags, nil
}

func (f *fakeMemoStore) Revisions(_ context.Context, userID, memoID uuid.UUID) ([]domain.MemoRevision, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID {
		return []domain.MemoRevision{}, nil
	}

	revisions := []domain.MemoRevision{}
	for _, revision := range f.revisions[memoID] {
		if !revision.IsDeleted {
			revisions = append(revisions, revision)
		}
	}
	sort.Slice(revisions, func(i, j int) bool {
		return revisions[i].RevisionNumber < revisions[j].RevisionNumber
	})
	return revisions, nil
}

func (f *fakeMemoStore) DeleteRevision(
	_ context.Context,
	userID, memoID, revisionID uuid.UUID,
	now int64,
) error {
	f.mu.Lock()
	defer f.mu.Unlock()

	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID {
		return domain.ErrNoRows
	}

	active := int64(0)
	for _, revision := range f.revisions[memoID] {
		if !revision.IsDeleted {
			active++
		}
	}
	if active <= 1 {
		return domain.InvalidInput("Cannot delete the last revision. Delete the memo instead.")
	}

	for i, revision := range f.revisions[memoID] {
		if revision.ID == revisionID && !revision.IsDeleted {
			f.revisions[memoID][i].IsDeleted = true
			memo.UpdatedAt = memoGreatest(now, memo.UpdatedAt+1)
			f.memos[memoID] = memo
			return nil
		}
	}
	return domain.ErrNoRows
}

func (f *fakeMemoStore) ResourcesForMemo(_ context.Context, memoID uuid.UUID) ([]domain.Resource, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]domain.Resource{}, f.resources[memoID]...), nil
}

func (f *fakeMemoStore) ResourcesForMemos(_ context.Context, memoIDs []uuid.UUID) (map[uuid.UUID][]domain.Resource, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := map[uuid.UUID][]domain.Resource{}
	for _, id := range memoIDs {
		if resources, ok := f.resources[id]; ok {
			out[id] = append([]domain.Resource{}, resources...)
		}
	}
	return out, nil
}

func (f *fakeMemoStore) AssociateResources(_ context.Context, memoID uuid.UUID, resourceIDs []uuid.UUID) error {
	return nil
}

func (f *fakeMemoStore) ReplaceResources(_ context.Context, memoID uuid.UUID, resourceIDs []uuid.UUID, _ int64) error {
	return nil
}

func (f *fakeMemoStore) RepliesForMemo(_ context.Context, userID, memoID uuid.UUID) ([]domain.BotReply, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	memo, ok := f.memos[memoID]
	if !ok || memo.UserID != userID {
		return []domain.BotReply{}, nil
	}
	return append([]domain.BotReply{}, f.replies[memoID]...), nil
}

func memoSortByCreatedDesc(memos []domain.Memo) {
	sort.Slice(memos, func(i, j int) bool { return memos[i].CreatedAt > memos[j].CreatedAt })
}

func memoPageOf(memos []domain.Memo, offset, pageSize uint32) []domain.Memo {
	if offset >= uint32(len(memos)) {
		return []domain.Memo{}
	}
	end := offset + pageSize
	if end > uint32(len(memos)) {
		end = uint32(len(memos))
	}
	return append([]domain.Memo{}, memos[offset:end]...)
}

func memoContainsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

func memoTagsContainFold(tags []string, needle string) bool {
	for _, tag := range tags {
		if memoContainsFold(tag, needle) {
			return true
		}
	}
	return false
}

func memoHasAllTags(have, want []string) bool {
	for _, wanted := range want {
		found := false
		for _, tag := range have {
			if strings.EqualFold(tag, wanted) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func memoSortedStrings(values []string) []string {
	out := append([]string{}, values...)
	sort.Strings(out)
	return out
}

func memoGreatest(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}

// GetBotReplies assembles the fake's replies into a tree, mirroring the shape
// the bot service returns so memo detail can be driven without it.
func (f *fakeMemoStore) GetBotReplies(
	_ context.Context,
	_ string,
	memoID uuid.UUID,
) ([]domain.BotReplyNode, error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	byParent := map[uuid.UUID][]domain.BotReply{}
	var roots []domain.BotReply
	for _, reply := range f.replies[memoID] {
		if reply.ParentReplyID == nil {
			roots = append(roots, reply)
			continue
		}
		byParent[*reply.ParentReplyID] = append(byParent[*reply.ParentReplyID], reply)
	}

	var build func(reply domain.BotReply) domain.BotReplyNode
	build = func(reply domain.BotReply) domain.BotReplyNode {
		children := make([]domain.BotReplyNode, 0)
		count := int64(0)
		latest := reply.ID
		for _, child := range byParent[reply.ID] {
			node := build(child)
			children = append(children, node)
			count += 1 + node.ThreadCount
		}
		return domain.BotReplyNode{
			Reply:         reply,
			Children:      children,
			ThreadCount:   count,
			LatestReplyID: latest,
		}
	}

	nodes := make([]domain.BotReplyNode, 0, len(roots))
	for _, root := range roots {
		nodes = append(nodes, build(root))
	}
	return nodes, nil
}
