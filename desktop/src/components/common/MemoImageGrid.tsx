import { AuthImage } from '@/components/common/AuthImage'
import { AuthVideo } from '@/components/common/AuthVideo'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { Resource } from '@mosaic/api'
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, Plus, Trash2, Upload, Video, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MemoImageGridProps {
  resources: Resource[]
  imageUrls: Map<string, string>
  videoUrls?: Map<string, string>
  isEditing: boolean
  isUploading?: boolean
  onReorder?: (reordered: Resource[]) => void
  onDelete?: (resourceId: string) => void
  onUpload?: (files: FileList) => void
  onImageClick?: (index: number) => void
}

interface SortableMediaProps {
  resource: Resource
  index: number
  imageUrl?: string
  videoUrl?: string
  isEditing: boolean
  isLarge: boolean
  onDelete?: (resourceId: string) => void
  onClick?: () => void
}

type ResourceWithOptionalSize = Resource & {
  size?: number
}

const SortableMedia = ({
  resource,
  imageUrl,
  videoUrl,
  isEditing,
  isLarge,
  onDelete,
  onClick,
}: SortableMediaProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: resource.id,
    disabled: !isEditing,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isVideo = resource.resourceType === 'video'

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isEditing ? { ...attributes, ...listeners } : {})}
      className={`group relative border bg-card overflow-hidden cursor-pointer transition-all ${
        isDragging ? 'opacity-50 z-50' : ''
      } ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isLarge ? 'col-span-1 row-span-1' : ''
      }`}
      onClick={onClick}
    >
      {isVideo && videoUrl ? (
        <AuthVideo
          src={videoUrl}
          className={`w-full h-full object-cover ${isLarge ? 'aspect-4/3' : 'aspect-square'}`}
          muted
          playsInline
        />
      ) : imageUrl ? (
        <AuthImage
          src={imageUrl}
          alt={resource.filename}
          className={`w-full h-full object-cover ${isLarge ? 'aspect-4/3' : 'aspect-square'}`}
          draggable={false}
        />
      ) : null}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      {isVideo && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Video className="h-8 w-8 text-white drop-shadow-lg" />
        </div>
      )}
      {isEditing && onDelete && (
        <Button
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity z-10"
          onClick={e => {
            e.stopPropagation()
            onDelete(resource.id)
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="text-xs text-white truncate">{resource.filename}</div>
        <div className="text-[10px] text-white/80 mt-1">
          {formatSize(getResourceSize(resource))}
        </div>
      </div>
    </div>
  )
}

const AddMediaButton = ({
  onUpload,
  isUploading,
}: {
  onUpload?: (files: FileList) => void
  isUploading?: boolean
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <>
      <div
        className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/10 hover:border-muted-foreground/50 hover:bg-muted/20 transition-colors cursor-pointer flex items-center justify-center aspect-square"
        onClick={handleClick}
      >
        {isUploading ? (
          <Upload className="h-8 w-8 text-muted-foreground animate-pulse" />
        ) : (
          <Plus className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={e => {
          if (e.target.files && onUpload) {
            onUpload(e.target.files)
            e.target.value = ''
          }
        }}
        className="hidden"
      />
    </>
  )
}

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return '--'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getResourceSize = (resource: Resource): number => {
  const withOptionalSize = resource as ResourceWithOptionalSize
  return withOptionalSize.fileSize ?? withOptionalSize.size ?? 0
}

const getGridLayout = (count: number, withAddButton: boolean) => {
  const totalCells = withAddButton ? count + 1 : count

  if (count === 0 && withAddButton) {
    return {
      containerClass: 'grid grid-cols-1 max-w-[200px]',
      isLarge: false,
    }
  }

  if (count === 1) {
    return {
      containerClass: withAddButton ? 'flex items-start' : 'grid grid-cols-1 max-w-[70%]',
      isLarge: true,
    }
  }

  if (totalCells <= 4) {
    return {
      containerClass: 'grid grid-cols-2',
      isLarge: false,
    }
  }

  if (totalCells <= 9) {
    return {
      containerClass: 'grid grid-cols-3',
      isLarge: false,
    }
  }

  return {
    containerClass: 'grid grid-cols-3',
    isLarge: false,
  }
}

interface MediaPreviewDialogProps {
  open: boolean
  onClose: () => void
  resources: Resource[]
  imageUrls: Map<string, string>
  videoUrls?: Map<string, string>
  initialIndex: number
}

function MediaPreviewDialog({
  open,
  onClose,
  resources,
  imageUrls,
  videoUrls,
  initialIndex,
}: MediaPreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  useEffect(() => {
    setCurrentIndex(initialIndex)
  }, [initialIndex])

  const currentResource = resources[currentIndex]
  const isVideo = currentResource?.resourceType === 'video'
  const imageUrl = !isVideo ? imageUrls.get(currentResource?.id || '') : undefined
  const videoUrl = isVideo ? videoUrls?.get(currentResource?.id || '') : undefined

  const goToPrev = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : resources.length - 1))
  }

  const goToNext = () => {
    setCurrentIndex(prev => (prev < resources.length - 1 ? prev + 1 : 0))
  }

  return (
    <Dialog open={open} onOpenChange={open => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-4xl w-auto p-0 overflow-hidden bg-black/95 border-none"
      >
        <div className="relative flex items-center justify-center">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </Button>

          {resources.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
                onClick={goToPrev}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
                onClick={goToNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {currentResource && (
            <>
              {isVideo && videoUrl ? (
                <AuthVideo
                  src={videoUrl}
                  className="max-w-full max-h-[80vh] object-contain"
                  controls
                  playsInline
                />
              ) : imageUrl ? (
                <AuthImage
                  src={imageUrl}
                  alt={currentResource.filename}
                  className="max-w-full max-h-[80vh] object-contain"
                />
              ) : null}
            </>
          )}

          {resources.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
              {currentIndex + 1} / {resources.length}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function MemoImageGrid({
  resources,
  imageUrls,
  videoUrls,
  isEditing,
  isUploading,
  onReorder,
  onDelete,
  onUpload,
  onImageClick,
}: MemoImageGridProps) {
  const [reorderedResources, setReorderedResources] = useState<Resource[]>(resources)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)

  useEffect(() => {
    setReorderedResources(resources)
  }, [resources])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = reorderedResources.findIndex(r => r.id === active.id)
    const newIndex = reorderedResources.findIndex(r => r.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(reorderedResources, oldIndex, newIndex)
      setReorderedResources(reordered)
      onReorder?.(reordered)
    }
  }

  const openPreview = (index: number) => {
    setPreviewIndex(index)
    setPreviewOpen(true)
    onImageClick?.(index)
  }

  const displayResources = isEditing ? reorderedResources : resources
  const { containerClass, isLarge } = getGridLayout(
    displayResources.length,
    isEditing && !!onUpload
  )

  if (displayResources.length === 0 && !isEditing) {
    return null
  }

  const gridContent = (
    <>
      {displayResources.map((resource, index) => {
        const isVideo = resource.resourceType === 'video'
        const videoUrl = isVideo ? videoUrls?.get(resource.id) : undefined
        const imageUrl = !isVideo ? imageUrls.get(resource.id) : undefined

        if ((isVideo && !videoUrl) || (!isVideo && !imageUrl)) return null

        return (
          <SortableMedia
            key={resource.id}
            resource={resource}
            index={index}
            imageUrl={imageUrl}
            videoUrl={videoUrl}
            isEditing={isEditing}
            isLarge={isLarge}
            onDelete={onDelete}
            onClick={() => !isEditing && openPreview(index)}
          />
        )
      })}
      {isEditing && onUpload && <AddMediaButton onUpload={onUpload} isUploading={isUploading} />}
    </>
  )

  return (
    <>
      <div className={containerClass}>
        {isEditing && onReorder ? (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={reorderedResources.map(r => r.id)}
              strategy={rectSortingStrategy}
            >
              {gridContent}
            </SortableContext>
          </DndContext>
        ) : (
          gridContent
        )}
      </div>

      <MediaPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        resources={displayResources}
        imageUrls={imageUrls}
        videoUrls={videoUrls}
        initialIndex={previewIndex}
      />
    </>
  )
}
