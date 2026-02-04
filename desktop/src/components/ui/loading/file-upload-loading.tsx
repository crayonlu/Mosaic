import { cn } from '@/lib/utils'
import { FileImage, FileVideo } from 'lucide-react'
import { LoadingSpinner } from './loading-spinner'
import { Progress } from './progress'

interface FileUploadItem {
  name: string
  type: 'image' | 'video'
  size?: number
  progress?: number
}

interface FileUploadLoadingProps {
  files: FileUploadItem[]
  className?: string
}

export function FileUploadLoading({ files, className }: FileUploadLoadingProps) {
  if (files.length === 0) return null

  const getFileIcon = (type: 'image' | 'video') => {
    const icons = {
      image: <FileImage className="h-5 w-5" />,
      video: <FileVideo className="h-5 w-5" />,
    }
    return icons[type] || <FileImage className="h-5 w-5" />
  }

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn('flex gap-2 overflow-x-auto p-2', className)}>
      {files.map((file, index) => (
        <div
          key={`${file.name}-${index}`}
          className="flex items-center gap-2 rounded-lg border bg-card p-2 min-w-0 shrink-0"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded bg-muted">
            <LoadingSpinner size="sm" className="text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-muted-foreground">{getFileIcon(file.type)}</div>
              <span className="text-sm font-medium truncate">{file.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">{formatSize(file.size)} · 上传中...</div>
            {file.progress !== undefined && <Progress value={file.progress} className="h-1 mt-1" />}
          </div>
        </div>
      ))}
    </div>
  )
}
