<template>
  <div class="login-page">
    <div class="login-card">
      <!-- Logo area -->
      <div class="login-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="login-logo-icon">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        <h1 class="login-title">Mosaic 管理后台</h1>
        <p class="login-desc">登录以管理您的 Mosaic 服务</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label class="field-label" for="username">用户名</label>
          <div class="input-wrapper">
            <User :size="16" class="input-icon" />
            <input
              id="username"
              v-model="form.username"
              type="text"
              class="input"
              placeholder="请输入用户名"
              autocomplete="username"
              :disabled="loading"
            />
          </div>
        </div>

        <div class="field">
          <label class="field-label" for="password">密码</label>
          <div class="input-wrapper">
            <Lock :size="16" class="input-icon" />
            <input
              id="password"
              v-model="form.password"
              type="password"
              class="input"
              placeholder="请输入密码"
              autocomplete="current-password"
              :disabled="loading"
              @keyup.enter="handleLogin"
            />
          </div>
        </div>

        <p v-if="errorMsg" class="login-error">{{ errorMsg }}</p>

        <button type="submit" class="btn-primary" :disabled="loading">
          <Loader v-if="loading" :size="16" class="spin" />
          <span v-else>登录</span>
        </button>
      </form>

      <!-- Theme picker on login page -->
      <div class="login-theme">
        <button
          class="theme-chip"
          :class="{ active: themeStore.themeName === 'quiet-paper' }"
          @click="themeStore.setTheme('quiet-paper')"
        >暖纸</button>
        <button
          class="theme-chip"
          :class="{ active: themeStore.themeName === 'clean-slate' }"
          @click="themeStore.setTheme('clean-slate')"
        >清冷</button>
        <span class="theme-gap"></span>
        <button class="theme-chip" @click="toggleMode">
          <Sun v-if="themeStore.resolvedMode === 'light'" :size="14" />
          <Moon v-else :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader, Lock, Moon, Sun, User } from 'lucide-vue-next';
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from '../composables/useToast';
import { useAuthStore } from '../stores/auth';
import { useThemeStore } from '../stores/theme';

const auth = useAuthStore();
const themeStore = useThemeStore();
const router = useRouter();
const toast = useToast();

const loading = ref(false);
const errorMsg = ref('');

const form = reactive({ username: '', password: '' });

function toggleMode() {
  const next = themeStore.resolvedMode === 'dark' ? 'light' : 'dark';
  themeStore.setMode(next);
}

async function handleLogin() {
  errorMsg.value = '';
  if (!form.username.trim() || !form.password.trim()) {
    errorMsg.value = '请填写用户名和密码';
    return;
  }
  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    router.replace('/dashboard');
  } catch {
    errorMsg.value = '登录失败，请检查用户名和密码';
    toast.error('登录失败，请检查用户名和密码');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: var(--bg-page);
  transition: background var(--transition-normal);
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  padding: 36px 32px;
  box-shadow: var(--shadow-md);
}

/* ─── Logo ─── */
.login-logo {
  text-align: center;
  margin-bottom: 28px;
}
.login-logo-icon {
  width: 40px;
  height: 40px;
  color: var(--accent);
  margin-bottom: 12px;
}
.login-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}
.login-desc {
  font-size: 13px;
  color: var(--text-tertiary);
  margin: 0;
}

/* ─── Form ─── */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.field { display: flex; flex-direction: column; gap: 4px; }
.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-page);
  border-radius: var(--radius-sm);
  padding: 0 12px;
  border: 1.5px solid transparent;
  transition: all var(--transition-fast);
}
.input-wrapper:focus-within {
  border-color: var(--accent);
  background: var(--bg-surface);
}
.input-icon {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
.input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 10px 0;
  font-size: 14px;
  font-family: var(--font-sans);
  color: var(--text-primary);
  outline: none;
}
.input::placeholder { color: var(--text-tertiary); }
.input:disabled { opacity: 0.5; }

.login-error {
  font-size: 12px;
  color: var(--error);
  margin: 0;
  text-align: center;
}

/* ─── Button ─── */
.btn-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 14px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ─── Theme picker ─── */
.login-theme {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 4px;
  margin-top: 20px;
}
.theme-chip {
  padding: 4px 12px;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  border-radius: var(--radius-pill);
  transition: all var(--transition-fast);
}
.theme-chip:hover { color: var(--text-primary); background: var(--bg-hover); }
.theme-chip.active { color: var(--accent); background: var(--accent-soft); }
.theme-gap { width: 1px; height: 14px; background: var(--border); }

@media (max-width: 480px) {
  .login-page { padding: 16px; }
  .login-card { padding: 28px 20px; }
}
</style>
