import { create } from "zustand/react"
import type { UseToastManagerReturnValue } from "@base-ui/react/toast"

export type ToastType = "success" | "error" | "warning" | "info"

interface ToastState {
  success: (msg: string) => void
  error: (msg: string) => void
  warning: (msg: string) => void
  info: (msg: string) => void
}

export const toastManagerRef: { current: UseToastManagerReturnValue | null } = {
  current: null,
}

function push(type: ToastType, message: string) {
  toastManagerRef.current?.add({ title: message, type })
}

export const useToastStore = create<ToastState>(() => ({
  success: (msg) => push("success", msg),
  error: (msg) => push("error", msg),
  warning: (msg) => push("warning", msg),
  info: (msg) => push("info", msg),
}))

export function useToast() {
  return useToastStore()
}
