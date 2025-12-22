import { useCallback, useRef, useEffect } from 'react'
import { useInputStore } from '@/stores/input-store'

interface UseInputOptions {
  onSubmit?: (value: string, resourceFilenames?: string[]) => void
  onFileUpload?: (files: FileList) => void
  onVoiceInput?: () => void
}

export function useInput(options?: UseInputOptions) {
  const {
    isExpanded,
    inputValue,
    resourceFilenames,
    toggleExpanded,
    setInputValue,
    clearInputValue,
  } = useInputStore()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value)
    },
    [setInputValue]
  )

  const handleSubmit = useCallback(() => {
    if (inputValue.trim() || resourceFilenames.length > 0) {
      options?.onSubmit?.(inputValue, resourceFilenames)
      clearInputValue()
    }
  }, [inputValue, resourceFilenames, options, clearInputValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        options?.onFileUpload?.(e.target.files)
        e.target.value = ''
      }
    },
    [options]
  )

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleVoiceInput = useCallback(() => {
    options?.onVoiceInput?.()
  }, [options])

  const handleToggleExpand = useCallback(() => {
    toggleExpanded()
  }, [toggleExpanded])

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [isExpanded])

  return {

    isExpanded,
    inputValue,

    fileInputRef,
    textareaRef,

    handleInputChange,
    handleSubmit,
    handleKeyDown,
    handleFileUpload,
    triggerFileSelect,
    handleVoiceInput,
    handleToggleExpand,
  }
}

