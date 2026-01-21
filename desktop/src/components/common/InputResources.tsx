import { ResourcePreview } from '@/components/common/ResourcePreview'
import { FileUploadLoading } from '@/components/ui/loading/file-upload-loading'
import { useInputStore } from '@/stores/input-store'

export function InputResources() {
  const { resourcePreviews, uploadingFiles, removeResource } = useInputStore()

  if (resourcePreviews.length === 0 && uploadingFiles.length === 0) {
    return null
  }

  const images = resourcePreviews.filter(p => p.type === 'image')

  return (
    <div className="px-3 py-2 border-t bg-muted/30 w-full">
      <FileUploadLoading files={uploadingFiles} />

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map(preview => (
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
