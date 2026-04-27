<template>
  <img v-if="blobUrl" :src="blobUrl" :alt="alt" :class="className" />
  <div v-else-if="showPlaceholder" class="auth-img-placeholder">
    <Loader :size="16" class="spin" />
  </div>
</template>

<script setup lang="ts">
import { Loader } from 'lucide-vue-next';
import { ref, watch } from 'vue';
import { getToken } from '../api';

const props = defineProps<{
  src: string;
  alt?: string;
  className?: string;
  showPlaceholder?: boolean;
}>();

const blobUrl = ref<string | null>(null);

async function loadImage(url: string) {
  blobUrl.value = null;
  if (!url) return;
  try {
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    blobUrl.value = URL.createObjectURL(blob);
  } catch {
    // silently fail — avatar simply won't display
  }
}

watch(() => props.src, loadImage, { immediate: true });
</script>
