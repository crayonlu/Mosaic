import { useCallback } from 'react'
import { assetCommands } from '@/utils/callRust'
import { useInputStore } from '@/stores/input-store'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'aac', 'webm']
const VIDEO_EXTENSIONS = ['mp4', 'mov']

function isValidFileType(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return (
    IMAGE_EXTENSIONS.includes(ext) ||
    AUDIO_EXTENSIONS.includes(ext) ||
    VIDEO_EXTENSIONS.includes(ext)
  )
}

function getFileType(filename: string): 'image' | 'audio' | 'video' {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'audio'
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video'
  return 'image'
}

export interface UploadedFileInfo {
  filename: string
  previewUrl: string
  type: 'image' | 'audio' | 'video'
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

          const tempFilePath = await assetCommands.saveTempFile(file.name, uint8Array)

          const uploadedResources = await assetCommands.uploadFiles([tempFilePath])

          if (uploadedResources.length > 0) {
            uploadedFiles.push({
              filename: uploadedResources[0].filename,
              previewUrl,
              type: fileType,
              size: file.size,
            })
          } else {
            URL.revokeObjectURL(previewUrl)
          }
        } catch (error) {
          console.error(`上传文件 ${file.name} 失败:`, error)
        } finally {
          removeUploadingFile(file.name)
        }
      }

      return uploadedFiles
    },
    [addUploadingFile, removeUploadingFile]
  )

  return { uploadFiles }
}
