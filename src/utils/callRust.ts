import { invoke } from '@tauri-apps/api/core'
import type { User, UpdateUserRequest } from '@/types/user'
import type {
  MemoWithResources,
  CreateMemoRequest,
  ListMemosRequest,
  UpdateMemoRequest,
} from '@/types/memo'
import type {
  DiaryWithMemos,
  CreateOrUpdateDiaryRequest,
  ListDiariesRequest,
  UpdateDiarySummaryRequest,
  UpdateDiaryMoodRequest,
} from '@/types/diary'
import type { PaginatedResponse } from '@/types/common'
import type { UploadedResource } from '@/types/asset'

export async function callRust<T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (error) {
    console.error(`Error calling ${cmd}:`, error)
    throw error
  }
}

export const userCommands = {
  getUser: () => callRust<User | null>('get_user'),

  getOrCreateDefaultUser: () => callRust<User>('get_or_create_default_user'),

  updateUser: (req: UpdateUserRequest) => callRust<User>('update_user', { req }),

  uploadAvatar: (sourcePath: string) => callRust<User>('upload_avatar', { sourcePath }),
}

export const memoCommands = {
  createMemo: (req: CreateMemoRequest) => callRust<string>('create_memo', { req }),

  getMemo: (memoId: string) => callRust<MemoWithResources>('get_memo', { memoId }),

  listMemos: (req: ListMemosRequest) =>
    callRust<PaginatedResponse<MemoWithResources>>('list_memos', { req }),

  getMemosByDate: (date: string) => callRust<MemoWithResources[]>('get_memos_by_date', { date }),

  updateMemo: (req: UpdateMemoRequest) => callRust<void>('update_memo', { req }),

  deleteMemo: (memoId: string) => callRust<void>('delete_memo', { memoId }),

  archiveMemo: (memoId: string) => callRust<void>('archive_memo', { memoId }),

  unarchiveMemo: (memoId: string) => callRust<void>('unarchive_memo', { memoId }),
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

  saveTempAudio: (filename: string, data: number[]) =>
    callRust<string>('save_temp_audio', { filename, data }),

  saveTempFile: (filename: string, data: number[]) =>
    callRust<string>('save_temp_file', { filename, data }),

  readAudioFile: (filename: string) => callRust<number[]>('read_audio_file', { filename }),
}

export default {
  user: userCommands,
  memo: memoCommands,
  diary: diaryCommands,
  asset: assetCommands,
}
