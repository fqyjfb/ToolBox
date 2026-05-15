import { useQuery, useMutation, type UseQueryOptions, type UseMutationOptions } from '@tanstack/react-query'
import type { ListResponse } from '../types/account'

export function useListQuery<T>(
  queryKey: string[],
  fetcher: (page: number) => Promise<ListResponse<T>>,
  options?: Omit<UseQueryOptions<ListResponse<T>>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetcher(pageParam as number ?? 1),
    ...options,
  })
}

export function useSingleQuery<T>(
  queryKey: string[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey,
    queryFn: fetcher,
    ...options,
  })
}

export function useListMutation<T, V = T>(
  mutationFn: (variables: V) => Promise<T>,
  options?: Omit<UseMutationOptions<T, unknown, V>, 'mutationFn'>
) {
  return useMutation({
    mutationFn,
    ...options,
  })
}