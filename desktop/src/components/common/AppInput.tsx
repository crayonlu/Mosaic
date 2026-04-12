import { CornerDownLeft, Loader2, Maximize2, Minimize2, Sparkles, Upload } from 'lucide-react'
import { forwardRef, useImperativeHandle, useState } from 'react'

import { InputResources } from '@/components/common/InputResources'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupText,
} from '@/components/ui/input-group'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAI } from '@/hooks/useAI'
import { useInput } from '@/hooks/useInput'
import { cn } from '@/lib/utils'
import { useInputStore } from '@/stores/inputStore'

export interface AppInputRef {
  clearTags: () => void
}

interface AppInputProps {
  placeholder?: string
  onSubmit?: (
    value: string,
    resourceFilenames?: string[],
    tags?: string[],
    aiSummary?: string,
    clearInputValue?: () => void
  ) => void
  onFileUpload?: (files: FileList) => void
  className?: string
}

export const AppInput = forwardRef<AppInputRef, AppInputProps>(
  ({ placeholder = '输入内容...', onSubmit, onFileUpload, className }, ref) => {
    const [tags, setTags] = useState<string[]>([])
    const [tagInput, setTagInput] = useState('')
    const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [aiSummary, setAISummary] = useState('')
    const [pendingSummary, setPendingSummary] = useState('')
    const [isReplaceDialogOpen, setIsReplaceDialogOpen] = useState(false)
    const { resourceFilenames, uploadingFiles } = useInputStore()
    const { suggestTags, loading: aiLoading } = useAI()

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
      onSubmit: (value, resourceFilenames, clearInput) => {
        const trimmedSummary = aiSummary.trim()
        onSubmit?.(value, resourceFilenames, tags, trimmedSummary || undefined, () => {
          clearInput?.()
          clearAISummary()
        })
      },
      onFileUpload,
    })

    const normalizedTagInput = tagInput.trim()
    const canAddTag =
      normalizedTagInput.length > 0 && !tags.includes(normalizedTagInput) && !aiLoading

    const handleAddTag = (tag?: string) => {
      const trimmedTag = tag ? tag.trim() : tagInput.trim()
      if (trimmedTag && !tags.includes(trimmedTag)) {
        setTags([...tags, trimmedTag])
        if (!tag) {
          setTagInput('')
        }
      }
    }

    const handleAddAllTags = (tagsToAdd: string[]) => {
      setTags(prevTags => {
        const newTags = [...prevTags]
        tagsToAdd.forEach(tag => {
          const trimmedTag = tag.trim()
          if (trimmedTag && !newTags.includes(trimmedTag)) {
            newTags.push(trimmedTag)
          }
        })
        return newTags
      })
    }

    const handleAISuggest = async () => {
      if (!inputValue.trim()) {
        return
      }

      const result = await suggestTags({
        content: inputValue.trim(),
        existingTags: tags,
      })

      if (result) {
        const filtered = result.tags.filter(tag => !tags.includes(tag))
        setTagSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
      }
    }

    const handleAddSuggestedTag = (tag: string) => {
      handleAddTag(tag)
      setTagSuggestions(prev => prev.filter(t => t !== tag))
      if (tagSuggestions.length <= 1) {
        setShowSuggestions(false)
      }
    }

    const handleAddAllSuggestedTags = () => {
      handleAddAllTags(tagSuggestions)
      setTagSuggestions([])
      setShowSuggestions(false)
    }

    const handleRemoveTag = (tagToRemove: string) => {
      setTags(tags.filter(tag => tag !== tagToRemove))
    }

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canAddTag) {
        e.preventDefault()
        handleAddTag()
      }
    }

    const clearTags = () => {
      setTags([])
      setTagInput('')
    }

    const clearAISummary = () => {
      setAISummary('')
      setPendingSummary('')
      setIsReplaceDialogOpen(false)
    }

    const handleConfirmReplaceSummary = () => {
      if (pendingSummary) {
        setAISummary(pendingSummary)
      }
      setPendingSummary('')
      setIsReplaceDialogOpen(false)
    }

    const handleCancelReplaceSummary = () => {
      setPendingSummary('')
      setIsReplaceDialogOpen(false)
    }

    useImperativeHandle(ref, () => ({
      clearTags,
    }))

    return (
      <>
        <div className={`${className} h-full flex flex-col relative`}>
          <InputGroup className="rounded-none relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
            <div
              className={`w-full overflow-auto flex-1 min-h-0 ${isExpanded ? 'flex flex-col' : ''}`}
            >
              <Textarea
                value={inputValue}
                onChange={e => handleInputChange(e.target.value)}
                placeholder={placeholder}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    handleSubmit()
                  }
                }}
                className={cn(
                  'border-0 rounded-none bg-transparent font-mono text-sm leading-6 focus-visible:ring-0',
                  isExpanded ? 'flex-1 min-h-80 resize-none' : 'min-h-30 resize-y'
                )}
              />

              {isExpanded && (
                <div className="px-4 py-3 border-t bg-muted/30">
                  <div className="flex">
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
                  <div className="space-y-2">
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
                        onClick={() => handleAddTag()}
                        disabled={!canAddTag}
                        className={cn(
                          'rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground transition-colors',
                          canAddTag ? 'hover:bg-primary/90' : 'cursor-not-allowed opacity-50'
                        )}
                      >
                        添加
                      </button>
                      {inputValue && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleAISuggest}
                          disabled={aiLoading || !inputValue.trim()}
                          className="gap-2"
                        >
                          {aiLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              AI建议
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {showSuggestions && tagSuggestions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 p-2 border rounded-md bg-muted/30">
                        <span className="text-xs text-muted-foreground">AI建议标签：</span>
                        {tagSuggestions.map(tag => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="cursor-pointer hover:bg-primary/10 gap-1"
                            onClick={() => handleAddSuggestedTag(tag)}
                          >
                            {tag}
                            <span className="text-muted-foreground">×</span>
                          </Badge>
                        ))}
                        {tagSuggestions.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleAddAllSuggestedTags}
                            className="h-6 text-xs"
                          >
                            全部添加
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowSuggestions(false)
                            setTagSuggestions([])
                          }}
                          className="h-6 text-xs ml-auto"
                        >
                          关闭
                        </Button>
                      </div>
                    )}
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
                  accept="image/*,video/*,.jpg,.jpeg,.png,.webp,.gif,.mp4,.mov,.webm"
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
                      (inputValue.trim() === '' && resourceFilenames.length === 0) ||
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
            <InputResources compact={!isExpanded} />
          </InputGroup>
        </div>

        <Dialog open={isReplaceDialogOpen} onOpenChange={setIsReplaceDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>替换AI摘要</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              已有摘要内容，是否使用新生成的摘要替换？
            </p>
            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancelReplaceSummary}>
                取消
              </Button>
              <Button size="sm" onClick={handleConfirmReplaceSummary}>
                替换
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }
)

AppInput.displayName = 'AppInput'
