import { toast } from '@/hooks/use-toast'
import { useInputStore } from '@/stores/input-store'
import { assetCommands } from '@/utils/callRust'
import { useCallback } from 'react'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']

function isValidFileType(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return IMAGE_EXTENSIONS.includes(ext)
}

function getFileType(filename: string): 'image' {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  return 'image'
}

export interface UploadedFileInfo {
  filename: string
  previewUrl: string
  type: 'image'
  size: number
}

export function useFileUpload() {
  const { addUploadingFile, removeUploadingFile } = useInputStore()

  const uploadFiles = useCallback(
    async (files: FileList): Promise<UploadedFileInfo[]> => {
      const fileArray = Array.from(files)
      const uploadedFiles: UploadedFileInfo[] = []

      for (const file of fileArray) {
        if (!isValidFileType(file.name)) {
          console.error(`不支持的文件类型: ${file.name}`)
          continue
        }

        const fileType = getFileType(file.name)
        addUploadingFile({
          name: file.name,
          size: file.size,
          type: fileType,
        })

        try {
          const previewUrl = URL.createObjectURL(file)
          const arrayBuffer = await file.arrayBuffer()
          const uint8Array = Array.from(new Uint8Array(arrayBuffer))

          const uploadedResources = await assetCommands.uploadFiles([
            {
              name: file.name,
              data: uint8Array,
              mime_type: file.type || 'application/octet-stream',
            },
          ])

          if (uploadedResources.length > 0) {
            const presignedUrl = await assetCommands.getPresignedImageUrl(uploadedResources[0].id)
            uploadedFiles.push({
              filename: uploadedResources[0].filename,
              previewUrl: presignedUrl,
              type: fileType,
              size: file.size,
            })
          } else {
            URL.revokeObjectURL(previewUrl)
          }
        } catch (error) {
          console.error(`上传文件 ${file.name} 失败:`, error)
          toast.error(`上传文件 ${file.name} 失败`)
        } finally {
          removeUploadingFile(file.name)
        }
      }

      if (uploadedFiles.length > 0) {
        toast.success(`成功上传 ${uploadedFiles.length} 个文件`)
      }

      return uploadedFiles
    },
    [addUploadingFile, removeUploadingFile]
  )

  return { uploadFiles }
}
