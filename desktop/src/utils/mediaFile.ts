import type { BinaryUploadFile, ResourceMetadata } from '@mosaic/api'

function loadImageMetadata(url: string): Promise<ResourceMetadata> {
  return new Promise((resolve, reject) => {
    const image = new window.Image()
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
    }
    image.onerror = () => reject(new Error('Failed to load image metadata'))
    image.src = url
  })
}

function loadVideoMetadata(url: string): Promise<ResourceMetadata> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration)
        ? Math.round(video.duration * 1000)
        : undefined
      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        durationMs,
        thumbnailTimeMs: durationMs ? Math.min(durationMs / 2, 1000) : undefined,
      })
      cleanup()
    }

    video.onerror = () => {
      cleanup()
      reject(new Error('Failed to load video metadata'))
    }

    video.src = url
  })
}

export async function extractBrowserMediaMetadata(
  file: File
): Promise<ResourceMetadata | undefined> {
  const objectUrl = URL.createObjectURL(file)

  try {
    if (file.type.startsWith('image/')) {
      return await loadImageMetadata(objectUrl)
    }

    if (file.type.startsWith('video/')) {
      return await loadVideoMetadata(objectUrl)
    }

    return undefined
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export function toBrowserUploadFile(file: File): BinaryUploadFile {
  return {
    data: file,
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
  }
}
