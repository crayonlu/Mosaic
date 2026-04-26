<template>
  <n-spin :show="loading">
    <n-h2>数据统计</n-h2>

    <n-grid :cols="3" :x-gap="12" :y-gap="12">
      <n-grid-item>
        <n-card title="月度总结" size="small">
          <n-statistic label="Memo" :value="summary?.totalMemos ?? '-'" />
          <n-statistic label="日记" :value="summary?.totalDiaries ?? '-'" />
          <n-statistic label="资源" :value="summary?.totalResources ?? '-'" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="情绪分布" size="small">
          <div v-if="moodData.length" class="mood-list">
            <div v-for="m in moodData" :key="m.moodKey" class="mood-row">
              <span class="mood-label">{{ moodLabels[m.moodKey] || m.moodKey }}</span>
              <n-progress type="line" :percentage="Math.round(m.percentage)" :height="12" />
              <span class="mood-count">{{ m.count }}</span>
            </div>
          </div>
          <n-empty v-else description="暂无数据" />
        </n-card>
      </n-grid-item>
      <n-grid-item>
        <n-card title="热门标签" size="small">
          <div v-if="tagData.length" class="tag-list">
            <n-tag
              v-for="t in tagData"
              :key="t.tag"
              class="tag-item"
              :style="tagStyle(t.count, tagData)"
            >
              {{ t.tag }} ({{ t.count }})
            </n-tag>
          </div>
          <n-empty v-else description="暂无数据" />
        </n-card>
      </n-grid-item>
    </n-grid>

    <n-card title="日历热力图" class="heatmap-card">
      <div class="date-controls">
        <n-date-picker v-model:value="dateRange" type="daterange" @update:value="loadHeatmap" />
      </div>
      <div v-if="heatmap" class="heatmap-grid">
        <div
          v-for="(d, i) in heatmap.dates"
          :key="d"
          class="heatmap-cell"
          :class="cellClass(heatmap.counts[i])"
          :title="`${d}: ${heatmap.counts[i]} 条`"
        />
      </div>
      <n-empty v-else-if="!loading" description="选择日期范围加载数据" />
    </n-card>
  </n-spin>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api } from '../api';

const loading = ref(false);

const dateRange = ref<[number, number]>([Date.now() - 86400000 * 90, Date.now()]);

interface SummaryData {
  totalMemos: number;
  totalDiaries: number;
  totalResources: number;
}

interface HeatmapData {
  dates: string[];
  counts: number[];
  moods: (string | null)[];
  moodScores: (number | null)[];
}

interface MoodItem {
  moodKey: string;
  count: number;
  percentage: number;
}

interface TagItem {
  tag: string;
  count: number;
}

const summary = ref<SummaryData | null>(null);
const heatmap = ref<HeatmapData | null>(null);
const moodData = ref<MoodItem[]>([]);
const tagData = ref<TagItem[]>([]);

const moodLabels: Record<string, string> = {
  joy: '喜悦',
  calm: '平静',
  neutral: '中立',
  sadness: '悲伤',
  anxiety: '焦虑',
  anger: '愤怒',
  focus: '专注',
  tired: '疲惫',
};

function cellClass(count: number): string {
  if (count === 0) return 'cell-empty';
  if (count <= 3) return 'cell-low';
  if (count <= 10) return 'cell-mid';
  return 'cell-high';
}

function tagStyle(count: number, all: TagItem[]): Record<string, string> {
  const max = Math.max(...all.map((t) => t.count));
  const opacity = 0.2 + (count / max) * 0.8;
  return { opacity: String(opacity) };
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function loadHeatmap() {
  if (!dateRange.value) return;
  const [start, end] = dateRange.value;
  const startStr = formatDate(new Date(start));
  const endStr = formatDate(new Date(end));
  try {
    const data: any = await api('/stats/heatmap', {
      params: { startDate: startStr, endDate: endStr },
    });
    heatmap.value = data;
  } catch {
    /* ignore */
  }
}

async function loadTrends() {
  const [start, end] = dateRange.value || [Date.now() - 86400000 * 90, Date.now()];
  const startStr = formatDate(new Date(start));
  const endStr = formatDate(new Date(end));
  try {
    const data: any = await api('/stats/trends', {
      params: { startDate: startStr, endDate: endStr },
    });
    moodData.value = data.moods || [];
    tagData.value = data.tags || [];
  } catch {
    /* ignore */
  }
}

async function loadSummary() {
  const now = new Date();
  try {
    const data: any = await api('/stats/summary', {
      params: { year: now.getFullYear(), month: now.getMonth() + 1 },
    });
    summary.value = data;
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  loading.value = true;
  await Promise.all([loadHeatmap(), loadTrends(), loadSummary()]);
  loading.value = false;
});
</script>

<style scoped>
.heatmap-card {
  margin-top: 12px;
}

.date-controls {
  margin-bottom: 16px;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 14px);
  gap: 3px;
}

.heatmap-cell {
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.cell-empty {
  background: var(--border-color);
}
.cell-low {
  background: var(--primary-color);
  opacity: 0.3;
}
.cell-mid {
  background: var(--primary-color);
  opacity: 0.6;
}
.cell-high {
  background: var(--primary-color);
  opacity: 1;
}

.mood-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mood-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mood-label {
  width: 48px;
  font-size: 13px;
  flex-shrink: 0;
}

.mood-count {
  width: 24px;
  text-align: right;
  font-size: 12px;
  color: var(--text-color-3);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-item {
  font-size: 12px;
}
</style>
