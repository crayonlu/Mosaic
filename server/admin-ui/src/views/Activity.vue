<template>
  <div>
    <n-h2>活动日志</n-h2>
    <n-space vertical>
      <n-space>
        <n-select
          v-model:value="levelFilter"
          :options="levelOptions"
          placeholder="全部级别"
          style="width: 120px"
          clearable
          @update:value="loadActivity"
        />
        <n-button @click="loadActivity" type="primary" secondary>刷新</n-button>
      </n-space>
      <n-data-table
        :columns="columns"
        :data="entries"
        :loading="loading"
        :pagination="false"
        :max-height="600"
        striped
        size="small"
      />
    </n-space>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumn } from 'naive-ui';
import { NTag, NTime } from 'naive-ui';
import { h, ref } from 'vue';
import { adminApi, type ActivityEntry } from '../api';

const loading = ref(false);
const entries = ref<ActivityEntry[]>([]);
const levelFilter = ref<string | null>(null);

const levelOptions = [
  { label: 'Info', value: 'info' },
  { label: 'Warn', value: 'warn' },
  { label: 'Error', value: 'error' },
];

const actionLabels: Record<string, string> = {
  create_memo: '创建 Memo',
  update_memo: '更新 Memo',
  delete_memo: '删除 Memo',
  create_diary: '创建日记',
  update_diary: '更新日记',
  delete_diary: '删除日记',
  create_bot: '创建 Bot',
  update_bot: '更新 Bot',
  delete_bot: '删除 Bot',
  login: '登录',
  change_password: '修改密码',
  bot_reply: 'Bot 回复',
};

const levelColors: Record<string, 'info' | 'warning' | 'error'> = {
  info: 'info',
  warn: 'warning',
  error: 'error',
};

const columns: DataTableColumn[] = [
  {
    title: '时间',
    key: 'timestamp',
    width: 180,
    render(row: ActivityEntry) {
      return h(NTime, { time: row.timestamp, format: 'yyyy-MM-dd HH:mm:ss' });
    },
  },
  {
    title: '级别',
    key: 'level',
    width: 80,
    render(row: ActivityEntry) {
      return h(
        NTag,
        { type: levelColors[row.level] || 'default', size: 'small' },
        { default: () => row.level.toUpperCase() }
      );
    },
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render(row: ActivityEntry) {
      return actionLabels[row.action] || row.action;
    },
  },
  {
    title: '详情',
    key: 'detail',
    ellipsis: { tooltip: true },
  },
];

async function loadActivity() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { limit: 100 };
    if (levelFilter.value) params.level = levelFilter.value;
    const data = await adminApi('/activity', { params }) as { entries: ActivityEntry[] };
    entries.value = data.entries || [];
  } catch {
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

loadActivity();
</script>
