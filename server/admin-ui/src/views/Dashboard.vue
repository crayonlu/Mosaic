<template>
  <n-spin :show="loading">
    <n-h2>总览</n-h2>
    <n-grid :cols="4" :x-gap="12" :y-gap="12">
      <n-grid-item v-for="card in cards" :key="card.label">
        <n-card :title="card.label" size="small">
          <n-statistic>
            <n-number-animation :from="0" :to="card.value" />
          </n-statistic>
        </n-card>
      </n-grid-item>
    </n-grid>
  </n-spin>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui';
import { onMounted, ref } from 'vue';
import { adminApi, type StatsSummary } from '../api';

const message = useMessage();
const loading = ref(false);

const stats = ref<StatsSummary | null>(null);

const cards = ref([
  { label: 'Memo 总数', value: 0 },
  { label: '日记总数', value: 0 },
  { label: '资源总数', value: 0 },
  { label: 'Bot 总数', value: 0 },
]);

onMounted(async () => {
  loading.value = true;
  try {
    const data = await adminApi('/stats') as StatsSummary;
    stats.value = data;
    cards.value = [
      { label: 'Memo 总数', value: data.memos.total },
      { label: '日记总数', value: data.diaries.total },
      { label: '资源总数', value: data.resources.total },
      { label: 'Bot 总数', value: data.bots.total },
    ];
  } catch {
    message.error('加载统计数据失败');
  } finally {
    loading.value = false;
  }
});
</script>
