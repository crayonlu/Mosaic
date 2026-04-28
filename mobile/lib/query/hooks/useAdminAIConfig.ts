import { adminApi } from '@mosaic/api'
import { useQuery } from '@tanstack/react-query'

export function useAdminAIConfig() {
  return useQuery({
    queryKey: ['admin-ai-config'],
    queryFn: () => adminApi.getAiConfig(),
    staleTime: 60 * 1000,
  })
}
