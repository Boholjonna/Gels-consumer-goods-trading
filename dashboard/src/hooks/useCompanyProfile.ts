import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface CompanyProfile {
  id: string;
  company_name: string | null;
  address: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  receipt_footer: string | null;
  updated_at: string | null;
}

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('company_profile')
        .select('*')
        .maybeSingle();
      if (err) throw err;
      setProfile(data as CompanyProfile | null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load company profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (data: Partial<Omit<CompanyProfile, 'id' | 'updated_at'>>) => {
    const { data: updated, error: err } = await supabase
      .from('company_profile')
      .upsert({ ...profile, ...data, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (err) throw err;
    setProfile(updated as CompanyProfile);
    return updated as CompanyProfile;
  }, [profile]);

  return { profile, loading, error, updateProfile, refetch: fetchProfile };
}
