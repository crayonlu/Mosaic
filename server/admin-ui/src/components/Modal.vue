<template>
  <TransitionRoot :show="show" as="template">
    <Dialog :open="show" @close="onClose" class="modal-root" static>
    <TransitionChild
      enter="backdrop-enter"
      enter-from="backdrop-from"
      enter-to="backdrop-to"
      leave="backdrop-leave"
      leave-from="backdrop-to"
      leave-to="backdrop-from"
    >
      <DialogOverlay class="modal-overlay" />
    </TransitionChild>

    <div class="modal-wrapper">
      <TransitionChild
        enter="panel-enter"
        enter-from="panel-from"
        enter-to="panel-to"
        leave="panel-leave"
        leave-from="panel-to"
        leave-to="panel-from"
      >
        <DialogPanel class="modal-panel" :style="panelStyle">
          <div v-if="isMobileSheet" class="sheet-handle" />
          <DialogTitle v-if="title" class="modal-header">
            <span>{{ title }}</span>
            <button class="modal-close" @click="onClose" aria-label="关闭">
              <X :size="18" />
            </button>
          </DialogTitle>
          <div class="modal-body">
            <slot />
          </div>
          <div v-if="$slots.footer" class="modal-footer" :class="{ 'safe-bottom': isMobileSheet }">
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
import { computed, onMounted, onUnmounted, ref } from 'vue';

defineProps<{
  show: boolean;
  title?: string;
  maxWidth?: string;
  width?: string;
  closeOnOverlay?: boolean;
}>();

const emit = defineEmits<{ close: [] }>();

const viewportWidth = ref(window.innerWidth);
function onResize() { viewportWidth.value = window.innerWidth; }
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const isMobileSheet = computed(() => viewportWidth.value <= 640);

const panelStyle = computed(() => {
  if (isMobileSheet.value) return undefined;
  // eslint-disable-next-line vue/no-setup-props-reactivity-loss
  return { width: undefined, maxWidth: undefined };
});

function onClose() { emit('close'); }
</script>

<style scoped>
.modal-root { position: relative; z-index: 1000; }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.modal-wrapper {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  overflow-y: auto;
}

.modal-panel {
  position: relative;
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 560px;
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border-strong);
  margin: 8px auto 0;
  flex-shrink: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  flex-shrink: 0;
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
.modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.modal-body {
  padding: 16px 20px;
  overflow-y: auto;
  flex: 1;
  -webkit-overflow-scrolling: touch;
}

.modal-footer {
  padding: 12px 20px;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}
.modal-footer.safe-bottom {
  padding-bottom: max(12px, env(safe-area-inset-bottom, 12px));
}

/* Desktop transitions */
.backdrop-enter { transition: opacity 200ms ease-out; }
.backdrop-leave { transition: opacity 150ms ease-in; }
.backdrop-from { opacity: 0; }
.backdrop-to { opacity: 1; }

.panel-enter {
  transition: opacity 250ms ease-out, transform 250ms cubic-bezier(0.32, 0.72, 0, 1);
}
.panel-leave {
  transition: opacity 150ms ease-in, transform 150ms ease-in;
}
.panel-from {
  opacity: 0;
  transform: translateY(12px) scale(0.97);
}
.panel-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}

/* Mobile: full-width bottom sheet */
@media (max-width: 640px) {
  .modal-wrapper {
    padding: 0;
    align-items: flex-end;
    justify-content: stretch;
  }
  .modal-panel {
    max-width: 100%;
    width: 100%;
    max-height: 92vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  .modal-header { padding: 10px 16px; }
  .modal-body { padding: 12px 16px; }
  .modal-footer { padding: 10px 16px; }

  .panel-from {
    opacity: 0;
    transform: translateY(100%);
  }
  .panel-to {
    opacity: 1;
    transform: translateY(0);
  }
  .panel-enter {
    transition: opacity 280ms ease-out, transform 280ms cubic-bezier(0.32, 0.72, 0, 1);
  }
  .panel-leave {
    transition: opacity 200ms ease-in, transform 200ms ease-in;
  }
}
</style>

