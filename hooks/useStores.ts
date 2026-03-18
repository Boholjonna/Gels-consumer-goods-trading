import { useState, useEffect, useCallback } from 'react';
import { getStores } from '@/services/stores.service';
import { getCachedStores, cacheStores } from '@/lib/offline-cache';
import type { Store } from '@/types';

export function useStores() {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStores();
      setStores(data);
      cacheStores(data);
    } catch {
      const cached = await getCachedStores();
      if (cached && cached.length > 0) {
        setStores(cached);
        setError(null);
      } else {
        setError('No internet connection and no cached stores available');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { stores, loading, error, refetch: fetch };
}
