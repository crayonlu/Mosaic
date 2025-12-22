import DeskTopLayout from '@/components/layout/DeskTopLayout'
import { AppInput } from '@/components/common/AppInput'
import { MemoList } from '@/components/common/MemoList'
import { useInputStore } from '@/stores/input-store'
import { useTime } from '@/hooks/use-time'
import { memoCommands } from '@/utils/callRust'
import { useFileUpload } from '@/hooks/use-file-upload'

export default function DeskTopHome() {
  const isInputExpanded = useInputStore((state) => state.isExpanded)
  const { formattedDate } = useTime()
  const { uploadFiles } = useFileUpload()
  const { addResource } = useInputStore()

  const handleSubmit = async (value: string, resourceFilenames?: string[]) => {
    try {
      const memoId = await memoCommands.createMemo({
        content: value,
        resourceFilenames: resourceFilenames || [],
      })
      console.log('Memo created:', memoId)
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

  return (
    <DeskTopLayout>
      <div className="h-full flex flex-col justify-end">
        <div
          className={`w-full px-4 pb-4 transition-all duration-300 ease-in-out ${
            isInputExpanded
              ? 'opacity-0 pointer-events-none max-h-0 overflow-hidden'
              : 'opacity-100 max-h-[60vh] overflow-y-auto'
          }`}
        >
          <MemoList date={formattedDate} />
        </div>
        <div
          className={`w-full transition-all duration-300 ease-in-out ${
            isInputExpanded ? 'flex-1' : 'shrink-0'
          }`}
        >
          <AppInput
            placeholder="输入内容..."
            onSubmit={handleSubmit}
            onFileUpload={handleFileUpload}
            className="h-full"
          />
        </div>
      </div>
    </DeskTopLayout>
  )
}
