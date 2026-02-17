import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { resourcesApi } from '../resources'
import type { ListResourcesQuery, UploadFile } from '../types'

const DEFAULT_STALE_TIME = 5 * 60 * 1000

export function useResources(query?: ListResourcesQuery) {
  return useQuery({
    queryKey: ['resources', 'list', query],
    queryFn: () => resourcesApi.list(query),
    staleTime: DEFAULT_STALE_TIME,
  })
}

export function useResource(id: string) {
  return useQuery({
    queryKey: ['resources', id],
    queryFn: () => resourcesApi.get(id),
    staleTime: DEFAULT_STALE_TIME,
    enabled: !!id,
  })
}

export function useUploadResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ file, memoId }: { file: UploadFile; memoId: string }) =>
      resourcesApi.upload(file, memoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
  })
}

export function useDeleteResource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => resourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resources'] })
    },
  })
}
