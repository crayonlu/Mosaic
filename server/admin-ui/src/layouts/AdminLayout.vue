<template>
  <div class="layout">
    <header ref="headerRef" class="header">
      <div class="header-inner">
        <router-link to="/dashboard" class="brand" aria-label="Mosaic 管理后台">
          <svg class="brand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
          </svg>
          <span class="brand-text">Mosaic</span>
        </router-link>

        <div class="header-actions">
          <!-- Theme Toggle -->
          <div class="theme-toggle">
            <button
              class="theme-btn"
              :class="{ active: themeStore.themeName === 'quiet-paper' }"
              @click="themeStore.setTheme('quiet-paper')"
              title="暖纸主题"
            >
              <Sun :size="14" />
            </button>
            <button
              class="theme-btn"
              :class="{ active: themeStore.themeName === 'clean-slate' }"
              @click="themeStore.setTheme('clean-slate')"
              title="清冷主题"
            >
              <Snowflake :size="14" />
            </button>
            <span class="theme-divider"></span>
            <button
              class="theme-btn"
              @click="toggleMode"
              :title="modeLabel"
            >
              <Moon v-if="themeStore.resolvedMode === 'dark'" :size="14" />
              <Sun v-else :size="14" />
            </button>
          </div>

          <!-- User Menu -->
          <div class="user-menu" ref="menuRef">
            <button class="user-btn" @click="menuOpen = !menuOpen">
              <User :size="16" />
              <span class="user-name">{{ auth.user?.username || '用户' }}</span>
              <ChevronDown :size="12" class="chevron" :class="{ open: menuOpen }" />
            </button>
            <Transition name="dropdown">
              <div v-if="menuOpen" class="dropdown-menu">
                <button class="dropdown-item" @click="handleLogout">
                  <LogOut :size="14" />
                  退出登录
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </header>

    <main class="main">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, LogOut, Moon, Snowflake, Sun, User } from 'lucide-vue-next';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';

const auth = useAuthStore();
const themeStore = useThemeStore();
const router = useRouter();

const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);
const headerRef = ref<HTMLElement | null>(null);

// Click outside to close dropdown
function onDocClick(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    menuOpen.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocClick));
onUnmounted(() => document.removeEventListener('click', onDocClick));

// Header scroll effect
function onScroll() {
  if (headerRef.value) {
    headerRef.value.classList.toggle('is-scrolled', window.scrollY > 0);
  }
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onUnmounted(() => window.removeEventListener('scroll', onScroll));

const modeLabel = computed(() =>
  themeStore.resolvedMode === 'dark' ? '切换浅色模式' : '切换深色模式'
);

function toggleMode() {
  const next = themeStore.resolvedMode === 'dark' ? 'light' : 'dark';
  themeStore.setMode(next);
}

function handleLogout() {
  menuOpen.value = false;
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-page);
}

/* ─── Header ─── */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: var(--bg-page);
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition-normal);
}
/* Subtle border appears when scrolled */
.header.is-scrolled {
  border-bottom-color: var(--border);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 700;
  font-size: 16px;
}
.brand-icon {
  width: 22px;
  height: 22px;
}
.brand-text {
  letter-spacing: -0.3px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Theme Toggle ─── */
.theme-toggle {
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--bg-surface);
  border-radius: var(--radius-pill);
  padding: 2px;
}
.theme-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
}
.theme-btn:hover { color: var(--text-primary); }
.theme-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
}
.theme-divider {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 2px;
}

/* ─── User Button ─── */
.user-menu {
  position: relative;
}
.user-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
}
.user-btn:hover { background: var(--bg-hover); }
.user-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chevron { transition: transform var(--transition-fast); color: var(--text-tertiary); }
.chevron.open { transform: rotate(180deg); }

/* ─── Dropdown ─── */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 140px;
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: 4px;
  border: 1px solid var(--border);
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-family: var(--font-sans);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.dropdown-item:hover { background: var(--error-soft); color: var(--error); }

.dropdown-enter-active { transition: all 150ms ease-out; }
.dropdown-leave-active { transition: all 100ms ease-in; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-4px); }

/* ─── Main ─── */
.main {
  flex: 1;
  padding: 24px;
}
@media (max-width: 768px) {
  .main { padding: 16px 12px; }
  .header-inner { padding: 0 12px; }
}
@media (max-width: 480px) {
  .main { padding: 12px 8px; }
  .brand-text { display: none; }
  .user-name { display: none; }
}
</style>
