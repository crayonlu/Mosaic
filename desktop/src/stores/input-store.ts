import { create } from 'zustand'

interface ResourcePreview {
  filename: string
  previewUrl: string
  type: 'image' | 'video'
  size?: number
  file: File
}

interface UploadingFile {
  name: string
  size: number
  type: 'image' | 'video'
}

interface InputState {
  isExpanded: boolean
  inputValue: string
  resourceFilenames: string[]
  resourcePreviews: ResourcePreview[]
  uploadingFiles: UploadingFile[]
  pendingFiles: File[]
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setInputValue: (value: string) => void
  clearInputValue: () => void
  addResource: (file: File, previewUrl: string) => void
  removeResource: (filename: string) => void
  clearResources: () => void
  addUploadingFile: (file: UploadingFile) => void
  removeUploadingFile: (name: string) => void
  clearUploadingFiles: () => void
  getPendingFiles: () => File[]
}

export const useInputStore = create<InputState>((set, get) => ({
  isExpanded: false,
  inputValue: '',
  resourceFilenames: [],
  resourcePreviews: [],
  uploadingFiles: [],
  pendingFiles: [],
  setExpanded: expanded => set({ isExpanded: expanded }),
  toggleExpanded: () => set(state => ({ isExpanded: !state.isExpanded })),
  setInputValue: value => set({ inputValue: value }),
  clearInputValue: () => {
    set(state => {
      state.resourcePreviews.forEach(preview => {
        if (preview.previewUrl && preview.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(preview.previewUrl)
        }
      })
      return { inputValue: '', resourceFilenames: [], resourcePreviews: [], pendingFiles: [] }
    })
  },
  addResource: (file, previewUrl) =>
    set(state => {
      const type = file.type.startsWith('video/') ? 'video' : 'image'
      const newPreview: ResourcePreview = {
        filename: file.name,
        previewUrl,
        type,
        size: file.size,
        file,
      }
      return {
        resourceFilenames: [...state.resourceFilenames, file.name],
        resourcePreviews: [...state.resourcePreviews, newPreview],
        pendingFiles: [...state.pendingFiles, file],
      }
    }),
  removeResource: filename =>
    set(state => {
      const preview = state.resourcePreviews.find(p => p.filename === filename)
      if (preview && preview.previewUrl && preview.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(preview.previewUrl)
      }
      return {
        resourceFilenames: state.resourceFilenames.filter(f => f !== filename),
        resourcePreviews: state.resourcePreviews.filter(p => p.filename !== filename),
        pendingFiles: state.pendingFiles.filter(f => f.name !== filename),
      }
    }),
  clearResources: () => {
    set(state => {
      state.resourcePreviews.forEach(preview => {
        if (preview.previewUrl && preview.previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(preview.previewUrl)
        }
      })
      return { resourceFilenames: [], resourcePreviews: [], pendingFiles: [] }
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
  getPendingFiles: () => get().pendingFiles,
}))
