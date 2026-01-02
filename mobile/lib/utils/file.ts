export const fileUtils = {
  getExtension: (filename: string): string => {
    return filename.split('.').pop()?.toLowerCase() || ''
  },
  getType: (filename: string): 'image' | 'video' | 'audio' | 'file' => {
    const ext = fileUtils.getExtension(filename)
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic']
    const videoExts = ['mp4', 'mov', 'avi', 'webm']
    const audioExts = ['mp3', 'wav', 'm4a', 'aac']
    if (imageExts.includes(ext)) return 'image'
    if (videoExts.includes(ext)) return 'video'
    if (audioExts.includes(ext)) return 'audio'
    return 'file'
  },
  formatSize: (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
  },
  isValidFile: (filename: string, maxSize: number): boolean => {
    return filename.length > 0
  },
}
