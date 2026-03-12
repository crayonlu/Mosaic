export interface NativeUploadFile {
  uri: string
  name: string
  type: string
  size?: number
}

export interface BinaryUploadFile {
  data: Blob
  name: string
  type: string
  size?: number
}

export type UploadFile = NativeUploadFile | BinaryUploadFile

export interface UploadProgress {
  loaded: number
  total: number | null
  percent: number
}

export interface UploadFileOptions {
  additionalFields?: Record<string, string>
  onProgress?: (progress: UploadProgress) => void
}
