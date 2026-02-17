import type { User } from '@/types/user'
import { authApi } from '@mosaic/api'
import { create } from 'zustand'

interface UserState {
  user: User | null
  loading: boolean
  loadUser: () => Promise<void>
  updateUser: (user: User) => void
}

export const useUserStore = create<UserState>(set => ({
  user: null,
  loading: false,
  loadUser: async () => {
    set({ loading: true })
    try {
      const user = await authApi.me()
      console.log('Loaded user:', user)
      set({ user: user || null })
    } catch (error) {
      console.error('Failed to load user:', error)
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },
  updateUser: user => set({ user }),
}))
