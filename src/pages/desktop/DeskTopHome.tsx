import { useState, useRef } from 'react'
import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { AppInput } from '@/components/common/AppInput'
import { MemoList, type MemoListRef } from '@/components/common/MemoList'
import { MemoDetail } from '@/components/common/MemoDetail'
import { useInputStore } from '@/stores/input-store'
import { useTime } from '@/hooks/use-time'
import { memoCommands } from '@/utils/callRust'
import { useFileUpload } from '@/hooks/use-file-upload'
import type { MemoWithResources } from '@/types/memo'

export default function DeskTopHome() {
  const isInputExpanded = useInputStore((state) => state.isExpanded)
  const { formattedDate } = useTime()
  const { uploadFiles } = useFileUpload()
  const { addResource, clearInputValue, clearResources } = useInputStore()
  const [selectedMemo, setSelectedMemo] = useState<MemoWithResources | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const memoListRef = useRef<MemoListRef>(null)

  const handleSubmit = async (value: string, resourceFilenames?: string[]) => {
    try {
      await memoCommands.createMemo({
        content: value,
        resourceFilenames: resourceFilenames || [],
      })
      clearInputValue()
      clearResources()
      await memoListRef.current?.refetch()
    } catch (error) {
      console.error('创建memo失败:', error)
    }
  }

  const handleFileUpload = async (files: FileList) => {
    try {
      const uploadedFiles = await uploadFiles(files)
      uploadedFiles.forEach((fileInfo) => {
        addResource(fileInfo.filename, fileInfo.previewUrl, fileInfo.type, fileInfo.size)
      })
    } catch (error) {
      console.error('文件上传失败:', error)
    }
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
    if (selectedMemo) {
      const updatedMemo = await memoCommands.getMemo(selectedMemo.id)
      setSelectedMemo(updatedMemo)
    }
  }

  const handleMemoDelete = async () => {
    await memoListRef.current?.refetch()
    setIsDetailOpen(false)
    setTimeout(() => setSelectedMemo(null), 300)
  }

  return (
    <DeskTopLayout>
      <div className="h-[calc(100dvh-5rem)] overflow-hidden flex flex-col">
        <div
          className={`w-full pb-4 transition-all duration-500 ease-in-out memo-scrollbar overflow-y-auto ${
            isInputExpanded
              ? 'opacity-0 pointer-events-none max-h-0 overflow-hidden'
              : 'opacity-100 flex-1'
          }`}
        >
          <MemoList ref={memoListRef} date={formattedDate} onMemoClick={handleMemoClick} />
        </div>
        <div
          className={`w-full transition-all duration-500 ease-in-out relative ${
            isInputExpanded 
              ? 'flex-1 min-h-0' 
              : 'shrink-0'
          }`}
        >
          <AppInput
            placeholder="输入内容..."
            onSubmit={handleSubmit}
            onFileUpload={handleFileUpload}
            className="h-full max-h-[calc(100dvh-5rem)]"
          />
        </div>
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
