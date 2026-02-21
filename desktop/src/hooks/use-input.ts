import { useCallback, useRef } from 'react'
import { useInputStore } from '@/stores/input-store'
import { extractTextFromHtml } from '@mosaic/utils'

interface UseInputOptions {
  onSubmit?: (value: string, resourceFilenames?: string[], clearInput?: () => void) => void
  onFileUpload?: (files: FileList) => void
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
    const textContent = extractTextFromHtml(inputValue)
    if (textContent || resourceFilenames.length > 0) {
      options?.onSubmit?.(inputValue || '', resourceFilenames, clearInputValue)
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
    handleToggleExpand,
  }
}
