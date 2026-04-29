import { create } from "zustand/react"
import { api, clearToken, getToken, setToken } from "../api"

interface AuthUser {
  id: string
  username: string
  avatarUrl: string | null
  createdAt: number
  updatedAt: number
}

interface AuthState {
  user: AuthUser | null
  initialized: boolean
  isLoggedIn: boolean
  login: (username: string, password: string) => Promise<void>
  fetchMe: () => Promise<void>
  init: () => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  get isLoggedIn() {
    return !!getToken() && !!get().user
  },

  login: async (username: string, password: string) => {
    const res = (await api("/auth/login", {
      method: "POST",
      body: { username, password },
    })) as { accessToken: string; refreshToken: string; user: AuthUser }
    setToken(res.accessToken, res.refreshToken)
    set({ user: res.user })
  },

  fetchMe: async () => {
    try {
      const res = (await api("/auth/me")) as AuthUser
      set({ user: res })
    } catch {
      clearToken()
      set({ user: null })
    }
  },

  init: async () => {
    if (get().initialized) return
    if (getToken()) {
      await get().fetchMe()
    }
    set({ initialized: true })
  },

  logout: () => {
    clearToken()
    set({ user: null })
  },
}))
