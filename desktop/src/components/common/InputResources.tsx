import { ResourcePreview } from '@/components/common/ResourcePreview'
import { useInputStore } from '@/stores/inputStore'

export function InputResources() {
  const { resourcePreviews, uploadingFiles, removeResource } = useInputStore()

  if (resourcePreviews.length === 0 && uploadingFiles.length === 0) {
    return null
  }

  return (
    <div className="px-3 py-2 border-t bg-muted/30 w-full">
      {resourcePreviews.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {resourcePreviews.map(preview => (
            <div key={preview.filename} className="shrink-0">
              <ResourcePreview
                filename={preview.filename}
                previewUrl={preview.previewUrl}
                type={preview.type}
                size={preview.size}
                onRemove={() => removeResource(preview.filename)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
