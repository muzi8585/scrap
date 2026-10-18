import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchResource } from '../store/resourcesSlice';

// Same shape as before ({ data, error, reload }), but the data now lives in the Redux store.
// Cached data shows instantly when you come back to a screen, then it refreshes in the background.
export function useFetch<T>(path: string) {
  const dispatch = useAppDispatch();
  const entry = useAppSelector((state) => state.resources[path]);

  const reload = useCallback(async () => {
    await dispatch(fetchResource(path));
  }, [dispatch, path]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    data: (entry?.data ?? null) as T | null,
    error: entry?.error ?? '',
    reload,
  };
}
