<template>
  <n-config-provider :theme="theme">
    <n-notification-provider>
      <n-message-provider>
        <router-view />
      </n-message-provider>
    </n-notification-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme } from 'naive-ui';
import { onMounted, onUnmounted, ref } from 'vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
const theme = ref(mediaQuery.matches ? darkTheme : null);

function onSchemeChange(e: MediaQueryListEvent) {
  theme.value = e.matches ? darkTheme : null;
}

onMounted(() => {
  mediaQuery.addEventListener('change', onSchemeChange);
  auth.init();
});

onUnmounted(() => {
  mediaQuery.removeEventListener('change', onSchemeChange);
});
</script>
