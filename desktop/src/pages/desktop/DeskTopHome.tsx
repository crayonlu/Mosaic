import { AppInput, type AppInputRef } from '@/components/common/AppInput'
import { MemoDetail } from '@/components/common/MemoDetail'
import { MemoList, type MemoListRef } from '@/components/common/MemoList'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { uploadFilesAndGetResourceIds, createObjectUrl } from '@/hooks/use-file-upload'
import { useTime } from '@/hooks/use-time'
import { toast } from '@/hooks/use-toast'
import { useInputStore } from '@/stores/input-store'
import { useHeatmapInvalidate } from '@/stores/stats-store'
import type { MemoWithResources } from '@mosaic/api'
import { useCreateMemo } from '@mosaic/api'
import { useRef, useState } from 'react'

export default function DeskTopHome() {
  const isInputExpanded = useInputStore(state => state.isExpanded)
  const { formattedDate } = useTime()
  const { addResource, clearInputValue, clearResources, getPendingFiles } = useInputStore()
  const [selectedMemo, setSelectedMemo] = useState<MemoWithResources | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const memoListRef = useRef<MemoListRef>(null)
  const appInputRef = useRef<AppInputRef>(null)
  const invalidateHeatmap = useHeatmapInvalidate()
  const createMemo = useCreateMemo()

  const handleSubmit = async (value: string, _resourceFilenames?: string[], tags?: string[]) => {
    try {
      const pendingFiles = getPendingFiles()
      let resourceIds: string[] = []

      if (pendingFiles.length > 0) {
        resourceIds = await uploadFilesAndGetResourceIds(pendingFiles)
      }

      await createMemo.mutateAsync({
        content: value,
        tags: tags || [],
        resourceIds,
      })

      clearInputValue()
      clearResources()
      appInputRef.current?.clearTags()
      await memoListRef.current?.refetch()
      invalidateHeatmap()
      toast.success('Memo创建成功')
    } catch (error) {
      console.error('创建memo失败:', error)
      toast.error('Memo创建失败')
    }
  }

  const handleFileUpload = (files: FileList) => {
    Array.from(files).forEach(file => {
      const previewUrl = createObjectUrl(file)
      addResource(file, previewUrl)
    })
  }

  const handleMemoClick = (memo: MemoWithResources) => {
    setSelectedMemo(memo)
    setIsDetailOpen(true)
  }

  const handleDetailClose = () => {
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  const handleMemoUpdate = async () => {
    await memoListRef.current?.refetch()
    // React Query will automatically update the cache
  }

  const handleMemoDelete = async () => {
    await memoListRef.current?.refetch()
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  return (
    <DeskTopLayout className="relative">
      <div className="h-[calc(100dvh-20rem)] overflow-hidden flex flex-col">
        <div className="w-full pb-4 transition-all duration-500 ease-in-out memo-scrollbar overflow-y-auto flex-1 min-h-0">
          <MemoList ref={memoListRef} date={formattedDate} onMemoClick={handleMemoClick} />
        </div>
      </div>
      <div
        className={`w-full absolute left-0 right-0 bottom-0 transition-all duration-500 ease-in-out ${
          isInputExpanded ? 'h-full' : 'h-64'
        }`}
      >
        <AppInput
          ref={appInputRef}
          placeholder="输入内容..."
          onSubmit={handleSubmit}
          onFileUpload={handleFileUpload}
          className="h-full"
        />
      </div>
      <MemoDetail
        memo={selectedMemo}
        open={isDetailOpen}
        onClose={handleDetailClose}
        onUpdate={handleMemoUpdate}
        onDelete={handleMemoDelete}
      />
    </DeskTopLayout>
  )
}
