<template>
  <section class="panel">
    <div class="panel-header">
      <h3><Sparkles :size="16" /> AI 模型配置</h3>
      <button class="btn-ghost" @click="loadConfig">刷新</button>
    </div>
    <div class="panel-body">
      <div v-if="loading" class="skeleton skeleton-line" style="height: 120px" />
      <div v-else class="ai-grid">
        <div v-for="key in (['bot', 'embedding'] as const)" :key="key" class="ai-card">
          <h4 class="ai-card-title">{{ key === 'bot' ? 'Bot 模型' : 'Embedding 模型' }}</h4>

          <div class="field">
            <label class="field-label">API 规范</label>
            <div class="seg-toggle">
              <button
                v-for="p in providers"
                :key="p"
                class="seg-btn"
                :class="{ active: form[key].provider === p }"
                @click="setProvider(key, p)"
              >{{ p === 'openai' ? 'OpenAI' : 'Anthropic' }}</button>
            </div>
          </div>

          <div class="field">
            <label class="field-label">Base URL</label>
            <input v-model="form[key].baseUrl" class="input" placeholder="https://api.openai.com" />
          </div>

          <div class="field">
            <label class="field-label">API Key</label>
            <div class="key-wrap">
              <input
                v-model="form[key].apiKey"
                :type="showKeys[key] ? 'text' : 'password'"
                class="input key-input"
                placeholder="sk-..."
              />
              <button class="key-toggle" @click="showKeys[key] = !showKeys[key]">
                <Eye v-if="!showKeys[key]" :size="14" />
                <EyeOff v-else :size="14" />
              </button>
            </div>
          </div>

          <div class="field">
            <label class="field-label">模型</label>
            <div class="model-combo">
              <input
                v-model="form[key].model"
                class="input model-input"
                :placeholder="key === 'bot'
                  ? (form[key].provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514')
                  : 'text-embedding-3-small'"
                @focus="fetchModels(key)"
              />
              <button
                class="fetch-btn"
                @click="fetchModels(key)"
                :disabled="modelsLoading[key]"
              >
                <Loader v-if="modelsLoading[key]" :size="13" class="spin" />
                <span v-else>获取</span>
              </button>
            </div>
            <p v-if="modelErrors[key]" class="model-error">{{ modelErrors[key] }}</p>
            <div v-if="modelLists[key].length" class="model-list">
              <button
                v-for="m in filteredModels(key)"
                :key="m"
                class="model-item"
                :class="{ selected: m === form[key].model }"
                @click="form[key].model = m"
              >
                <span class="model-name">{{ m }}</span>
                <Check v-if="m === form[key].model" :size="14" />
              </button>
            </div>
          </div>

          <div v-if="saved[key].supportsVision || saved[key].supportsThinking" class="caps">
            <span v-if="saved[key].supportsVision" class="cap cap-vision">✓ 图片输入</span>
            <span v-if="saved[key].supportsThinking" class="cap cap-thinking">✓ 心路历程</span>
          </div>

          <button
            class="save-btn"
            :disabled="saving[key]"
            @click="save(key)"
          >
            <Loader v-if="saving[key]" :size="14" class="spin" />
            <span v-else>保存{{ key === 'bot' ? ' Bot' : ' Embedding' }} 配置</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Check, Eye, EyeOff, Loader, Sparkles } from 'lucide-vue-next';
import { onMounted, reactive, ref } from 'vue';
import { adminApi } from '../api';
import { useToast } from '../composables/useToast';

type ConfigKey = 'bot' | 'embedding';
const providers = ['openai', 'anthropic'] as const;
const providerUrls: Record<string, string> = {
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
};

const toast = useToast();
const loading = ref(false);
const showKeys = reactive({ bot: false, embedding: false });
const saving = reactive({ bot: false, embedding: false });
const modelsLoading = reactive({ bot: false, embedding: false });
const modelErrors = reactive({ bot: '', embedding: '' });
const modelLists = reactive({ bot: [] as string[], embedding: [] as string[] });

const form = reactive({
  bot: { provider: 'openai', baseUrl: 'https://api.openai.com', apiKey: '', model: '' },
  embedding: { provider: 'openai', baseUrl: 'https://api.openai.com', apiKey: '', model: '' },
});
const saved = reactive({
  bot: { supportsVision: false, supportsThinking: false },
  embedding: { supportsVision: false, supportsThinking: false },
});

function filteredModels(key: ConfigKey) {
  const q = form[key].model.toLowerCase();
  if (!q) return modelLists[key];
  return modelLists[key].filter(m => m.toLowerCase().includes(q));
}

function setProvider(key: ConfigKey, provider: string) {
  form[key].provider = provider;
  form[key].baseUrl = providerUrls[provider] || '';
}

async function loadConfig() {
  loading.value = true;
  try {
    const data: any = await adminApi('/ai-config');
    for (const k of ['bot', 'embedding'] as ConfigKey[]) {
      if (!data[k]) continue;
      form[k].provider = data[k].provider || 'openai';
      form[k].baseUrl = data[k].baseUrl || '';
      form[k].apiKey = data[k].apiKey || '';
      form[k].model = data[k].model || '';
      saved[k].supportsVision = data[k].supportsVision || false;
      saved[k].supportsThinking = data[k].supportsThinking || false;
    }
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

async function fetchModels(key: ConfigKey) {
  const f = form[key];
  if (!f.baseUrl.trim()) return;
  modelsLoading[key] = true;
  try {
    const url = `${f.baseUrl.replace(/\/+$/, '')}/models`;
    const res = await fetch(url, {
      headers: f.apiKey ? { Authorization: `Bearer ${f.apiKey}` } : {},
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const body = await res.json();
    modelLists[key] = Array.isArray(body.data)
      ? body.data.map((m: any) => m.id as string).sort()
      : [];
    modelErrors[key] = '';
  } catch (e) {
    modelLists[key] = [];
    modelErrors[key] = `获取失败: ${e instanceof Error ? e.message : '未知错误'}`;
  }
  finally { modelsLoading[key] = false; }
}

async function save(key: ConfigKey) {
  saving[key] = true;
  try {
    const f = form[key];
    const result: any = await adminApi(`/ai-config/${key}`, {
      method: 'PUT',
      body: { provider: f.provider, baseUrl: f.baseUrl, apiKey: f.apiKey, model: f.model },
    });
    saved[key].supportsVision = result.supportsVision || false;
    saved[key].supportsThinking = result.supportsThinking || false;
    toast.success('已保存');
  } catch { toast.error('保存失败'); }
  finally { saving[key] = false; }
}

onMounted(loadConfig);
</script>

<style scoped>
.ai-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.ai-card {
  background: var(--bg-page);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ai-card-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
}

.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

.seg-toggle { display: flex; gap: 4px; }
.seg-btn {
  flex: 1;
  padding: 6px 12px;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.seg-btn:hover { border-color: var(--accent); }
.seg-btn.active {
  background: var(--accent);
  color: var(--on-accent);
  border-color: var(--accent);
}

.model-combo { display: flex; gap: 6px; }
.model-input { flex: 1; min-width: 0; }
.fetch-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  flex-shrink: 0;
}
.fetch-btn:hover:not(:disabled) { background: var(--accent-hover); }
.fetch-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.model-list {
  max-height: 180px;
  overflow-y: auto;
  border: 1.5px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-surface);
  margin-top: 2px;
}
.model-error {
  color: var(--danger);
  font-size: 11px;
  margin-top: 2px;
}
.model-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 7px 10px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: background var(--transition-fast);
  text-align: left;
}
.model-item:hover { background: var(--bg-hover); }
.model-item.selected { background: var(--accent-soft); }
.model-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }

.caps { display: flex; gap: 8px; flex-wrap: wrap; }
.cap {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}
.cap-vision { background: var(--info-soft); color: var(--info); }
.cap-thinking { background: var(--success-soft); color: var(--success); }

.key-wrap { display: flex; gap: 6px; align-items: center; }
.key-input { flex: 1; min-width: 0; }
.key-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: color var(--transition-fast);
  flex-shrink: 0;
}
.key-toggle:hover { color: var(--text-primary); }

.save-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 8px 18px;
  border: none;
  border-radius: var(--radius-sm);
  background: var(--accent);
  color: var(--on-accent);
  font-size: 13px;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-top: 4px;
}
.save-btn:hover:not(:disabled) { background: var(--accent-hover); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .ai-grid { grid-template-columns: 1fr; }
}
</style>
