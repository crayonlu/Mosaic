<template>
  <n-layout position="absolute" has-sider>
    <n-layout-sider
      bordered
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      show-trigger="bar"
      :collapsed="collapsed"
      @collapse="collapsed = true"
      @expand="collapsed = false"
    >
      <div class="logo">
        <span v-if="!collapsed" class="logo-text">Mosaic</span>
        <span v-else class="logo-small">M</span>
      </div>
      <n-menu
        :collapsed="collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="22"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
      />
    </n-layout-sider>
    <n-layout>
      <n-layout-header bordered class="header">
        <div class="header-right">
          <n-dropdown trigger="click" :options="userDropdownOptions" @select="handleUserAction">
            <n-button quaternary>
              <template #icon>
                <n-icon><PersonCircleOutline /></n-icon>
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
  </n-layout>
</template>

<script setup lang="ts">
import {
  BarChartOutline,
  GridOutline,
  HardwareChipOutline,
  PersonCircleOutline,
  PersonOutline,
  PulseOutline,
} from '@vicons/ionicons5';
import { NIcon } from 'naive-ui';
import { computed, h, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const collapsed = ref(false);

const menuOptions = [
  {
    label: '总览',
    key: '/dashboard',
    icon: () => h(NIcon, null, { default: () => h(GridOutline) }),
  },
  {
    label: '数据统计',
    key: '/stats',
    icon: () => h(NIcon, null, { default: () => h(BarChartOutline) }),
  },
  {
    label: '活动日志',
    key: '/activity',
    icon: () => h(NIcon, null, { default: () => h(PulseOutline) }),
  },
  {
    label: '个人资料',
    key: '/profile',
    icon: () => h(NIcon, null, { default: () => h(PersonOutline) }),
  },
  {
    label: 'Bot 管理',
    key: '/bots',
    icon: () => h(NIcon, null, { default: () => h(HardwareChipOutline) }),
  },
];

const activeKey = computed(() => route.path);

function handleMenuSelect(key: string) {
  router.push(key);
}

const userDropdownOptions = [{ label: '退出登录', key: 'logout' }];

function handleUserAction(key: string) {
  if (key === 'logout') {
    auth.logout();
    router.push('/login');
  }
}
</script>

<style scoped>
.logo {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  border-bottom: 1px solid var(--border-color);
}

.logo-small {
  font-size: 22px;
  font-weight: 800;
}

.header {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 16px;
}

.content {
  padding: 16px;
  min-height: calc(100vh - 48px);
}
</style>
