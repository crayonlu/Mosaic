<template>
  <div>
    <n-h2>Bot 伴侣管理</n-h2>
    <n-space vertical>
      <n-space justify="end">
        <n-button type="primary" @click="openCreate">创建 Bot</n-button>
      </n-space>
      <n-data-table :columns="columns" :data="bots" :loading="loading" striped size="small" />
    </n-space>

    <n-modal v-model:show="showModal" :title="editing ? '编辑 Bot' : '创建 Bot'">
      <n-card
        :title="editing ? '编辑 Bot' : '创建 Bot'"
        style="width: 480px"
        closable
        @close="closeModal"
      >
        <n-form ref="formRef" :model="form" :rules="formRules">
          <n-form-item path="name" label="名称">
            <n-input v-model:value="form.name" placeholder="Bot 名称" />
          </n-form-item>
          <n-form-item path="description" label="描述">
            <n-input
              v-model:value="form.description"
              type="textarea"
              :rows="3"
              placeholder="Bot 描述"
            />
          </n-form-item>
          <n-form-item path="autoReply" label="自动回复">
            <n-switch v-model:value="form.autoReply" />
          </n-form-item>
          <n-form-item path="tags" label="标签">
            <n-dynamic-tags v-model:value="form.tags" />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button @click="closeModal">取消</n-button>
            <n-button type="primary" :loading="saving" @click="handleSave">保存</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import type { DataTableColumn, FormInst, FormRules } from 'naive-ui';
import { NButton, NSwitch, NTag, NTime, useMessage } from 'naive-ui';
import { h, onMounted, ref } from 'vue';
import { api } from '../api';

interface BotItem {
  id: string;
  name: string;
  description: string;
  tags: string[];
  autoReply: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

const message = useMessage();
const formRef = ref<FormInst | null>(null);
const bots = ref<BotItem[]>([]);
const loading = ref(false);
const saving = ref(false);
const showModal = ref(false);
const editing = ref(false);
const editId = ref<string | null>(null);

const form = ref({
  name: '',
  description: '',
  autoReply: true,
  tags: [] as string[],
});

const formRules: FormRules = {
  name: { required: true, message: '请输入 Bot 名称' },
};

const columns: DataTableColumn[] = [
  { title: '名称', key: 'name', width: 140 },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
  },
  {
    title: '标签',
    key: 'tags',
    width: 160,
    render(row: any) {
      return row.tags.map((t: string) =>
        h(NTag, { size: 'small', style: 'margin-right: 4px' }, { default: () => t })
      );
    },
  },
  {
    title: '自动回复',
    key: 'autoReply',
    width: 90,
    render(row: any) {
      return h(NSwitch, { value: row.autoReply, disabled: true });
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 160,
    render(row: any) {
      return h(NTime, { time: row.createdAt, format: 'yyyy-MM-dd HH:mm' });
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row: any) {
      return h('span', { style: 'display: flex; gap: 8px' }, [
        h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
        h(
          NButton,
          { size: 'small', type: 'error', quaternary: true, onClick: () => handleDelete(row) },
          { default: () => '删除' }
        ),
      ]);
    },
  },
];

function openCreate() {
  editing.value = false;
  editId.value = null;
  form.value = { name: '', description: '', autoReply: true, tags: [] };
  showModal.value = true;
}

function openEdit(bot: BotItem) {
  editing.value = true;
  editId.value = bot.id;
  form.value = {
    name: bot.name,
    description: bot.description,
    autoReply: bot.autoReply,
    tags: [...bot.tags],
  };
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
  editId.value = null;
}

async function loadBots() {
  loading.value = true;
  try {
    const data: any = await api('/bots');
    bots.value = data || [];
  } catch {
    bots.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  try {
    await formRef.value?.validate();
  } catch {
    return;
  }
  saving.value = true;
  try {
    if (editing.value && editId.value) {
      await api(`/bots/${editId.value}`, {
        method: 'PUT',
        body: form.value,
      });
      message.success('Bot 已更新');
    } else {
      await api('/bots', {
        method: 'POST',
        body: form.value,
      });
      message.success('Bot 已创建');
    }
    closeModal();
    await loadBots();
  } catch {
    message.error('操作失败');
  } finally {
    saving.value = false;
  }
}

async function handleDelete(bot: BotItem) {
  try {
    await api(`/bots/${bot.id}`, { method: 'DELETE' });
    message.success('Bot 已删除');
    await loadBots();
  } catch {
    message.error('删除失败');
  }
}

onMounted(loadBots);
</script>
