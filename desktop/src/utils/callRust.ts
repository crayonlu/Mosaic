import type {
  CompleteTextRequest,
  CompleteTextResponse,
  RewriteTextRequest,
  RewriteTextResponse,
  SuggestTagsRequest,
  SuggestTagsResponse,
  SummarizeTextRequest,
  SummarizeTextResponse,
} from '@/types/ai'
import type { UploadedResource } from '@/types/asset'
import type { PaginatedResponse } from '@/types/common'
import type {
  CreateOrUpdateDiaryRequest,
  DiaryWithMemos,
  ListDiariesRequest,
  UpdateDiaryMoodRequest,
  UpdateDiarySummaryRequest,
} from '@/types/diary'
import type {
  CreateMemoRequest,
  ListMemosRequest,
  MemoWithResources,
  SearchMemosRequest,
  UpdateMemoRequest,
} from '@/types/memo'
import type { ServerConfig } from '@/types/settings'
import type {
  HeatMapData,
  HeatMapQuery,
  SummaryData,
  SummaryQuery,
  TimelineData,
  TimelineQuery,
  TrendsData,
  TrendsQuery,
} from '@/types/stats'
import type { SyncStatus, SyncStatusInfo } from '@/types/sync'
import type { UpdateUserRequest, User } from '@/types/user'
import { invoke } from '@tauri-apps/api/core'

let isRefreshingToken = false
let refreshPromise: Promise<void> | null = null
let lastRefreshAttempt = 0
let refreshFailed = false
const REFRESH_COOLDOWN_MS = 5000

async function refreshTokenIfNeeded() {
  if (refreshFailed) {
    throw new Error('Token refresh already failed')
  }

  if (isRefreshingToken && refreshPromise) {
    return refreshPromise
  }

  const now = Date.now()
  if (now - lastRefreshAttempt < REFRESH_COOLDOWN_MS) {
    throw new Error('Token refresh on cooldown')
  }

  lastRefreshAttempt = now
  isRefreshingToken = true

  refreshPromise = (async () => {
    try {
      await invoke<{ accessToken: string }>('refresh_token')
      console.log('Token refreshed successfully')
      refreshFailed = false
    } catch (error) {
      const errorMessage = String(error)
      console.error('Error refreshing token:', errorMessage)
      refreshFailed = true

      if (errorMessage.includes('No refresh token available')) {
        console.error('No refresh token available - redirecting to setup')
        if (window.location.pathname !== '/setup') {
          window.location.href = '/setup'
        }
        throw new Error('Please login again')
      }
      console.error('Token refresh failed:', error)
      throw error
    } finally {
      isRefreshingToken = false
      refreshPromise = null
    }
  })()

  return refreshPromise
}

export async function callRust<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>,
  retryCount = 0
): Promise<T> {
  try {
    const result = await invoke<T>(cmd, args)
    return result
  } catch (error) {
    const errorMessage = String(error)
    if (
      (errorMessage.includes('Unauthorized') || errorMessage.includes('User not found')) &&
      retryCount === 0 &&
      cmd !== 'refresh_token'
    ) {
      try {
        await refreshTokenIfNeeded()
        return await callRust<T>(cmd, args, 1)
      } catch (refreshError) {
        console.error(`Error calling ${cmd} after refresh:`, refreshError)
        throw error
      }
    }

    console.error(`Error calling ${cmd}:`, error)
    throw error
  }
}

export const userCommands = {
  getUser: () => callRust<User | null>('get_user'),

  getOrCreateDefaultUser: () => callRust<User>('get_or_create_default_user'),

  updateUser: (req: UpdateUserRequest) => callRust<User>('update_user', { req }),

  uploadAvatar: async (sourcePath: string): Promise<User> => {
    // Read file data using asset commands
    const filename = sourcePath.split(/[\\/]/).pop() || 'avatar'
    const ext = filename.split('.').pop()?.toLowerCase() || 'png'
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp'
    const data = await callRust<number[]>('read_image_file', { filename: sourcePath })
    return callRust<User>('upload_avatar', { sourcePath, data, filename, mimeType })
  },
}

export const memoCommands = {
  createMemo: (req: CreateMemoRequest) => callRust<string>('create_memo', { req }),

  getMemo: (memoId: string) => callRust<MemoWithResources>('get_memo', { memoId }),

  listMemos: (req: ListMemosRequest) =>
    callRust<PaginatedResponse<MemoWithResources>>('list_memos', {
      page: req.page,
      pageSize: req.pageSize,
      isArchived: req.isArchived,
    }),

  getMemosByDate: (date: string) => callRust<MemoWithResources[]>('get_memos_by_date', { date }),

  getMemosByDiaryDate: (diaryDate: string) =>
    callRust<MemoWithResources[]>('get_memos_by_diary_date', { diaryDate }),

  updateMemo: (req: UpdateMemoRequest) => callRust<void>('update_memo', { req }),

  deleteMemo: (memoId: string) => callRust<void>('delete_memo', { memoId }),

  archiveMemo: (memoId: string) => callRust<void>('archive_memo', { memoId }),

  unarchiveMemo: (memoId: string) => callRust<void>('unarchive_memo', { memoId }),

  searchMemos: (req: SearchMemosRequest) =>
    callRust<PaginatedResponse<MemoWithResources>>('search_memos', { req }),
}

export const diaryCommands = {
  getDiaryByDate: (date: string) => callRust<DiaryWithMemos>('get_diary_by_date', { date }),

  createOrUpdateDiary: (req: CreateOrUpdateDiaryRequest) =>
    callRust<void>('create_or_update_diary', { req }),

  listDiaries: (req: ListDiariesRequest) =>
    callRust<PaginatedResponse<DiaryWithMemos>>('list_diaries', { req }),

  updateDiarySummary: (req: UpdateDiarySummaryRequest) =>
    callRust<void>('update_diary_summary', { req }),

  updateDiaryMood: (req: UpdateDiaryMoodRequest) => callRust<void>('update_diary_mood', { req }),
}

export const assetCommands = {
  uploadFiles: (filePaths: string[]) => callRust<UploadedResource[]>('upload_files', { filePaths }),

  saveTempFile: (filename: string, data: number[]) =>
    callRust<string>('save_temp_file', { filename, data }),

  readImageFile: (filename: string) => callRust<number[]>('read_image_file', { filename }),

  deleteAssetFile: (filename: string) => callRust<void>('delete_asset_file', { filename }),
}

export const statsCommands = {
  getHeatmap: (query: HeatMapQuery) =>
    callRust<HeatMapData>('get_heatmap', { startDate: query.startDate, endDate: query.endDate }),

  getTimeline: (query: TimelineQuery) =>
    callRust<TimelineData>('get_timeline', { startDate: query.startDate, endDate: query.endDate }),

  getTrends: (query: TrendsQuery) =>
    callRust<TrendsData>('get_trends', { startDate: query.startDate, endDate: query.endDate }),

  getSummary: (query: SummaryQuery) =>
    callRust<SummaryData>('get_summary', { year: query.year, month: query.month }),
}

export const aiCommands = {
  completeText: async (req: CompleteTextRequest): Promise<CompleteTextResponse> => {
    const generatedText = await callRust<string>('complete_text', { req })
    return { generatedText }
  },

  rewriteText: async (req: RewriteTextRequest): Promise<RewriteTextResponse> => {
    const rewrittenText = await callRust<string>('rewrite_text', { req })
    return { rewrittenText }
  },

  summarizeText: async (req: SummarizeTextRequest): Promise<SummarizeTextResponse> => {
    const summary = await callRust<string>('summarize_text', { req })
    return { summary }
  },

  suggestTags: async (req: SuggestTagsRequest): Promise<SuggestTagsResponse> => {
    const tags = await callRust<string[]>('suggest_tags', { req })
    return { tags }
  },
}

export const syncCommands = {
  triggerSync: () => callRust<SyncStatusInfo>('trigger_sync'),

  getSyncStatus: () => callRust<SyncStatus>('get_sync_status'),
}

export const configCommands = {
  getServerConfig: () => callRust<ServerConfig>('get_server_config'),

  setServerConfig: (serverConfig: ServerConfig) =>
    callRust<void>('set_server_config', { serverConfig }),

  testServerConnection: (serverConfig: ServerConfig) =>
    callRust<void>('test_server_connection', { serverConfig }),

  login: (username: string, password: string) =>
    callRust<{ accessToken: string }>('login', { username, password }),

  refreshToken: () => callRust<{ accessToken: string }>('refresh_token'),

  changePassword: (oldPassword: string, newPassword: string) =>
    callRust<void>('change_password', { oldPassword, newPassword }),

  logout: () => callRust<void>('logout'),
}

export default {
  user: userCommands,
  memo: memoCommands,
  diary: diaryCommands,
  asset: assetCommands,
  stats: statsCommands,
  ai: aiCommands,
  sync: syncCommands,
  config: configCommands,
}
