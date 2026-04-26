import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ThemeName = 'quiet-paper' | 'clean-slate';
export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY_THEME = 'mosaic_admin_theme';
const STORAGE_KEY_MODE = 'mosaic_admin_mode';

function getStoredTheme(): ThemeName {
  const v = localStorage.getItem(STORAGE_KEY_THEME);
  if (v === 'clean-slate') return 'clean-slate';
  return 'quiet-paper';
}

function getStoredMode(): ThemeMode | 'system' {
  const v = localStorage.getItem(STORAGE_KEY_MODE);
  if (v === 'light' || v === 'dark') return v;
  return 'system';
}

function getSystemMode(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(name: ThemeName, mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', name);
  document.documentElement.setAttribute('data-mode', mode);
}

export const useThemeStore = defineStore('theme', () => {
  const themeName = ref<ThemeName>(getStoredTheme());
  const modePreference = ref<ThemeMode | 'system'>(getStoredMode());
  const resolvedMode = ref<ThemeMode>(
    modePreference.value === 'system' ? getSystemMode() : modePreference.value
  );

  function setTheme(name: ThemeName) {
    themeName.value = name;
    localStorage.setItem(STORAGE_KEY_THEME, name);
    applyTheme(name, resolvedMode.value);
  }

  function setMode(mode: ThemeMode | 'system') {
    modePreference.value = mode;
    if (mode === 'system') {
      localStorage.removeItem(STORAGE_KEY_MODE);
      resolvedMode.value = getSystemMode();
    } else {
      localStorage.setItem(STORAGE_KEY_MODE, mode);
      resolvedMode.value = mode;
    }
    applyTheme(themeName.value, resolvedMode.value);
  }

  function init() {
    // Listen for system changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', (e) => {
      if (modePreference.value === 'system') {
        resolvedMode.value = e.matches ? 'dark' : 'light';
        applyTheme(themeName.value, resolvedMode.value);
      }
    });

    applyTheme(themeName.value, resolvedMode.value);
  }

  // Keep in sync
  watch([themeName, resolvedMode], () => {
    applyTheme(themeName.value, resolvedMode.value);
  });

  return { themeName, modePreference, resolvedMode, setTheme, setMode, init };
});
