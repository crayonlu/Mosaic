<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click.self="onOverlayClick">
        <div class="modal-panel" :style="{ maxWidth: maxWidth }">
          <div class="modal-header">
            <h3 class="modal-title">{{ title }}</h3>
            <button class="modal-close" @click="emit('close')" aria-label="关闭">
              <X :size="18" />
            </button>
          </div>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from 'lucide-vue-next';

defineProps<{
  show: boolean;
  title: string;
  maxWidth?: string;
  closeOnOverlay?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onOverlayClick() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: var(--bg-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  backdrop-filter: blur(4px);
}

.modal-panel {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}
.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

/* ─── Transition ─── */
.modal-enter-active { transition: all 200ms ease-out; }
.modal-leave-active { transition: all 150ms ease-in; }
.modal-enter-from { opacity: 0; }
.modal-enter-from .modal-panel { transform: scale(0.96); }
.modal-leave-to { opacity: 0; }
.modal-leave-to .modal-panel { transform: scale(0.96); }

@media (max-width: 480px) {
  .modal-overlay { padding: 8px; align-items: flex-end; }
  .modal-panel {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 90vh;
  }
  .modal-header { padding: 12px 16px; }
  .modal-body { padding: 16px; }
  .modal-footer { padding: 10px 16px; }
}
</style>
