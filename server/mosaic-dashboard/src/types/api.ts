export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  created_at: number;
  updated_at: number;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface Memo {
  id: string;
  content: string;
  tags: string[];
  is_archived: boolean;
  diary_date?: string;
  created_at: number;
  updated_at: number;
}

export interface CreateMemoRequest {
  content: string;
  tags?: string[];
  diary_date?: string;
}

export interface UpdateMemoRequest {
  content?: string;
  tags?: string[];
  is_archived?: boolean;
  diary_date?: string | null;
}

export interface Resource {
  id: string;
  memo_id: string;
  filename: string;
  resource_type: string;
  mime_type: string;
  file_size: number;
  storage_type: string;
  url: string;
  created_at: number;
}

export interface Diary {
  date: string;
  summary: string;
  mood_key: string;
  mood_score: number;
  cover_image_id?: string;
  memo_count: number;
  created_at: number;
  updated_at: number;
}

export interface CreateDiaryRequest {
  date: string;
  summary: string;
  mood_key: string;
  mood_score?: number;
  cover_image_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
