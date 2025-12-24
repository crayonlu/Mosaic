import { useState, forwardRef, useImperativeHandle } from 'react'
import { Upload, Mic, Maximize2, Minimize2, CornerDownLeft, Loader2 } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from '@/components/ui/input-group'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useInput } from '@/hooks/use-input'
import { VoiceRecordingDialog } from '@/components/common/VoiceRecordingDialog'
import { InputResources } from '@/components/common/InputResources'
import { RichTextEditor } from '@/components/common/RichTextEditor'
import { useInputStore } from '@/stores/input-store'
import { useVoiceRecorder } from '@/hooks/use-voice-recorder'
import { cn } from '@/lib/utils'

export interface AppInputRef {
  clearTags: () => void
}

interface AppInputProps {
  placeholder?: string
  onSubmit?: (value: string, resourceFilenames?: string[], tags?: string[]) => void
  onFileUpload?: (files: FileList) => void
  onVoiceInput?: () => void
  className?: string
}

export const AppInput = forwardRef<AppInputRef, AppInputProps>(
  ({ placeholder = '输入内容...', onSubmit, onFileUpload, onVoiceInput, className }, ref) => {
    const [isRecordingDialogOpen, setIsRecordingDialogOpen] = useState(false)
    const [tags, setTags] = useState<string[]>([])
    const [tagInput, setTagInput] = useState('')
    const {
      voiceRecordingState,
      resetVoiceRecording,
      addResource,
      resourceFilenames,
      uploadingFiles,
    } = useInputStore()
    const { startRecording, stopRecording, cancelRecording, isProcessing } = useVoiceRecorder()

    const {
      isExpanded,
      inputValue,
      fileInputRef,
      handleInputChange,
      handleSubmit,
      handleFileUpload,
      triggerFileSelect,
      handleToggleExpand,
    } = useInput({
      onSubmit: (value, resourceFilenames) => onSubmit?.(value, resourceFilenames, tags),
      onFileUpload,
      onVoiceInput,
    })

    const handleAddTag = () => {
      const trimmedTag = tagInput.trim()
      if (trimmedTag && !tags.includes(trimmedTag)) {
        setTags([...tags, trimmedTag])
        setTagInput('')
      }
    }

    const handleRemoveTag = (tagToRemove: string) => {
      setTags(tags.filter(tag => tag !== tagToRemove))
    }

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleAddTag()
      }
    }

    const clearTags = () => {
      setTags([])
      setTagInput('')
    }

    useImperativeHandle(ref, () => ({
      clearTags,
    }))

    const handleStartRecording = async () => {
      try {
        setIsRecordingDialogOpen(true)
        await startRecording()
        onVoiceInput?.()
      } catch (error) {
        console.error('启动录音失败:', error)
        setIsRecordingDialogOpen(false)
      }
    }

    const handleStopRecording = async () => {
      const result = await stopRecording()
      setIsRecordingDialogOpen(false)
      if (result) {
        addResource(result.filename, result.previewUrl, 'audio')
      }
      resetVoiceRecording()
    }

    const handleCancelRecording = () => {
      cancelRecording()
      setIsRecordingDialogOpen(false)
      resetVoiceRecording()
    }

    return (
      <div className={`${className} h-full flex flex-col relative`}>
        <InputGroup className="rounded-none flex-1 flex flex-col justify-between h-full min-h-0 relative overflow-hidden">
          <div
            className={`w-full overflow-auto flex-1 min-h-0 ${isExpanded ? 'flex flex-col' : ''}`}
          >
            <RichTextEditor
              content={inputValue}
              onChange={handleInputChange}
              placeholder={placeholder}
              editable={true}
              onSave={handleSubmit}
              isExpanded={isExpanded}
              className={cn(isExpanded ? 'flex-1' : '', 'border-0')}
            />

            {isExpanded && (
              <div className="px-4 py-3 border-t bg-muted/30">
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-destructive"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder="添加标签..."
                    className="flex-1 px-3 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>
          <InputGroupAddon align="block-end" className="border-t shrink-0 bg-background">
            <div className="flex items-center gap-2 w-full">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                accept="image/*,video/*,audio/*,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.mp3,.wav,.m4a,.aac,.webm"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    onClick={triggerFileSelect}
                    disabled={uploadingFiles.length > 0}
                    className={cn(uploadingFiles.length > 0 && 'opacity-50 cursor-not-allowed')}
                  >
                    {uploadingFiles.length > 0 ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload />
                    )}
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>
                  {uploadingFiles.length > 0
                    ? `正在上传 ${uploadingFiles.length} 个文件...`
                    : '上传文件'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    size="icon-xs"
                    variant="ghost"
                    onClick={handleStartRecording}
                    className={cn(
                      voiceRecordingState === 'recording' &&
                        'bg-destructive/10 text-destructive hover:bg-destructive/20'
                    )}
                  >
                    <Mic className={cn(voiceRecordingState === 'recording' && 'animate-pulse')} />
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>
                  {voiceRecordingState === 'recording' ? '正在录音...' : '语音输入'}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton size="icon-xs" variant="ghost" onClick={handleToggleExpand}>
                    {isExpanded ? <Minimize2 /> : <Maximize2 />}
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent>{isExpanded ? '收起' : '展开'}</TooltipContent>
              </Tooltip>
              <div className="ml-auto flex items-center gap-2">
                <InputGroupText className="text-xs text-muted-foreground">
                  Ctrl/Cmd + Enter 创建
                </InputGroupText>
                <InputGroupButton
                  size="sm"
                  variant="default"
                  onClick={handleSubmit}
                  disabled={
                    !inputValue ||
                    (inputValue.replace(/<[^>]*>/g, '').trim() === '' &&
                      resourceFilenames.length === 0) ||
                    uploadingFiles.length > 0
                  }
                  className="gap-2"
                >
                  {uploadingFiles.length > 0 ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      上传中...
                    </>
                  ) : (
                    <>
                      创建
                      <CornerDownLeft />
                    </>
                  )}
                </InputGroupButton>
              </div>
            </div>
          </InputGroupAddon>
          <InputResources />
        </InputGroup>
        <VoiceRecordingDialog
          open={isRecordingDialogOpen}
          onOpenChange={setIsRecordingDialogOpen}
          onStop={handleStopRecording}
          onCancel={handleCancelRecording}
          isProcessing={isProcessing}
        />
      </div>
    )
  }
)

AppInput.displayName = 'AppInput'
