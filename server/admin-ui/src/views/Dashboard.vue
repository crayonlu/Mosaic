<template>
  <div class="dashboard">
    <!-- KPI Cards -->
    <div class="kpi-grid">
      <div v-for="c in kpiCards" :key="c.label" class="kpi-card">
        <div class="kpi-icon" :style="{ '--kpi-color': c.color }">
          <component :is="c.iconComp" :size="20" />
        </div>
        <div class="kpi-body">
          <span class="kpi-value">{{ animatedValues[c.label] ?? 0 }}</span>
          <span class="kpi-label">{{ c.label }}</span>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="main-grid">
      <!-- Activity -->
      <section class="panel">
        <div class="panel-header">
          <h3><Activity :size="16" /> 最近活动</h3>
          <button class="btn-ghost" @click="loadActivity">刷新</button>
        </div>
        <div class="panel-body panel-body--scroll">
          <div v-if="activityLoading" class="skeleton skeleton-line" style="height: 120px" />
          <div v-else-if="!activityEntries.length" class="empty">暂无活动记录</div>
          <div v-else class="activity-list">
            <div v-for="e in activityEntries" :key="e.timestamp + e.action" class="activity-row">
              <span class="act-time">{{ fmtTime(e.timestamp) }}</span>
              <span class="act-tag" :class="'tag-' + e.level">{{ e.level }}</span>
              <span class="act-action">{{ actionLabels[e.action] || e.action }}</span>
              <span class="act-detail">{{ e.detail }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Bots -->
      <section class="panel">
        <div class="panel-header">
          <h3><Bot :size="16" /> Bot 概览</h3>
          <button class="btn-ghost" @click="showBotModal = true">管理</button>
        </div>
        <div class="panel-body">
          <div v-if="botLoading" class="skeleton skeleton-line" style="height: 80px" />
          <div v-else-if="!bots.length" class="empty">暂无 Bot</div>
          <div v-else class="bot-list">
            <div v-for="b in bots" :key="b.id" class="bot-row">
              <span class="bot-name">{{ b.name }}</span>
              <span class="badge" :class="b.autoReply ? 'badge-success' : 'badge-warning'">
                {{ b.autoReply ? '自动' : '手动' }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- Profile -->
      <section class="panel">
        <div class="panel-header">
          <h3><UserIcon :size="16" /> 账号</h3>
        </div>
        <div class="panel-body">
          <div class="profile-row">
            <span class="label">用户</span>
            <span class="value">{{ auth.user?.username || '-' }}</span>
          </div>
          <hr class="divider" />
          <form class="pwd-form" @submit.prevent="changePwd">
            <div class="input-group">
              <input
                v-model="pwdForm.oldPassword"
                type="password"
                class="input-sm"
                placeholder="当前密码"
              />
              <input
                v-model="pwdForm.newPassword"
                type="password"
                class="input-sm"
                placeholder="新密码"
              />
            </div>
            <button type="submit" class="btn-sm" :disabled="pwdSaving">
              <Loader v-if="pwdSaving" :size="13" class="spin" />
              <span v-else>修改密码</span>
            </button>
          </form>
        </div>
      </section>

      <!-- Health -->
      <section class="panel">
        <div class="panel-header">
          <h3><Server :size="16" /> 系统状态</h3>
          <button class="btn-ghost" @click="loadHealth">刷新</button>
        </div>
        <div class="panel-body">
          <div v-if="!health" class="empty">加载中...</div>
          <div v-else class="health-grid">
            <div class="health-item">
              <span class="label">运行时间</span>
              <span class="value-mono">{{ health.uptime }}</span>
            </div>
            <div class="health-item">
              <span class="label">存储类型</span>
              <span class="value-mono">{{ health.storageType }}</span>
            </div>
            <div class="health-item">
              <span class="label">存储用量</span>
              <span class="value-mono">{{ health.storageUsedFormatted }}</span>
            </div>
            <div class="health-item">
              <span class="label">数据库</span>
              <span class="value-mono">{{ health.dbSizeFormatted }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <!-- Bot Management Modal -->
    <Modal :show="showBotModal" title="Bot 管理" max-width="480px" @close="showBotModal = false">
      <div class="modal-section">
        <button class="btn-primary btn-block" @click="openBotForm()">
          <Plus :size="14" /> 新建 Bot
        </button>
        <div v-if="!bots.length" class="empty" style="padding: 12px">暂无 Bot</div>
        <div v-for="b in bots" :key="b.id" class="modal-row">
          <span class="bot-name">{{ b.name }}</span>
          <div class="row-actions">
            <button class="btn-ghost" @click="openBotForm(b)">编辑</button>
            <button class="btn-ghost btn-danger" @click="handleDeleteBot(b)">删除</button>
          </div>
        </div>
      </div>
      <template #footer>
        <button class="btn-secondary" @click="showBotModal = false">关闭</button>
      </template>
    </Modal>

    <!-- Bot Edit Modal -->
    <Modal :show="showBotEdit" :title="editingBot ? '编辑 Bot' : '新建 Bot'" max-width="420px" @close="closeBotForm">
      <form class="modal-form" @submit.prevent="saveBot">
        <label class="field-label">名称</label>
        <input v-model="botForm.name" class="input" placeholder="Bot 名称" />

        <label class="field-label">描述</label>
        <textarea v-model="botForm.description" class="input input-area" rows="2" placeholder="Bot 描述" />

        <label class="field-label">自动回复</label>
        <div class="toggle-row">
          <label class="toggle">
            <input v-model="botForm.autoReply" type="checkbox" />
            <span class="toggle-track"></span>
          </label>
          <span class="toggle-hint">{{ botForm.autoReply ? '已启用' : '已关闭' }}</span>
        </div>

        <label class="field-label">标签</label>
        <div class="tags-area">
          <span v-for="(t, i) in botForm.tags" :key="i" class="tag-chip">
            {{ t }}
            <button type="button" class="tag-remove" @click="botForm.tags.splice(i, 1)">&times;</button>
          </span>
          <input
            v-model="tagInput"
            class="tag-input"
            placeholder="输入后回车"
            @keydown.enter.prevent="addTag"
            @keydown.backspace="onTagBackspace"
          />
        </div>
      </form>
      <template #footer>
        <button class="btn-secondary" @click="closeBotForm">取消</button>
        <button class="btn-primary" :disabled="botSaving" @click="saveBot">
          <Loader v-if="botSaving" :size="14" class="spin" />
          <span v-else>保存</span>
        </button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import {
  Activity, Bot, FileText, Image, Loader, MessageSquare,
  Plus, Server, User as UserIcon,
} from 'lucide-vue-next';
import { onMounted, reactive, ref } from 'vue';
import { adminApi, api } from '../api';
import Modal from '../components/Modal.vue';
import { useToast } from '../composables/useToast';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const toast = useToast();

/* ─── KPI ─── */
const kpiCards = ref([
  { label: 'Memo', value: 0, color: '#7C3AED', iconComp: FileText },
  { label: '日记', value: 0, color: '#F97316', iconComp: MessageSquare },
  { label: '资源', value: 0, color: '#10B981', iconComp: Image },
  { label: 'Bot', value: 0, color: '#3B82F6', iconComp: Bot },
]);

const animatedValues = reactive<Record<string, number>>({});

function animateValue(target: number, key: string) {
  const start = animatedValues[key] ?? 0;
  const duration = 600;
  const startTime = performance.now();
  function step(now: number) {
    const elapsed = now - startTime;
    const p = Math.min(elapsed / duration, 1);
    animatedValues[key] = Math.round(start + (target - start) * easeOutCubic(p));
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

async function loadStats() {
  try {
    const data: any = await adminApi('/stats');
    kpiCards.value[0].value = data.memos.total;
    kpiCards.value[1].value = data.diaries.total;
    kpiCards.value[2].value = data.resources.total;
    kpiCards.value[3].value = data.bots.total;
    kpiCards.value.forEach((c) => animateValue(c.value, c.label));
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
  } catch { activityEntries.value = []; }
  finally { activityLoading.value = false; }
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
const botForm = reactive({ name: '', description: '', autoReply: true, tags: [] as string[] });
const tagInput = ref('');

async function loadBots() {
  botLoading.value = true;
  try { bots.value = await api('/bots') as any[]; }
  catch { bots.value = []; }
  finally { botLoading.value = false; }
}

function openBotForm(b?: any) {
  editingBot.value = b || null;
  botForm.name = b?.name || '';
  botForm.description = b?.description || '';
  botForm.autoReply = b?.autoReply ?? true;
  botForm.tags = b?.tags ? [...b.tags] : [];
  tagInput.value = '';
  showBotEdit.value = true;
}

function closeBotForm() {
  showBotEdit.value = false;
  editingBot.value = null;
}

async function saveBot() {
  if (!botForm.name.trim()) {
    toast.error('请输入名称');
    return;
  }
  botSaving.value = true;
  try {
    if (editingBot.value) {
      await api(`/bots/${editingBot.value.id}`, { method: 'PUT', body: botForm });
      toast.success('已更新');
    } else {
      await api('/bots', { method: 'POST', body: botForm });
      toast.success('已创建');
    }
    closeBotForm();
    await loadBots();
  } catch { toast.error('操作失败'); }
  finally { botSaving.value = false; }
}

async function handleDeleteBot(b: any) {
  try {
    await api(`/bots/${b.id}`, { method: 'DELETE' });
    toast.success('已删除');
    await loadBots();
  } catch { toast.error('删除失败'); }
}

function addTag() {
  const v = tagInput.value.trim();
  if (v && !botForm.tags.includes(v)) botForm.tags.push(v);
  tagInput.value = '';
}
function onTagBackspace() {
  if (!tagInput.value && botForm.tags.length) botForm.tags.pop();
}

/* ─── Password ─── */
const pwdForm = reactive({ oldPassword: '', newPassword: '' });
const pwdSaving = ref(false);

async function changePwd() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) {
    toast.error('请填写完整');
    return;
  }
  pwdSaving.value = true;
  try {
    await api('/auth/change-password', { method: 'POST', body: pwdForm });
    toast.success('密码已修改');
    pwdForm.oldPassword = '';
    pwdForm.newPassword = '';
  } catch { toast.error('修改失败，请检查当前密码'); }
  finally { pwdSaving.value = false; }
}

/* ─── Health ─── */
const health = ref<any>(null);
async function loadHealth() {
  try { health.value = await adminApi('/health'); }
  catch { /* ignore */ }
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

/* ═══ KPI Grid ═══ */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.kpi-card {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  padding: 18px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--shadow-sm);
  transition: box-shadow var(--transition-fast), transform var(--transition-fast);
}
.kpi-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-1px);
}
.kpi-icon {
  width: 42px;
  height: 42px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--kpi-color) 12%, transparent);
  color: var(--kpi-color);
  flex-shrink: 0;
}
.kpi-body { display: flex; flex-direction: column; min-width: 0; }
.kpi-value {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--font-mono);
  color: var(--text-primary);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.kpi-label {
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

/* ═══ Main Grid ═══ */
.main-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* ═══ Panel (borderless card) ═══ */
.panel {
  background: var(--bg-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 0;
}
.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.panel-body { padding: 12px 16px 16px; }
.panel-body--scroll {
  max-height: 340px;
  overflow-y: auto;
}

/* ═══ Activity ═══ */
.activity-list { display: flex; flex-direction: column; gap: 1px; }
.activity-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  transition: background var(--transition-fast);
}
.activity-row:hover { background: var(--bg-hover); }
.act-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  width: 58px;
}
.act-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 3px;
  text-transform: uppercase;
  flex-shrink: 0;
}
.tag-info  { background: var(--info-soft); color: var(--info); }
.tag-warn  { background: var(--warning-soft); color: var(--warning); }
.tag-error { background: var(--error-soft); color: var(--error); }
.act-action { font-weight: 500; flex-shrink: 0; color: var(--text-primary); }
.act-detail {
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ═══ Bots ═══ */
.bot-list { display: flex; flex-direction: column; gap: 4px; }
.bot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  transition: background var(--transition-fast);
}
.bot-row:hover { background: var(--bg-hover); }
.bot-name { font-weight: 500; }

/* ═══ Badge ═══ */
.badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
}
.badge-success { background: var(--success-soft); color: var(--success); }
.badge-warning { background: var(--warning-soft); color: var(--warning); }

/* ═══ Profile ═══ */
.profile-row { display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 2px 0; }
.divider { border: none; border-top: 1px solid var(--border); margin: 10px 0; }
.pwd-form { display: flex; flex-direction: column; gap: 8px; }
.input-group { display: flex; gap: 6px; }

/* ═══ Health ═══ */
.health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.health-item { display: flex; flex-direction: column; gap: 2px; }
.label { font-size: 11px; color: var(--text-tertiary); }
.value { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.value-mono {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ═══ Shared UI primitives ═══ */
.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-family: var(--font-sans);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }
.btn-danger:hover { background: var(--error-soft); color: var(--error); }

.btn-primary, .btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 18px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-primary { background: var(--accent); color: var(--on-accent); }
.btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-secondary {
  background: var(--bg-surface-alt);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn-secondary:hover { background: var(--bg-hover); }
.btn-block { width: 100%; }
.btn-sm {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-sm:hover:not(:disabled) { background: var(--accent-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.input, .input-sm {
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-page);
  color: var(--text-primary);
  font-family: var(--font-sans);
  outline: none;
  transition: all var(--transition-fast);
}
.input:focus, .input-sm:focus { border-color: var(--accent); background: var(--bg-surface); }
.input::placeholder, .input-sm::placeholder { color: var(--text-tertiary); }

.input { padding: 9px 12px; font-size: 13px; width: 100%; }
.input-area { resize: vertical; }
.input-sm { padding: 6px 10px; font-size: 12px; flex: 1; }

.field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 4px;
  margin-top: 12px;
}
.field-label:first-child { margin-top: 0; }

.empty { text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 13px; }

.skeleton, .skeleton-line { animation: skeleton-pulse 1.5s ease-in-out infinite; border-radius: var(--radius-sm); }
.skeleton { background: var(--bg-surface-alt); }
.skeleton-line { background: var(--bg-hover); }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ═══ Toggle ═══ */
.toggle-row { display: flex; align-items: center; gap: 10px; margin-top: 4px; }
.toggle { position: relative; display: inline-block; cursor: pointer; }
.toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: block;
  width: 36px;
  height: 20px;
  border-radius: var(--radius-pill);
  background: var(--border-strong);
  transition: all var(--transition-fast);
  position: relative;
}
.toggle-track::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: white;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 2px rgba(0,0,0,.15);
}
.toggle input:checked + .toggle-track { background: var(--accent); }
.toggle input:checked + .toggle-track::after { transform: translateX(16px); }
.toggle-hint { font-size: 12px; color: var(--text-tertiary); }

/* ═══ Tags ═══ */
.tags-area {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-page);
  min-height: 40px;
  transition: border-color var(--transition-fast);
}
.tags-area:focus-within { border-color: var(--accent); }
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-pill);
}
.tag-remove {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0;
  opacity: .7;
}
.tag-remove:hover { opacity: 1; }
.tag-input {
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 12px;
  min-width: 80px;
  flex: 1;
}
.tag-input::placeholder { color: var(--text-tertiary); }

/* ═══ Modal content ═══ */
.modal-section { display: flex; flex-direction: column; gap: 6px; }
.modal-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}
.modal-row:hover { background: var(--bg-hover); }
.row-actions { display: flex; gap: 4px; }
.modal-form {
  display: flex;
  flex-direction: column;
}

/* ═══ Responsive ═══ */
@media (max-width: 1024px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .kpi-grid { gap: 8px; margin-bottom: 14px; }
  .kpi-card { padding: 14px 12px; gap: 10px; }
  .kpi-icon { width: 36px; height: 36px; }
  .kpi-value { font-size: 20px; }
  .main-grid { grid-template-columns: 1fr; gap: 10px; }
  .panel-header { padding: 12px 12px 0; }
  .panel-body { padding: 10px 12px 14px; }
  .act-time { width: auto; font-size: 10px; }
  .activity-row { flex-wrap: wrap; gap: 4px; padding: 6px; }
  .act-action { font-size: 11px; width: 100%; }
  .act-detail { width: 100%; font-size: 11px; }
}

@media (max-width: 480px) {
  .kpi-grid { gap: 6px; }
  .kpi-card { padding: 10px; gap: 8px; }
  .kpi-icon { width: 32px; height: 32px; }
  .kpi-value { font-size: 17px; }
  .kpi-label { font-size: 10px; }
  .act-time { display: none; }
  .act-tag { font-size: 9px; padding: 1px 4px; }
  .health-grid { grid-template-columns: 1fr; }
  .input-group { flex-direction: column; }
  .panel-header h3 { font-size: 13px; }
}
</style>
