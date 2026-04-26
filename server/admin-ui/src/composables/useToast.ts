import { ref } from 'vue';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  createdAt: number;
}

const toasts = ref<ToastItem[]>([]);
let nextId = 0;

const DURATION = 3500;

function addToast(message: string, type: ToastItem['type']) {
  const id = nextId++;
  toasts.value.push({ id, message, type, createdAt: Date.now() });
  setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, DURATION);
}

export function useToast() {
  const success = (msg: string) => addToast(msg, 'success');
  const error = (msg: string) => addToast(msg, 'error');
  const warning = (msg: string) => addToast(msg, 'warning');
  const info = (msg: string) => addToast(msg, 'info');

  return { toasts, success, error, warning, info };
}
