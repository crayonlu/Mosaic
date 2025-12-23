import { create } from 'zustand'
import { userCommands } from '@/utils/callRust'
import type { User } from '@/types/user'

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
      const user = await userCommands.getUser()
      set({ user })
    } catch (error) {
      console.error('Failed to load user:', error)
    } finally {
      set({ loading: false })
    }
  },
  updateUser: user => set({ user }),
}))

