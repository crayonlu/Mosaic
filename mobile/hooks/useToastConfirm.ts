import { toast } from '@/components/ui/Toast'
import i18n from '@/lib/i18n'

export function useToastConfirm() {
  const confirm = (title: string, onConfirm: () => void) => {
    toast.show({
      type: 'warning',
      title,
      actionLabel: i18n.t('common.confirm'),
      onAction: onConfirm,
      duration: 10000,
    })
  }

  return { confirm }
}
