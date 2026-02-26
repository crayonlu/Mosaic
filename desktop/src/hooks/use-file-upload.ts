import { toast } from '@/hooks/use-toast'
import type { ResourceResponse } from '@mosaic/api'
import { apiClient } from '@mosaic/api'

export async function uploadFiles(files: File[], memoId?: string): Promise<ResourceResponse[]> {
  if (files.length === 0) return []

  const accessToken = await apiClient.getTokenStorage()?.getAccessToken()
  const baseUrl = apiClient.getBaseUrl()
  const resources: ResourceResponse[] = []

  for (const file of files) {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('memoId', memoId || '')

      const response = await fetch(`${baseUrl}/api/resources/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`上传失败: ${errorText}`)
      }

      const resource: ResourceResponse = await response.json()
      resources.push(resource)
    } catch (error) {
      console.error(`上传文件 ${file.name} 失败:`, error)
      toast.error(`上传文件 ${file.name} 失败`)
    }
  }

  return resources
}

export async function uploadFilesAndGetResourceIds(
  files: File[],
  memoId?: string
): Promise<string[]> {
  const resources = await uploadFiles(files, memoId)
  return resources.map(resource => resource.id)
}

export function createObjectUrl(file: File): string {
  return URL.createObjectURL(file)
}
