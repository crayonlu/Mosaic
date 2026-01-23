export interface UploadedResource {
  id: string
  filename: string
  size: number
  mimeType: string
  resourceType: string
  storageType?: string
  storagePath?: string
}
