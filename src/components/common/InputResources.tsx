import { useInputStore } from '@/stores/input-store'
import { ResourcePreview } from '@/components/common/ResourcePreview'
import { FileUploadLoading } from '@/components/ui/loading/file-upload-loading'

export function InputResources() {
  const { resourcePreviews, uploadingFiles, removeResource } = useInputStore()

  if (resourcePreviews.length === 0 && uploadingFiles.length === 0) {
    return null
  }

  const images = resourcePreviews.filter(p => p.type === 'image')
  const videos = resourcePreviews.filter(p => p.type === 'video')
  const audios = resourcePreviews.filter(p => p.type === 'audio')

  return (
    <div className="px-3 py-2 border-t bg-muted/30 w-full">
      <FileUploadLoading files={uploadingFiles} />

      {images.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map(preview => (
            <div key={preview.filename} className="flex-shrink-0">
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

      {videos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {videos.map(preview => (
            <div key={preview.filename} className="flex-shrink-0">
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

      {audios.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {audios.map(preview => (
            <div key={preview.filename} className="flex-shrink-0">
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
