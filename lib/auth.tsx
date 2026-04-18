import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { downloadAllDataForOffline } from '@/lib/offline-cache';
import type { AuthUser } from '@/types';

const AUTH_USER_CACHE_KEY = 'auth_cached_user';

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  activate: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  activate: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setIsLoading(true);
        fetchProfile(session.user.id);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;

        // Profile not found (user was deleted) - sign out
        if (!data) {
          console.warn('Profile not found for user, signing out');
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }

        // Account deactivated - sign out
        if (!data.is_active) {
          console.warn('Account deactivated, signing out');
          await supabase.auth.signOut();
          setUser(null);
          setSession(null);
          setIsLoading(false);
          return;
        }

        setUser({
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role,
          is_active: data.is_active,
        });
        AsyncStorage.setItem(
          AUTH_USER_CACHE_KEY,
          JSON.stringify({
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            role: data.role,
            is_active: data.is_active,
          } satisfies AuthUser)
        ).catch(() => {});
        setIsLoading(false);
        // Download all data for offline use after successful login
        downloadAllDataForOffline().catch(() => {});
        return;
      } catch (error) {
        console.error(`fetchProfile attempt ${i + 1} failed:`, error);
        if (i < retries - 1) {
          await new Promise((r) => setTimeout(r, 1000));
        } else {
          const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
          const isNetworkError =
            message.includes('network request failed') ||
            message.includes('network error') ||
            message.includes('failed to fetch') ||
            message.includes('fetch') ||
            message.includes('timeout') ||
            message.includes('timed out');

          if (isNetworkError) {
            const cachedRaw = await AsyncStorage.getItem(AUTH_USER_CACHE_KEY).catch(() => null);
            if (cachedRaw) {
              const cachedUser = JSON.parse(cachedRaw) as AuthUser;
              if (cachedUser.id === userId && cachedUser.is_active) {
                setUser(cachedUser);
                setIsLoading(false);
                return;
              }
            }

            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (currentSession?.user?.id === userId) {
              setUser({
                id: userId,
                email: currentSession.user.email || '',
                full_name:
                  (typeof currentSession.user.user_metadata?.full_name === 'string' &&
                    currentSession.user.user_metadata.full_name) ||
                  currentSession.user.email ||
                  'Collector',
                role: 'collector',
                is_active: true,
              });
              setIsLoading(false);
              return;
            }
          }

          // Non-network failures keep previous safety behavior
          await supabase.auth.signOut().catch(() => {});
          setUser(null);
          setSession(null);
        }
      }
    }
    setIsLoading(false);
  }

  async function activate(code: string) {
    const { data, error } = await supabase.functions.invoke('activate', {
      body: { code: code.toUpperCase().trim() },
    });

    if (error) throw new Error(error.message || 'Activation failed');
    if (!data) throw new Error('Activation failed');

    const { token_hash, email, otp, user_id } = data;

    // Try OTP first (more reliable), fall back to token_hash
    let authError;
    if (otp && email) {
      const result = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'magiclink',
      });
      authError = result.error;
    }

    if (authError && token_hash) {
      const result = await supabase.auth.verifyOtp({
        token_hash,
        type: 'magiclink',
      });
      authError = result.error;
    }

    // Check if a session was established despite any errors
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (!currentSession && authError) {
      throw authError;
    }

    // Mark device as connected after successful auth
    if (currentSession && user_id) {
      try {
        await supabase
          .from('profiles')
          .update({ device_connected_at: new Date().toISOString() })
          .eq('id', user_id);
      } catch {}
    }
  }

  async function signOut() {
    // Capture session before clearing state
    const userId = session?.user?.id;

    // Clear local state immediately so the app reacts right away
    setUser(null);
    setSession(null);
    AsyncStorage.removeItem(AUTH_USER_CACHE_KEY).catch(() => {});

    // Mark device as disconnected before signing out (best-effort)
    if (userId) {
      try {
        await supabase
          .from('profiles')
          .update({ device_connected_at: null, last_seen_at: null })
          .eq('id', userId);
      } catch {}
    }
    // Sign out from supabase (best-effort — user is already cleared above)
    try {
      await supabase.auth.signOut();
    } catch {}
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        isAuthenticated: !!user && !!session,
        activate,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
