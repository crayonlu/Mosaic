<template>
  <section class="panel">
    <div class="panel-header">
      <h3><Bot :size="16" /> Bot 概览</h3>
      <button class="btn-ghost" @click="showList = true">管理</button>
    </div>
    <div class="panel-body">
      <div v-if="loading" class="skeleton skeleton-line" style="height: 80px" />
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

  <!-- Bot List Modal -->
  <Modal :show="showList" title="Bot 管理" @close="showList = false">
    <div class="bm-list">
      <button class="btn-primary btn-block" @click="openEditor()">
        <Plus :size="16" /> 新建 Bot
      </button>

      <div v-if="!bots.length" class="empty">暂无 Bot，点击上方按钮创建一个</div>

      <div v-else class="bm-cards">
        <div v-for="b in bots" :key="b.id" class="bm-card">
          <div class="bm-card-body" @click="openEditor(b)">
            <div class="bm-card-avatar">
              <AdminImage v-if="b.avatarUrl" :src="b.avatarUrl" class-name="bm-avatar-img" alt="" />
              <Bot v-else :size="22" class="bm-avatar-icon" />
            </div>
            <div class="bm-card-info">
              <span class="bm-card-name">{{ b.name }}</span>
              <span class="bm-card-desc">{{ b.description || '暂无描述' }}</span>
              <span class="badge" :class="b.autoReply ? 'badge-success' : 'badge-warning'">
                {{ b.autoReply ? '自动回复' : '手动回复' }}
              </span>
            </div>
          </div>
          <div class="bm-card-actions">
            <button class="btn-ghost btn-edit" @click="openEditor(b)">
              <Pencil :size="14" /> <span class="btn-label">编辑</span>
            </button>
            <button class="btn-ghost btn-danger" @click="handleDelete(b)">
              <Trash2 :size="14" /> <span class="btn-label">删除</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="showList = false">关闭</button>
    </template>
  </Modal>

  <!-- Bot Editor Modal -->
  <Modal :show="showEditor" :title="editing ? '编辑 Bot' : '新建 Bot'" @close="closeEditor">
    <div class="be-root">
      <!-- Avatar + Name & Description -->
      <div class="be-card">
        <div class="be-profile">
          <div class="be-avatar-col">
            <div class="avatar-upload" @click="triggerAvatar" :class="{ uploading: avatarUploading }">
              <AdminImage v-if="form.avatarUrl" :src="form.avatarUrl" class-name="avatar-img" alt="Bot avatar" />
              <div v-else class="avatar-placeholder"><Bot :size="32" /></div>
              <div class="avatar-overlay">
                <Loader v-if="avatarUploading" :size="18" class="spin" />
                <Camera v-else :size="18" />
              </div>
            </div>
            <p class="avatar-hint">点击更换头像</p>
            <input ref="avatarRef" type="file" accept="image/*" class="sr-only" @change="uploadAvatar" />
          </div>
          <div class="be-fields-col">
            <div class="be-field">
              <label class="be-label">名称 <span class="be-required">*</span></label>
              <input v-model="form.name" class="input" placeholder="为 Bot 取一个名字" maxlength="30" />
            </div>
            <div class="be-field">
              <label class="be-label">描述</label>
              <textarea
                ref="descRef"
                v-model="form.description"
                class="input input-area be-desc"
                rows="1"
                placeholder="简短描述 Bot 的性格、语气和用途…"
                @input="autoResize"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Config -->
      <div class="be-card">
        <h4 class="be-section-title">配置</h4>

        <!-- Auto Reply Toggle -->
        <div class="be-config-row">
          <div class="be-config-info">
            <span class="be-config-label">自动回复</span>
            <span class="be-config-hint">开启后 Bot 会对新 Memo 自动生成回复</span>
          </div>
          <label class="toggle">
            <input v-model="form.autoReply" type="checkbox" />
            <span class="toggle-track" />
          </label>
        </div>

        <!-- Tags -->
        <div class="be-field">
          <label class="be-label">标签</label>
          <div class="tags-area">
            <span v-for="(t, i) in form.tags" :key="i" class="tag-chip">
              {{ t }}
              <button type="button" class="tag-remove" @click="form.tags.splice(i, 1)">&times;</button>
            </span>
            <input
              v-model="tagInput"
              class="tag-input"
              placeholder="输入标签后回车…"
              @keydown.enter.prevent="addTag"
              @keydown.backspace="onTagBs"
            />
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <button class="btn-secondary" @click="closeEditor">取消</button>
      <button class="btn-primary" :disabled="saving || avatarUploading" @click="save">
        <Loader v-if="saving" :size="14" class="spin" />
        <span v-else>保存</span>
      </button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { Bot, Camera, Loader, Pencil, Plus, Trash2 } from 'lucide-vue-next';
import { onMounted, reactive, ref } from 'vue';
import { api } from '../api';
import { useToast } from '../composables/useToast';
import AdminImage from './AdminImage.vue';
import Modal from './Modal.vue';

const toast = useToast();

const bots = ref<any[]>([]);
const loading = ref(false);
const showList = ref(false);
const showEditor = ref(false);
const editing = ref<any>(null);
const saving = ref(false);
const avatarUploading = ref(false);
const avatarRef = ref<HTMLInputElement | null>(null);
const descRef = ref<HTMLTextAreaElement | null>(null);
const form = reactive({ name: '', description: '', autoReply: true, tags: [] as string[], avatarUrl: '' });
const tagInput = ref('');

async function loadBots() {
  loading.value = true;
  try { bots.value = await api('/bots') as any[]; }
  catch { bots.value = []; }
  finally { loading.value = false; }
}

function openEditor(b?: any) {
  editing.value = b || null;
  form.name = b?.name || '';
  form.description = b?.description || '';
  form.autoReply = b?.autoReply ?? true;
  form.tags = b?.tags ? [...b.tags] : [];
  form.avatarUrl = b?.avatarUrl || '';
  tagInput.value = '';
  showEditor.value = true;
  setTimeout(autoResize, 0);
}

function closeEditor() {
  showEditor.value = false;
  editing.value = null;
}

function triggerAvatar() { avatarRef.value?.click(); }

function autoResize() {
  const el = descRef.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

async function uploadAvatar(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  avatarUploading.value = true;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const res: any = await api('/resources', { method: 'POST', body: fd, headers: {} } as any);
    form.avatarUrl = res.url || res.thumbnailUrl || '';
    toast.success('头像已上传');
  } catch { toast.error('上传失败'); }
  finally {
    avatarUploading.value = false;
    if (avatarRef.value) avatarRef.value.value = '';
  }
}

async function save() {
  if (!form.name.trim()) { toast.error('请输入名称'); return; }
  saving.value = true;
  try {
    const body = { name: form.name, description: form.description, autoReply: form.autoReply, tags: form.tags, avatarUrl: form.avatarUrl || undefined };
    if (editing.value) {
      await api(`/bots/${editing.value.id}`, { method: 'PUT', body });
      toast.success('已更新');
    } else {
      await api('/bots', { method: 'POST', body });
      toast.success('已创建');
    }
    closeEditor();
    await loadBots();
  } catch { toast.error('操作失败'); }
  finally { saving.value = false; }
}

async function handleDelete(b: any) {
  try {
    await api(`/bots/${b.id}`, { method: 'DELETE' });
    toast.success('已删除');
    await loadBots();
  } catch { toast.error('删除失败'); }
}

function addTag() {
  const v = tagInput.value.trim();
  if (v && !form.tags.includes(v)) form.tags.push(v);
  tagInput.value = '';
}
function onTagBs() { if (!tagInput.value && form.tags.length) form.tags.pop(); }

defineExpose({ loadBots });
onMounted(loadBots);
</script>

<style scoped>
/* ═══ Overview (in dashboard panel) ═══ */
.bot-list { display: flex; flex-direction: column; gap: 2px; }
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
.bot-name { font-weight: 500; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}
.badge-success { background: var(--success-soft); color: var(--success); }
.badge-warning { background: var(--warning-soft); color: var(--warning); }

/* ═══ Bot List Modal ═══ */
.bm-list { display: flex; flex-direction: column; gap: 12px; }

.bm-cards { display: flex; flex-direction: column; gap: 8px; }

.bm-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--bg-page);
  border: 1px solid var(--border);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.bm-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }

.bm-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
  cursor: pointer;
}

.bm-card-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.bm-avatar-img { width: 100%; height: 100%; object-fit: cover; }
.bm-avatar-icon { color: var(--text-tertiary); }

.bm-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.bm-card-name { font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.3; }
.bm-card-desc {
  font-size: 12px; color: var(--text-tertiary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.bm-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.bm-card-actions .btn-ghost {
  padding: 8px;
  border-radius: var(--radius-sm);
}
.btn-label { display: inline; }

/* ═══ Bot Editor ═══ */
.be-root { display: flex; flex-direction: column; gap: 16px; }

.be-card {
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  min-width: 0;
}

/* Profile row */
.be-profile {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  min-width: 0;
}

.be-avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  width: 96px;
}

.be-fields-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.be-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.be-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}
.be-required { color: var(--error); }

.be-desc {
  min-height: 56px;
  resize: none;
  overflow: hidden;
  line-height: 1.6;
}

/* Section title */
.be-section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 14px;
}

/* Config rows (e.g. auto-reply toggle) */
.be-config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  min-width: 0;
}
.be-config-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.be-config-label { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.be-config-hint { font-size: 11px; color: var(--text-tertiary); }

/* ═══ Avatar Upload ═══ */
.avatar-upload {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-surface);
  border: 2px dashed var(--border-strong);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}
.avatar-upload:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 12%, transparent);
}
.avatar-upload.uploading { pointer-events: none; opacity: 0.6; }
.avatar-img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.avatar-placeholder { display: flex; align-items: center; justify-content: center; color: var(--text-tertiary); }
.avatar-overlay {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  color: white; opacity: 0;
  transition: opacity var(--transition-fast);
  border-radius: 50%;
}
.avatar-upload:hover .avatar-overlay { opacity: 1; }
.avatar-hint { font-size: 11px; color: var(--text-tertiary); margin: 0; white-space: nowrap; }

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
  min-height: 42px;
  transition: border-color var(--transition-fast);
}
.tags-area:focus-within { border-color: var(--accent); }
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 10px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--radius-pill);
}
.tag-remove {
  border: none; background: transparent; color: inherit;
  cursor: pointer; font-size: 14px; line-height: 1; padding: 0;
  opacity: .7; border-radius: 50%; width: 16px; height: 16px;
  display: flex; align-items: center; justify-content: center;
}
.tag-remove:hover { opacity: 1; }
.tag-input {
  border: none; outline: none; background: transparent;
  color: var(--text-primary);
  font-family: var(--font-sans); font-size: 12px;
  min-width: 80px; flex: 1;
}
.tag-input::placeholder { color: var(--text-tertiary); }

/* ═══ Toggle ═══ */
.toggle { position: relative; display: inline-block; cursor: pointer; flex-shrink: 0; }
.toggle input { position: absolute; opacity: 0; width: 0; height: 0; }
.toggle-track {
  display: block; width: 40px; height: 22px;
  border-radius: var(--radius-pill);
  background: var(--border-strong);
  transition: all var(--transition-fast);
  position: relative;
}
.toggle-track::after {
  content: '';
  position: absolute; top: 3px; left: 3px;
  width: 16px; height: 16px;
  border-radius: 50%;
  background: white;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 2px rgba(0,0,0,.15);
}
.toggle input:checked + .toggle-track { background: var(--accent); }
.toggle input:checked + .toggle-track::after { transform: translateX(18px); }

/* ═══ Shared ═══ */
.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty { text-align: center; padding: 20px; color: var(--text-tertiary); font-size: 13px; }

/* ═══ Responsive: Tablet ═══ */
@media (max-width: 768px) {
  .be-card { padding: 16px; }
  .be-profile { gap: 16px; }
  .be-avatar-col { width: 80px; }
  .avatar-upload { width: 72px; height: 72px; }
}

/* ═══ Responsive: Mobile ═══ */
@media (max-width: 640px) {
  /* Bot list modal cards */
  .bm-card {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
    padding: 14px;
  }
  .bm-card-body { gap: 10px; }
  .bm-card-avatar { width: 36px; height: 36px; }
  .bm-card-name { font-size: 13px; }
  .bm-card-actions {
    justify-content: flex-end;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }
  .bm-card-actions .btn-ghost {
    flex: 1;
    justify-content: center;
    padding: 10px 12px;
    min-height: 40px;
    font-size: 13px;
  }
  .btn-label { display: inline; }

  /* Editor */
  .be-profile {
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }
  .be-avatar-col { width: auto; }
  .avatar-upload { width: 80px; height: 80px; }
  .be-fields-col { width: 100%; }

  .be-config-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .be-card { padding: 14px; }
  .be-root { gap: 12px; }
}
</style>
