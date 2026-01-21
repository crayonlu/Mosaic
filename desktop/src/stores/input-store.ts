import { create } from 'zustand'

interface ResourcePreview {
  filename: string
  previewUrl: string
  type: 'image'
  size?: number
}

interface UploadingFile {
  name: string
  size: number
  type: 'image'
}

interface InputState {
  isExpanded: boolean
  inputValue: string
  resourceFilenames: string[]
  resourcePreviews: ResourcePreview[]
  uploadingFiles: UploadingFile[]
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setInputValue: (value: string) => void
  clearInputValue: () => void
  addResource: (
    filename: string,
    previewUrl?: string,
    type?: 'image',
    size?: number
  ) => void
  removeResource: (filename: string) => void
  clearResources: () => void
  addUploadingFile: (file: UploadingFile) => void
  removeUploadingFile: (name: string) => void
  clearUploadingFiles: () => void
}

export const useInputStore = create<InputState>(set => ({
  isExpanded: false,
  inputValue: '',
  resourceFilenames: [],
  resourcePreviews: [],
  uploadingFiles: [],
  setExpanded: expanded => set({ isExpanded: expanded }),
  toggleExpanded: () => set(state => ({ isExpanded: !state.isExpanded })),
  setInputValue: value => set({ inputValue: value }),
  clearInputValue: () => {
    set(state => {
      state.resourcePreviews.forEach(preview => {
        URL.revokeObjectURL(preview.previewUrl)
      })
      return { inputValue: '', resourceFilenames: [], resourcePreviews: [] }
    })
  },
  addResource: (filename, previewUrl, type, size) =>
    set(state => {
      const newPreview: ResourcePreview = {
        filename,
        previewUrl: previewUrl || '',
        type: type || 'image',
        size,
      }
      return {
        resourceFilenames: [...state.resourceFilenames, filename],
        resourcePreviews: [...state.resourcePreviews, newPreview],
      }
    }),
  removeResource: filename =>
    set(state => {
      const preview = state.resourcePreviews.find(p => p.filename === filename)
      if (preview && preview.previewUrl) {
        URL.revokeObjectURL(preview.previewUrl)
      }
      return {
        resourceFilenames: state.resourceFilenames.filter(f => f !== filename),
        resourcePreviews: state.resourcePreviews.filter(p => p.filename !== filename),
      }
    }),
  clearResources: () => {
    set(state => {
      state.resourcePreviews.forEach(preview => {
        URL.revokeObjectURL(preview.previewUrl)
      })
      return { resourceFilenames: [], resourcePreviews: [] }
    })
  },
  addUploadingFile: file =>
    set(state => ({
      uploadingFiles: [...state.uploadingFiles, file],
    })),
  removeUploadingFile: name =>
    set(state => ({
      uploadingFiles: state.uploadingFiles.filter(f => f.name !== name),
    })),
  clearUploadingFiles: () => set({ uploadingFiles: [] }),
}))
