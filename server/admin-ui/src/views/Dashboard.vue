<template>
  <div class="dashboard">
    <!-- KPI Cards -->
    <div class="kpi-row">
      <div v-for="c in kpiCards" :key="c.label" class="kpi-card" :style="{ borderTopColor: c.color }">
        <div class="kpi-icon" v-html="c.icon"></div>
        <div class="kpi-body">
          <span class="kpi-label">{{ c.label }}</span>
          <span class="kpi-value">
            <n-number-animation :from="0" :to="c.value" :duration="800" />
          </span>
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="content-grid">
      <!-- Activity Log -->
      <div class="section-card">
        <div class="section-header">
          <h3><n-icon size="18"><PulseOutline /></n-icon> 最近活动</h3>
          <n-button size="tiny" quaternary @click="loadActivity">刷新</n-button>
        </div>
        <div class="activity-scroll">
          <div v-if="activityLoading" class="loading-pulse" />
          <div v-else-if="!activityEntries.length" class="empty-state">暂无活动记录</div>
          <div v-else class="activity-list">
            <div v-for="e in activityEntries" :key="e.timestamp + e.action" class="activity-row">
              <span class="activity-time">{{ fmtTime(e.timestamp) }}</span>
              <span class="activity-tag" :class="e.level">{{ e.level }}</span>
              <span class="activity-action">{{ actionLabels[e.action] || e.action }}</span>
              <span class="activity-detail">{{ e.detail }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bot Overview -->
      <div class="section-card">
        <div class="section-header">
          <h3><n-icon size="18"><HardwareChipOutline /></n-icon> Bot 概览</h3>
          <n-button size="tiny" secondary type="primary" @click="showBotModal = true">管理</n-button>
        </div>
        <div v-if="botLoading" class="loading-pulse" />
        <div v-else-if="!bots.length" class="empty-state">暂无 Bot</div>
        <div v-else class="bot-grid">
          <div v-for="b in bots" :key="b.id" class="bot-item">
            <div class="bot-name">{{ b.name }}</div>
            <n-tag v-if="b.autoReply" size="tiny" type="success">自动</n-tag>
            <n-tag v-else size="tiny" type="warning">手动</n-tag>
          </div>
        </div>
      </div>

      <!-- Profile -->
      <div class="section-card">
        <div class="section-header">
          <h3><n-icon size="18"><PersonOutline /></n-icon> 账号</h3>
        </div>
        <div class="profile-row">
          <span class="profile-label">用户</span>
          <span>{{ auth.user?.username || '-' }}</span>
        </div>
        <n-divider style="margin: 8px 0" />
        <div class="password-form">
          <n-input
            v-model:value="pwdForm.oldPassword"
            type="password"
            placeholder="当前密码"
            size="small"
          />
          <n-input
            v-model:value="pwdForm.newPassword"
            type="password"
            placeholder="新密码"
            size="small"
          />
          <n-button size="small" type="primary" :loading="pwdSaving" @click="changePwd">
            修改密码
          </n-button>
        </div>
      </div>

      <!-- System Health -->
      <div class="section-card">
        <div class="section-header">
          <h3><n-icon size="18"><SettingsOutline /></n-icon> 系统状态</h3>
          <n-button size="tiny" quaternary @click="loadHealth">刷新</n-button>
        </div>
        <div v-if="!health" class="empty-state">加载中...</div>
        <div v-else class="health-grid">
          <div class="health-item">
            <span class="health-label">运行时间</span>
            <span class="health-value">{{ health.uptime }}</span>
          </div>
          <div class="health-item">
            <span class="health-label">存储类型</span>
            <span class="health-value">{{ health.storageType }}</span>
          </div>
          <div class="health-item">
            <span class="health-label">存储用量</span>
            <span class="health-value">{{ health.storageUsedFormatted }}</span>
          </div>
          <div class="health-item">
            <span class="health-label">数据库</span>
            <span class="health-value">{{ health.dbSizeFormatted }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bot Management Modal -->
    <n-modal v-model:show="showBotModal" title="Bot 管理" :mask-closable="false">
      <n-card title="Bot 管理" style="width: 480px; max-width: 90vw" closable @close="showBotModal = false">
        <n-space vertical>
          <n-button size="small" type="primary" @click="openBotForm()">+ 新建 Bot</n-button>
          <div v-for="b in bots" :key="b.id" class="bot-manage-row">
            <span class="bot-name">{{ b.name }}</span>
            <n-space>
              <n-button size="tiny" quaternary @click="openBotForm(b)">编辑</n-button>
              <n-button size="tiny" quaternary type="error" @click="deleteBot(b)">删除</n-button>
            </n-space>
          </div>
        </n-space>
        <template #footer>
          <n-button size="small" @click="showBotModal = false">关闭</n-button>
        </template>
      </n-card>
    </n-modal>

    <!-- Bot Edit Modal -->
    <n-modal v-model:show="showBotEdit" :title="editingBot ? '编辑 Bot' : '新建 Bot'" :mask-closable="false">
      <n-card :title="editingBot ? '编辑 Bot' : '新建 Bot'" style="width: 420px; max-width: 90vw" closable @close="closeBotForm">
        <n-form ref="botFormRef" :model="botForm" :rules="botRules">
          <n-form-item path="name" label="名称">
            <n-input v-model:value="botForm.name" placeholder="Bot 名称" />
          </n-form-item>
          <n-form-item path="description" label="描述">
            <n-input v-model:value="botForm.description" type="textarea" :rows="2" placeholder="Bot 描述" />
          </n-form-item>
          <n-form-item path="autoReply" label="自动回复">
            <n-switch v-model:value="botForm.autoReply" />
          </n-form-item>
          <n-form-item path="tags" label="标签">
            <n-dynamic-tags v-model:value="botForm.tags" />
          </n-form-item>
        </n-form>
        <template #footer>
          <n-space justify="end">
            <n-button size="small" @click="closeBotForm">取消</n-button>
            <n-button size="small" type="primary" :loading="botSaving" @click="saveBot">保存</n-button>
          </n-space>
        </template>
      </n-card>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  HardwareChipOutline,
  PersonOutline,
  PulseOutline,
  SettingsOutline,
} from '@vicons/ionicons5';
import { NIcon, useMessage } from 'naive-ui';
import { onMounted, reactive, ref } from 'vue';
import { adminApi, api } from '../api';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const msg = useMessage();

/* ─── KPI Cards ─── */
const kpiCards = ref([
  { label: 'Memo', value: 0, color: '#7C3AED', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>' },
  { label: '日记', value: 0, color: '#F97316', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' },
  { label: '资源', value: 0, color: '#10B981', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' },
  { label: 'Bot', value: 0, color: '#3B82F6', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="16" r="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>' },
]);

async function loadStats() {
  try {
    const data: any = await adminApi('/stats');
    kpiCards.value[0].value = data.memos.total;
    kpiCards.value[1].value = data.diaries.total;
    kpiCards.value[2].value = data.resources.total;
    kpiCards.value[3].value = data.bots.total;
  } catch { /* ignore */ }
}

/* ─── Activity ─── */
const activityEntries = ref<any[]>([]);
const activityLoading = ref(false);
const actionLabels: Record<string, string> = {
  create_memo: '创建 Memo', update_memo: '更新 Memo', delete_memo: '删除 Memo',
  create_diary: '创建日记', update_diary: '更新日记', delete_diary: '删除日记',
  create_bot: '创建 Bot', update_bot: '更新 Bot', delete_bot: '删除 Bot',
  login: '登录', change_password: '修改密码',
};

async function loadActivity() {
  activityLoading.value = true;
  try {
    const data: any = await adminApi('/activity', { params: { limit: 20 } });
    activityEntries.value = data.entries || [];
  } catch {
    activityEntries.value = [];
  } finally {
    activityLoading.value = false;
  }
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ─── Bots ─── */
const bots = ref<any[]>([]);
const botLoading = ref(false);
const showBotModal = ref(false);
const showBotEdit = ref(false);
const editingBot = ref<any>(null);
const botSaving = ref(false);
const botFormRef = ref<any>(null);

const botForm = reactive({ name: '', description: '', autoReply: true, tags: [] as string[] });
const botRules = { name: { required: true, message: '请输入名称' } };

async function loadBots() {
  botLoading.value = true;
  try {
    bots.value = await api('/bots') as any[];
  } catch {
    bots.value = [];
  } finally {
    botLoading.value = false;
  }
}

function openBotForm(b?: any) {
  editingBot.value = b || null;
  botForm.name = b?.name || '';
  botForm.description = b?.description || '';
  botForm.autoReply = b?.autoReply ?? true;
  botForm.tags = b?.tags ? [...b.tags] : [];
  showBotEdit.value = true;
}

function closeBotForm() {
  showBotEdit.value = false;
  editingBot.value = null;
}

async function saveBot() {
  try { await botFormRef.value?.validate(); } catch { return; }
  botSaving.value = true;
  try {
    if (editingBot.value) {
      await api(`/bots/${editingBot.value.id}`, { method: 'PUT', body: botForm });
      msg.success('已更新');
    } else {
      await api('/bots', { method: 'POST', body: botForm });
      msg.success('已创建');
    }
    closeBotForm();
    await loadBots();
  } catch {
    msg.error('操作失败');
  } finally {
    botSaving.value = false;
  }
}

async function deleteBot(b: any) {
  try {
    await api(`/bots/${b.id}`, { method: 'DELETE' });
    msg.success('已删除');
    await loadBots();
  } catch {
    msg.error('删除失败');
  }
}

/* ─── Password ─── */
const pwdForm = reactive({ oldPassword: '', newPassword: '' });
const pwdSaving = ref(false);

async function changePwd() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    msg.error('请填写完整');
    return;
  }
  pwdSaving.value = true;
  try {
    await api('/auth/change-password', { method: 'POST', body: pwdForm });
    msg.success('密码已修改');
    pwdForm.oldPassword = '';
    pwdForm.newPassword = '';
  } catch {
    msg.error('修改失败，请检查当前密码');
  } finally {
    pwdSaving.value = false;
  }
}

/* ─── Health ─── */
const health = ref<any>(null);
async function loadHealth() {
  try {
    health.value = await adminApi('/health');
  } catch { /* ignore */ }
}

onMounted(async () => {
  await Promise.all([loadStats(), loadActivity(), loadBots(), loadHealth()]);
});
</script>

<style scoped>
.dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

/* ─── KPI Cards ─── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.kpi-card {
  background: var(--card-color, #fff);
  border-radius: 10px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-top: 3px solid;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  transition: transform .15s, box-shadow .15s;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,.1);
}

.kpi-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-color, #FAF5FF);
  flex-shrink: 0;
}
.kpi-icon :deep(svg) {
  width: 22px;
  height: 22px;
  color: var(--primary-color, #7C3AED);
}

.kpi-body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.kpi-label {
  font-size: 12px;
  color: var(--text-color-3, #888);
  text-transform: uppercase;
  letter-spacing: .5px;
}
.kpi-value {
  font-size: 22px;
  font-weight: 700;
  font-family: 'Fira Code', 'SF Mono', monospace;
  color: var(--text-color, #4C1D95);
  line-height: 1.2;
}

/* ─── Content Grid ─── */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.section-card {
  background: var(--card-color, #fff);
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.section-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

/* ─── Activity ─── */
.activity-scroll {
  max-height: 320px;
  overflow-y: auto;
}
.activity-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.activity-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  transition: background .15s;
}
.activity-row:hover {
  background: var(--hover-color, #f5f3ff);
}

.activity-time {
  font-family: 'Fira Code', 'SF Mono', monospace;
  font-size: 11px;
  color: var(--text-color-3, #999);
  flex-shrink: 0;
  width: 58px;
}
.activity-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  flex-shrink: 0;
}
.activity-tag.info { background: #ede9fe; color: #6d28d9; }
.activity-tag.warn { background: #fef3c7; color: #b45309; }
.activity-tag.error { background: #fee2e2; color: #dc2626; }
.activity-action {
  font-weight: 500;
  flex-shrink: 0;
}
.activity-detail {
  color: var(--text-color-2, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Bots ─── */
.bot-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bot-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  transition: background .15s;
}
.bot-item:hover {
  background: var(--hover-color, #f5f3ff);
}
.bot-name {
  font-weight: 500;
}

.bot-manage-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 6px;
}

/* ─── Profile ─── */
.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
}
.profile-label {
  color: var(--text-color-3, #888);
}
.password-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ─── Health ─── */
.health-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.health-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
  padding: 4px 0;
}
.health-label {
  color: var(--text-color-3, #888);
  font-size: 11px;
}
.health-value {
  font-weight: 600;
  font-family: 'Fira Code', 'SF Mono', monospace;
  font-size: 13px;
}

/* ─── Utils ─── */
.loading-pulse {
  height: 60px;
  background: linear-gradient(90deg, var(--bg-color,#f0f0f0) 25%, var(--skeleton-color,#e0e0e0) 50%, var(--bg-color,#f0f0f0) 75%);
  background-size: 200% 100%;
  animation: pulse 1.5s ease infinite;
  border-radius: 6px;
}
@keyframes pulse { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-color-3, #999);
  font-size: 13px;
}

/* ─── Responsive ─── */
@media (max-width: 1024px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); gap: 10px; }
}
@media (max-width: 768px) {
  .dashboard { padding: 0; }
  .kpi-row { grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi-card { padding: 10px; gap: 8px; border-top-width: 2px; border-radius: 8px; }
  .kpi-icon { width: 32px; height: 32px; border-radius: 8px; }
  .kpi-icon :deep(svg) { width: 18px; height: 18px; }
  .kpi-value { font-size: 18px; }
  .kpi-label { font-size: 10px; }
  .content-grid { grid-template-columns: 1fr; gap: 10px; }
  .section-card { padding: 12px; border-radius: 8px; }
  .section-header h3 { font-size: 14px; }
  .activity-row { flex-wrap: wrap; gap: 4px; padding: 6px; }
  .activity-time { width: auto; font-size: 10px; }
  .activity-action { font-size: 12px; width: 100%; }
  .activity-detail { width: 100%; font-size: 11px; padding-left: 0; }
  .health-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .kpi-row { gap: 6px; }
  .kpi-card { padding: 8px; }
  .kpi-value { font-size: 16px; }
  .kpi-icon { width: 28px; height: 28px; }
  .kpi-icon :deep(svg) { width: 15px; height: 15px; }
  .section-card { padding: 10px; }
  .activity-time { display: none; }
  .activity-tag { font-size: 9px; }
  .health-grid { grid-template-columns: 1fr; }
  .bot-item { flex-wrap: wrap; gap: 4px; }
}
</style>
