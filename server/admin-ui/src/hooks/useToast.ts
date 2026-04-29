import { create } from "zustand/react"

export interface ToastItem {
  id: number
  message: string
  type: "success" | "error" | "warning" | "info"
  createdAt: number
}

interface ToastState {
  toasts: ToastItem[]
  success: (msg: string) => void
  error: (msg: string) => void
  warning: (msg: string) => void
  info: (msg: string) => void
}

let nextId = 0
const DURATION = 3500

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  success: (msg: string) => {
    const id = nextId++
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id, message: msg, type: "success", createdAt: Date.now() },
      ],
    }))
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      DURATION
    )
  },

  error: (msg: string) => {
    const id = nextId++
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id, message: msg, type: "error", createdAt: Date.now() },
      ],
    }))
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      DURATION
    )
  },

  warning: (msg: string) => {
    const id = nextId++
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id, message: msg, type: "warning", createdAt: Date.now() },
      ],
    }))
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      DURATION
    )
  },

  info: (msg: string) => {
    const id = nextId++
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id, message: msg, type: "info", createdAt: Date.now() },
      ],
    }))
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      DURATION
    )
  },
}))

export function useToast() {
  return useToastStore()
}
