import { getCurrentWindow } from '@tauri-apps/api/window'

export async function minimizeWindow() {
  const window = getCurrentWindow()
  await window.minimize()
}

export async function maximizeWindow() {
  const window = getCurrentWindow()
  await window.maximize()
}

export async function toggleMaximize() {
  const window = getCurrentWindow()
  await window.toggleMaximize()
}

export async function closeWindow() {
  const window = getCurrentWindow()
  await window.close()
}

export async function isMaximized(): Promise<boolean> {
  const window = getCurrentWindow()
  return await window.isMaximized()
}

