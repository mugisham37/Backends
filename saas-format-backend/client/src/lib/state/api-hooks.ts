import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query"
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api"
import { toast } from "@/components/ui/use-toast"

// Generic type for API response
type ApiResponse<T> = {
  data: T
  status: string
  message?: string
}

// Generic hook for GET requests
export function useApiQuery<T>(
  queryKey: string | string[],
  url: string,
  options?: UseQueryOptions<T, Error, T, string | string[]>,
) {
  const queryKeyArray = Array.isArray(queryKey) ? queryKey : [queryKey]

  return useQuery<T, Error, T, string | string[]>({
    queryKey: queryKeyArray,
    queryFn: async () => {
      try {
        return await apiGet<T>(url)
      } catch (error) {
        throw error
      }
    },
    ...options,
  })
}

// Generic hook for POST requests
export function useApiMutation<T, V>(url: string, options?: UseMutationOptions<T, Error, V, unknown>) {
  const queryClient = useQueryClient()

  return useMutation<T, Error, V, unknown>({
    mutationFn: async (variables: V) => {
      try {
        return await apiPost<T>(url, variables)
      } catch (error) {
        throw error
      }
    },
    onSuccess: (data, variables, context) => {
      options?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      })
      options?.onError?.(error, variables, context)
    },
    ...options,
  })
}

// Generic hook for PUT requests
export function useApiPutMutation<T, V>(url: string, options?: UseMutationOptions<T, Error, V, unknown>) {
  const queryClient = useQueryClient()

  return useMutation<T, Error, V, unknown>({
    mutationFn: async (variables: V) => {
      try {
        return await apiPut<T>(url, variables)
      } catch (error) {
        throw error
      }
    },
    onSuccess: (data, variables, context) => {
      options?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      })
      options?.onError?.(error, variables, context)
    },
    ...options,
  })
}

// Generic hook for DELETE requests
export function useApiDeleteMutation<T>(url: string, options?: UseMutationOptions<T, Error, void, unknown>) {
  const queryClient = useQueryClient()

  return useMutation<T, Error, void, unknown>({
    mutationFn: async () => {
      try {
        return await apiDelete<T>(url)
      } catch (error) {
        throw error
      }
    },
    onSuccess: (data, variables, context) => {
      options?.onSuccess?.(data, variables, context)
    },
    onError: (error, variables, context) => {
      toast({
        title: "Error",
        description: error.message || "An error occurred",
        variant: "destructive",
      })
      options?.onError?.(error, variables, context)
    },
    ...options,
  })
}

// Specialized hooks for common operations

// User hooks
export function useCurrentUser(options?: UseQueryOptions<any, Error, any, ["currentUser"]>) {
  return useApiQuery<any>(["currentUser"], "/users/me", {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

// Team hooks
export function useTeams(options?: UseQueryOptions<any[], Error, any[], ["teams"]>) {
  return useApiQuery<any[]>(["teams"], "/teams", {
    staleTime: 2 * 60 * 1000, // 2 minutes
    ...options,
  })
}

export function useTeam(teamId: string, options?: UseQueryOptions<any, Error, any, ["team", string]>) {
  return useApiQuery<any>(["team", teamId], `/teams/${teamId}`, {
    enabled: !!teamId,
    ...options,
  })
}

// Project hooks
export function useProjects(options?: UseQueryOptions<any[], Error, any[], ["projects"]>) {
  return useApiQuery<any[]>(["projects"], "/projects", {
    staleTime: 60 * 1000, // 1 minute
    ...options,
  })
}

export function useProject(projectId: string, options?: UseQueryOptions<any, Error, any, ["project", string]>) {
  return useApiQuery<any>(["project", projectId], `/projects/${projectId}`, {
    enabled: !!projectId,
    ...options,
  })
}

// Task hooks
export function useTasks(projectId: string, options?: UseQueryOptions<any[], Error, any[], ["tasks", string]>) {
  return useApiQuery<any[]>(["tasks", projectId], `/projects/${projectId}/tasks`, {
    enabled: !!projectId,
    ...options,
  })
}

export function useTask(
  projectId: string,
  taskId: string,
  options?: UseQueryOptions<any, Error, any, ["task", string, string]>,
) {
  return useApiQuery<any>(["task", projectId, taskId], `/projects/${projectId}/tasks/${taskId}`, {
    enabled: !!projectId && !!taskId,
    ...options,
  })
}

// Subscription hooks
export function useCurrentSubscription(options?: UseQueryOptions<any, Error, any, ["subscription"]>) {
  return useApiQuery<any>(["subscription"], "/billing/subscriptions/current", {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

export function usePlans(options?: UseQueryOptions<any[], Error, any[], ["plans"]>) {
  return useApiQuery<any[]>(["plans"], "/billing/plans", {
    staleTime: 60 * 60 * 1000, // 1 hour
    ...options,
  })
}

// Analytics hooks
export function useAnalyticsDashboard(
  period = "30d",
  options?: UseQueryOptions<any, Error, any, ["analytics", "dashboard", string]>,
) {
  return useApiQuery<any>(["analytics", "dashboard", period], `/analytics/dashboard?period=${period}`, {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

// Feature flag hooks
export function useFeatureFlags(options?: UseQueryOptions<any[], Error, any[], ["featureFlags"]>) {
  return useApiQuery<any[]>(["featureFlags"], "/feature-flags", {
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  })
}

export function useFeatureFlag(flagKey: string, options?: UseQueryOptions<any, Error, any, ["featureFlag", string]>) {
  return useApiQuery<any>(["featureFlag", flagKey], `/feature-flags/${flagKey}`, {
    enabled: !!flagKey,
    ...options,
  })
}
