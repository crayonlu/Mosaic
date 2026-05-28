import { create } from "zustand/react"
import { api, clearToken, getToken, setToken, type LoginResponse } from "../api"

interface AuthUser {
  id: string
  username: string
  avatarUrl: string | null
  role: string
  createdAt: number
  updatedAt: number
}

interface AuthState {
  user: AuthUser | null
  initialized: boolean
  mustChangePassword: boolean
  isLoggedIn: boolean
  login: (username: string, password: string) => Promise<void>
  fetchMe: () => Promise<void>
  init: () => Promise<void>
  logout: () => void
  clearMustChangePassword: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  mustChangePassword: false,
  get isLoggedIn() {
    return !!getToken() && !!get().user
  },

  login: async (username: string, password: string) => {
    const res = (await api("/auth/login", {
      method: "POST",
      body: { username, password },
    })) as LoginResponse
    setToken(res.accessToken, res.refreshToken)
    set({ user: res.user, mustChangePassword: res.mustChangePassword ?? false })
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
    set({ user: null, mustChangePassword: false })
  },

  clearMustChangePassword: () => {
    set({ mustChangePassword: false })
  },
}))
