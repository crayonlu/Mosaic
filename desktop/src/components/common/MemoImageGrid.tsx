import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { Resource } from '@/types/memo'
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronLeft, ChevronRight, Plus, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface MemoImageGridProps {
  resources: Resource[]
  imageUrls: Map<string, string>
  isEditing: boolean
  isUploading?: boolean
  onReorder?: (reordered: Resource[]) => void
  onDelete?: (resourceId: string) => void
  onUpload?: (files: FileList) => void
  onImageClick?: (index: number) => void
}

interface SortableImageProps {
  resource: Resource
  index: number
  url: string
  isEditing: boolean
  isLarge: boolean
  onDelete?: (resourceId: string) => void
  onClick?: () => void
}

const SortableImage = ({
  resource,
  url,
  isEditing,
  isLarge,
  onDelete,
  onClick,
}: SortableImageProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: resource.id,
    disabled: !isEditing,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isEditing ? { ...attributes, ...listeners } : {})}
      className={`group relative rounded-lg border bg-card overflow-hidden cursor-pointer transition-all ${
        isDragging ? 'opacity-50 z-50' : ''
      } ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''} ${
        isLarge ? 'col-span-1 row-span-1' : ''
      }`}
      onClick={onClick}
    >
      <img
        src={url}
        alt={resource.filename}
        className={`w-full h-full object-cover ${isLarge ? 'aspect-4/3' : 'aspect-square'}`}
        draggable={false}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
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
        <div className="text-[10px] text-white/80 mt-1">{formatSize(resource.size)}</div>
      </div>
    </div>
  )
}

const AddImageButton = ({
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
        accept="image/*"
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
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const getGridLayout = (count: number, withAddButton: boolean) => {
  const totalCells = withAddButton ? count + 1 : count

  if (count === 0 && withAddButton) {
    // Only add button
    return {
      containerClass: 'grid grid-cols-1 gap-3 max-w-[200px]',
      isLarge: false,
    }
  }

  if (count === 1) {
    // Single image: larger display with max-width 70%
    return {
      containerClass: withAddButton ? 'flex gap-3 items-start' : 'grid grid-cols-1 gap-3 max-w-[70%]',
      isLarge: true,
    }
  }

  if (totalCells <= 4) {
    // 2-4 images: 2x2 grid
    return {
      containerClass: 'grid grid-cols-2 gap-3',
      isLarge: false,
    }
  }

  if (totalCells <= 9) {
    // 5-9 images: 3x3 grid
    return {
      containerClass: 'grid grid-cols-3 gap-3',
      isLarge: false,
    }
  }

  // 9+ images: infinite 3-column grid
  return {
    containerClass: 'grid grid-cols-3 gap-3',
    isLarge: false,
  }
}

export function MemoImageGrid({
  resources,
  imageUrls,
  isEditing,
  isUploading,
  onReorder,
  onDelete,
  onUpload,
  onImageClick,
}: MemoImageGridProps) {
  const [reorderedResources, setReorderedResources] = useState<Resource[]>(resources)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isImageModalOpen, setIsImageModalOpen] = useState(false)

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

  const openImageModal = (index: number) => {
    setCurrentImageIndex(index)
    setIsImageModalOpen(true)
    onImageClick?.(index)
  }

  const navigateImage = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentImageIndex(prev => (prev > 0 ? prev - 1 : reorderedResources.length - 1))
    } else {
      setCurrentImageIndex(prev => (prev < reorderedResources.length - 1 ? prev + 1 : 0))
    }
  }

  const displayResources = isEditing ? reorderedResources : resources
  const { containerClass, isLarge } = getGridLayout(displayResources.length, isEditing && !!onUpload)

  if (displayResources.length === 0 && !isEditing) {
    return null
  }

  const gridContent = (
    <>
      {displayResources.map((resource, index) => {
        const url = imageUrls.get(resource.id)
        if (!url) return null

        return (
          <SortableImage
            key={resource.id}
            resource={resource}
            index={index}
            url={url}
            isEditing={isEditing}
            isLarge={isLarge}
            onDelete={onDelete}
            onClick={() => !isEditing && openImageModal(index)}
          />
        )
      })}
      {isEditing && onUpload && <AddImageButton onUpload={onUpload} isUploading={isUploading} />}
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

      {/* Full-screen image preview modal */}
      <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
        <DialogContent className="max-w-7xl w-full h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
          <div className="relative w-full h-full flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 z-50 text-white hover:bg-white/20"
              onClick={() => setIsImageModalOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>

            {displayResources.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
                  onClick={() => navigateImage('prev')}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-50 text-white hover:bg-white/20"
                  onClick={() => navigateImage('next')}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {displayResources[currentImageIndex] && (
              <img
                src={imageUrls.get(displayResources[currentImageIndex].id)}
                alt={displayResources[currentImageIndex].filename}
                className="max-w-full max-h-full object-contain"
              />
            )}

            {displayResources.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-4 py-2 rounded-full">
                {currentImageIndex + 1} / {displayResources.length}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
