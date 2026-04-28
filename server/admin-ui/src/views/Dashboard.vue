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

      <!-- Bots (extracted component) -->
      <BotManager />

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
              <input v-model="pwdForm.oldPassword" type="password" class="input-sm" placeholder="当前密码" />
              <input v-model="pwdForm.newPassword" type="password" class="input-sm" placeholder="新密码" />
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

    <!-- AI Config (extracted component) -->
    <div class="section-gap">
      <AIConfigPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Activity, Bot, FileText, Image, Loader, MessageSquare, Server, User as UserIcon } from 'lucide-vue-next';
import { onMounted, reactive, ref } from 'vue';
import { adminApi, api } from '../api';
import AIConfigPanel from '../components/AIConfigPanel.vue';
import BotManager from '../components/BotManager.vue';
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
function easeOutCubic(t: number) { return 1 - Math.pow(1 - t, 3); }

async function loadStats() {
  try {
    const data: any = await adminApi('/stats');
    kpiCards.value[0].value = data.memos.total;
    kpiCards.value[1].value = data.diaries.total;
    kpiCards.value[2].value = data.resources.total;
    kpiCards.value[3].value = data.bots.total;
    kpiCards.value.forEach(c => animateValue(c.value, c.label));
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

/* ─── Password ─── */
const pwdForm = reactive({ oldPassword: '', newPassword: '' });
const pwdSaving = ref(false);

async function changePwd() {
  if (!pwdForm.oldPassword || !pwdForm.newPassword) { toast.error('请填写完整'); return; }
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
  try { health.value = await adminApi('/health'); } catch { /* ignore */ }
}

onMounted(() => Promise.all([loadStats(), loadActivity(), loadHealth()]));
</script>

<style scoped>
.dashboard { max-width: 1200px; margin: 0 auto; }
.section-gap { margin-top: 12px; }

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
.kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
.kpi-icon {
  width: 42px; height: 42px; border-radius: var(--radius-sm);
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--kpi-color) 12%, transparent);
  color: var(--kpi-color); flex-shrink: 0;
}
.kpi-body { display: flex; flex-direction: column; min-width: 0; }
.kpi-value {
  font-size: 24px; font-weight: 700; font-family: var(--font-mono);
  color: var(--text-primary); line-height: 1.1; font-variant-numeric: tabular-nums;
}
.kpi-label {
  font-size: 11px; color: var(--text-tertiary);
  text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;
}

/* ═══ Main Grid ═══ */
.main-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* ═══ Panel ═══ */
.panel {
  background: var(--bg-surface); border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm); overflow: hidden;
  display: flex; flex-direction: column;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 0;
}
.panel-header h3 {
  font-size: 14px; font-weight: 600; color: var(--text-primary);
  display: flex; align-items: center; gap: 8px;
}
.panel-body { padding: 12px 16px 16px; }
.panel-body--scroll { max-height: 340px; overflow-y: auto; }

/* ═══ Activity ═══ */
.activity-list { display: flex; flex-direction: column; gap: 1px; }
.activity-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: var(--radius-sm);
  font-size: 12px; transition: background var(--transition-fast);
}
.activity-row:hover { background: var(--bg-hover); }
.act-time {
  font-family: var(--font-mono); font-size: 11px;
  color: var(--text-tertiary); flex-shrink: 0; width: 58px;
}
.act-tag {
  font-size: 10px; font-weight: 600; padding: 1px 5px;
  border-radius: 3px; text-transform: uppercase; flex-shrink: 0;
}
.tag-info  { background: var(--info-soft); color: var(--info); }
.tag-warn  { background: var(--warning-soft); color: var(--warning); }
.tag-error { background: var(--error-soft); color: var(--error); }
.act-action { font-weight: 500; flex-shrink: 0; color: var(--text-primary); }
.act-detail {
  color: var(--text-secondary); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; min-width: 0;
}

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
.value-mono { font-family: var(--font-mono); font-size: 12px; font-weight: 600; color: var(--text-primary); }

/* ═══ Shared primitives ═══ */
.btn-ghost {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 10px; border: none; background: transparent;
  color: var(--text-secondary); font-size: 12px; font-family: var(--font-sans);
  cursor: pointer; border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }

.btn-sm {
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  padding: 6px 14px; border: none; border-radius: var(--radius-sm);
  background: var(--accent); color: var(--on-accent);
  font-size: 12px; font-weight: 600; font-family: var(--font-sans);
  cursor: pointer; transition: all var(--transition-fast);
}
.btn-sm:hover:not(:disabled) { background: var(--accent-hover); }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }

.input-sm {
  border: 1.5px solid var(--border); border-radius: var(--radius-sm);
  background: var(--bg-page); color: var(--text-primary);
  font-family: var(--font-sans); outline: none;
  padding: 6px 10px; font-size: 12px; flex: 1;
  transition: all var(--transition-fast);
}
.input-sm:focus { border-color: var(--accent); background: var(--bg-surface); }
.input-sm::placeholder { color: var(--text-tertiary); }

.empty { text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 13px; }
.skeleton, .skeleton-line { animation: skeleton-pulse 1.5s ease-in-out infinite; border-radius: var(--radius-sm); }
.skeleton { background: var(--bg-surface-alt); }
.skeleton-line { background: var(--bg-hover); }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

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
