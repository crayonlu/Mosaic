import { useCallback, useRef } from 'react'
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

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value)
    },
    [setInputValue]
  )

  const handleSubmit = useCallback(() => {
    const textContent = inputValue ? inputValue.replace(/<[^>]*>/g, '').trim() : ''
    if (textContent || resourceFilenames.length > 0) {
      options?.onSubmit?.(inputValue || '', resourceFilenames)
      clearInputValue()
    }
  }, [inputValue, resourceFilenames, options, clearInputValue])

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

  return {
    isExpanded,
    inputValue,
    fileInputRef,
    handleInputChange,
    handleSubmit,
    handleFileUpload,
    triggerFileSelect,
    handleVoiceInput,
    handleToggleExpand,
  }
}
