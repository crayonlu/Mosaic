import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(ts: number, unit: "s" | "ms" = "ms") {
  const d = new Date(unit === "s" ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString()
}

export function formatDateTime(ts: number, unit: "s" | "ms" = "ms") {
  const d = new Date(unit === "s" ? ts * 1000 : ts)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString()
}

export function formatSize(bytes: number) {
  if (!bytes || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** i
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}

export function formatClock(ts: number) {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "—"
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
