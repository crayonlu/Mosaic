import { toast } from '@/components/ui/Toast'

export function useToastConfirm() {
  const confirm = (title: string, onConfirm: () => void) => {
    toast.show({
      type: 'warning',
      title,
      actionLabel: '确认',
      onAction: onConfirm,
      duration: 10000,
    })
  }
  
  return { confirm }
}
