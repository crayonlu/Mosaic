export interface Memo {
  id: string;
  content: string;
  tags: string;
  isArchived: boolean;
  isDeleted: boolean;
  diaryDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Resource {
  id: string;
  memoId: string;
  filename: string;
  resourceType: 'image' | 'voice' | 'video' | 'file';
  mimeType: string;
  size: number;
  createdAt: number;
}

export interface MemoWithResources {
  id: string;
  content: string;
  tags: string;
  isArchived: boolean;
  isDeleted: boolean;
  diaryDate?: string;
  createdAt: number;
  updatedAt: number;
  resources: Resource[];
}

export interface CreateMemoRequest {
  content: string;
  tags?: string;
  resourceFilenames?: string[];
}

export interface ListMemosRequest {
  page?: number;
  pageSize?: number;
  isArchived?: boolean;
  isDeleted?: boolean;
  diaryDate?: string;
}

export interface UpdateMemoRequest {
  id: string;
  content?: string;
  tags?: string;
  resourceFilenames?: string[];
}

