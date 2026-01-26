import type { User } from '@/types/user'
import { userCommands } from '@/utils/callRust'
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
      const user = await userCommands.getUser()
      set({ user: user || null })
    } catch (error) {
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },
  updateUser: user => set({ user }),
}))
