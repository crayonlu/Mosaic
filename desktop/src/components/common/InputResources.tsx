import { ResourcePreview } from '@/components/common/ResourcePreview'
import { useInputStore } from '@/stores/inputStore'
import { Loader2 } from 'lucide-react'

interface InputResourcesProps {
  compact?: boolean
}

export function InputResources({ compact = false }: InputResourcesProps) {
  const { resourcePreviews, uploadingFiles, removeResource } = useInputStore()

  if (resourcePreviews.length === 0 && uploadingFiles.length === 0) {
    return null
  }

  return (
    <div className={`w-full border-t bg-muted/30 ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}`}>
      {uploadingFiles.length > 0 && resourcePreviews.length === 0 && (
        <div className="flex items-center gap-2 px-1 py-0.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>正在处理 {uploadingFiles.length} 个文件...</span>
        </div>
      )}

      {resourcePreviews.length > 0 && (
        <div className={`flex overflow-x-auto ${compact ? 'gap-1.5' : 'gap-2'}`}>
          {resourcePreviews.map(preview => (
            <div key={preview.filename} className="shrink-0">
              <ResourcePreview
                filename={preview.filename}
                previewUrl={preview.previewUrl}
                type={preview.type}
                size={preview.size}
                compact={compact}
                onRemove={() => removeResource(preview.filename)}
              />
            </div>
          ))}
        </div>
      )}

      {uploadingFiles.length > 0 && resourcePreviews.length > 0 && (
        <div className="mt-1 flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>正在上传 {uploadingFiles.length} 个文件</span>
        </div>
      )}
    </div>
  )
}
