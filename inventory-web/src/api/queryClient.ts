import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes stale time (instant display from cache)
      gcTime: 15 * 60 * 1000, // 15 minutes garbage collection time
      refetchOnWindowFocus: false, // Prevent unnecessary refetches when switching browser tabs
      retry: 1, // Only retry once on failure
    },
  },
});
