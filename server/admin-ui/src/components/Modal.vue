<template>
  <TransitionRoot :show="show" as="template">
    <Dialog :open="show" @close="onClose" class="modal-root" static>
    <!-- backdrop -->
    <TransitionChild
      enter="transition-backdrop"
      enter-from="opacity-0"
      enter-to="opacity-100"
      leave="transition-backdrop-leave"
      leave-from="opacity-100"
      leave-to="opacity-0"
    >
      <DialogOverlay class="modal-overlay" />
    </TransitionChild>

    <!-- panel -->
    <div class="modal-wrapper">
      <TransitionChild
        enter="transition-panel"
        enter-from="panel-enter"
        enter-to="panel-done"
        leave="transition-panel-leave"
        leave-from="panel-done"
        leave-to="panel-enter"
      >
        <DialogPanel class="modal-panel" :style="{ maxWidth: maxWidth }">
          <DialogTitle v-if="title" class="modal-header">
            <span>{{ title }}</span>
            <button class="modal-close" @click="onClose" aria-label="关闭">
              <X :size="18" />
            </button>
          </DialogTitle>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </DialogPanel>
      </TransitionChild>
    </div>
  </Dialog>
  </TransitionRoot>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogOverlay,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from '@headlessui/vue';
import { X } from 'lucide-vue-next';

const props = defineProps<{
  show: boolean;
  title?: string;
  maxWidth?: string;
  closeOnOverlay?: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

function onClose() {
  emit('close');
}
</script>

<style scoped>
/* ─── Root ─── */
.modal-root {
  position: relative;
  z-index: 1000;
}

/* ─── Overlay (backdrop) ─── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px);
}

/* ─── Wrapper (centers the panel) ─── */
.modal-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

/* ─── Panel ─── */
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

/* ─── Transitions ─── */
.transition-backdrop {
  transition: opacity 200ms ease-out;
}
.transition-backdrop-leave {
  transition: opacity 150ms ease-in;
}
.opacity-0 { opacity: 0; }
.opacity-100 { opacity: 1; }

.transition-panel {
  transition: opacity 200ms ease-out, transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1);
}
.transition-panel-leave {
  transition: opacity 120ms ease-in, transform 120ms ease-in;
}
.panel-enter {
  opacity: 0;
  transform: translateY(16px) scale(0.97);
}
.panel-done {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* ─── Mobile ─── */
@media (max-width: 480px) {
  .modal-wrapper {
    padding: 8px;
    align-items: flex-end;
  }
  .modal-panel {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    max-height: 90vh;
  }
  .modal-header { padding: 12px 16px; }
  .modal-body { padding: 16px; }
  .modal-footer { padding: 10px 16px; }
}
</style>

