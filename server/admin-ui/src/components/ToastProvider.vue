<template>
  <Teleport to="body">
    <TransitionGroup name="toast" tag="div" class="toast-container">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast-item"
        :class="'toast-' + t.type"
      >
        <div class="toast-icon">
          <CheckCircle v-if="t.type === 'success'" :size="16" />
          <XCircle v-else-if="t.type === 'error'" :size="16" />
          <AlertTriangle v-else-if="t.type === 'warning'" :size="16" />
          <Info v-else :size="16" />
        </div>
        <span class="toast-msg">{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-vue-next';
import { useToast } from '../composables/useToast';

const { toasts } = useToast();
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
  max-width: 360px;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background: var(--bg-surface);
  box-shadow: var(--shadow-md);
  font-size: 13px;
  line-height: 1.4;
  pointer-events: auto;
  border: 1px solid var(--border);
  transition: all var(--transition-normal);
}
.toast-icon {
  flex-shrink: 0;
  display: flex;
}

.toast-success { border-left: 3px solid var(--success); }
.toast-success .toast-icon { color: var(--success); }
.toast-error   { border-left: 3px solid var(--error); }
.toast-error .toast-icon   { color: var(--error); }
.toast-warning { border-left: 3px solid var(--warning); }
.toast-warning .toast-icon { color: var(--warning); }
.toast-info    { border-left: 3px solid var(--info); }
.toast-info .toast-icon    { color: var(--info); }

/* ─── Transition ─── */
.toast-enter-active { transition: all 250ms ease-out; }
.toast-leave-active { transition: all 200ms ease-in; }
.toast-enter-from { opacity: 0; transform: translateX(40px); }
.toast-leave-to   { opacity: 0; transform: translateX(40px); }

@media (max-width: 480px) {
  .toast-container { left: 8px; right: 8px; top: 8px; max-width: none; }
  .toast-item { padding: 10px 12px; font-size: 12px; }
}
</style>
