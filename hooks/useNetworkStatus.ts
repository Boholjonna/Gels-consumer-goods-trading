import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabaseUrl } from '@/lib/supabase';

const SUPABASE_HEALTH_URL = `${supabaseUrl}/rest/v1/`;

const CONSECUTIVE_FAILURES_THRESHOLD = 2;
const POLL_INTERVAL = 30000;
const TIMEOUT_MS = 8000;

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const failureCount = useRef(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handleOnline = () => { failureCount.current = 0; setIsConnected(true); };
      const handleOffline = () => setIsConnected(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      setIsConnected(navigator.onLine);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    const checkConnection = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
        // Ping Supabase REST endpoint to check connectivity
        await fetch(SUPABASE_HEALTH_URL, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeout);
        failureCount.current = 0;
        setIsConnected(true);
      } catch {
        failureCount.current += 1;
        if (failureCount.current >= CONSECUTIVE_FAILURES_THRESHOLD) {
          setIsConnected(false);
        }
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  return isConnected;
}
