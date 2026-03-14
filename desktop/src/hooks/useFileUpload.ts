import { toast } from '@/hooks/useToast'
import { extractBrowserMediaMetadata, toBrowserUploadFile } from '@/utils/mediaFile'
import type { ResourceResponse, UploadProgress } from '@mosaic/api'
import { uploadResourceFiles } from '@mosaic/api'

interface DesktopUploadCallbacks {
  onFileStart?: (file: File) => void
  onFileProgress?: (file: File, progress: UploadProgress) => void
  onFileComplete?: (file: File, resource: ResourceResponse) => void
  onFileError?: (file: File, error: unknown) => void
}

export async function uploadFiles(
  files: File[],
  memoId?: string,
  callbacks: DesktopUploadCallbacks = {}
): Promise<ResourceResponse[]> {
  if (files.length === 0) return []

  const filesById = new Map(files.map(file => [file.name, file]))
  const entries = files.map(file => ({
    id: file.name,
    file: toBrowserUploadFile(file),
  }))

  return uploadResourceFiles(entries, {
    memoId,
    resolveMetadata: file => {
      const originalFile = filesById.get(file.name)
      return originalFile ? extractBrowserMediaMetadata(originalFile) : undefined
    },
    onFileStart: entry => {
      const originalFile = filesById.get(entry.id)
      if (originalFile) {
        callbacks.onFileStart?.(originalFile)
      }
    },
    onFileProgress: (entry, progress) => {
      const originalFile = filesById.get(entry.id)
      if (originalFile) {
        callbacks.onFileProgress?.(originalFile, progress)
      }
    },
    onFileComplete: (entry, resource) => {
      const originalFile = filesById.get(entry.id)
      if (originalFile) {
        callbacks.onFileComplete?.(originalFile, resource)
      }
    },
    onFileError: (entry, error) => {
      const originalFile = filesById.get(entry.id)
      const filename = originalFile?.name ?? entry.file.name
      console.error(`上传文件 ${filename} 失败:`, error)
      toast.error(`上传文件 ${filename} 失败`)
      if (originalFile) {
        callbacks.onFileError?.(originalFile, error)
      }
    },
  })
}

export async function uploadFilesAndGetResourceIds(
  files: File[],
  memoId?: string,
  callbacks?: DesktopUploadCallbacks
): Promise<string[]> {
  const resources = await uploadFiles(files, memoId, callbacks)
  return resources.map(resource => resource.id)
}

export function createObjectUrl(file: File): string {
  return URL.createObjectURL(file)
}
