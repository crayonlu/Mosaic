<template>
  <n-layout position="absolute">
    <n-layout-header bordered class="header">
      <div class="header-inner">
        <span class="brand">Mosaic</span>
        <n-dropdown trigger="click" :options="userDropdownOptions" @select="handleUserAction">
          <n-button quaternary size="small">
            <template #icon>
              <n-icon size="18"><PersonCircleOutline /></n-icon>
            </template>
            {{ auth.user?.username || '用户' }}
          </n-button>
        </n-dropdown>
      </div>
    </n-layout-header>
    <n-layout-content class="content" :native-scrollbar="false">
      <router-view />
    </n-layout-content>
  </n-layout>
</template>

<script setup lang="ts">
import { PersonCircleOutline } from '@vicons/ionicons5';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const userDropdownOptions = [{ label: '退出登录', key: 'logout' }];

function handleUserAction(key: string) {
  if (key === 'logout') {
    auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--body-color, #fff);
}
.header-inner {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand {
  font-size: 16px;
  font-weight: 700;
  color: #7C3AED;
}
.content {
  padding: 16px;
  min-height: calc(100vh - 48px);
}
@media (max-width: 768px) {
  .content { padding: 12px; }
}
@media (max-width: 480px) {
  .content { padding: 8px; }
}
</style>
