import { create } from 'zustand'

interface InputState {
  content: string
  tags: string[]
  isEditing: boolean
  currentMemoId: string | null
  setContent: (content: string) => void
  setTags: (tags: string[]) => void
  setIsEditing: (isEditing: boolean) => void
  setCurrentMemoId: (id: string | null) => void
  clearInput: () => void
}

export const useInputStore = create<InputState>(set => ({
  content: '',
  tags: [],
  isEditing: false,
  currentMemoId: null,
  setContent: content => set({ content }),
  setTags: tags => set({ tags }),
  setIsEditing: isEditing => set({ isEditing }),
  setCurrentMemoId: id => set({ currentMemoId: id }),
  clearInput: () => set({ content: '', tags: [], isEditing: false, currentMemoId: null }),
}))
