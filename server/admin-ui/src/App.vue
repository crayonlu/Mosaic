<template>
  <router-view />
  <ToastProvider />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import ToastProvider from './components/ToastProvider.vue';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
onMounted(() => auth.init());
</script>
