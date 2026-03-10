-- ============================================================
-- Migration: RLS additions and company_profile table
-- 2026-03-10
-- ============================================================

-- ============================================================
-- A. Company profile table
-- ============================================================

create table if not exists public.company_profile (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  address text,
  contact_phone text,
  contact_email text,
  receipt_footer text,
  updated_at timestamptz default now()
);

create or replace function public.update_company_profile_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_company_profile_updated_at
  before update on public.company_profile
  for each row execute function public.update_company_profile_updated_at();

alter table public.company_profile enable row level security;

create policy "Authenticated users can read company profile"
  on public.company_profile for select
  using (auth.role() = 'authenticated');

create policy "Admins can manage company profile"
  on public.company_profile for all
  using (public.is_admin());

-- ============================================================
-- B. Activation codes RLS policies
-- (Table and RLS-enable already applied; no policies existed.)
-- ============================================================

create policy "Admins can read activation codes"
  on public.activation_codes for select
  using (public.is_admin());

create policy "Admins can update activation codes"
  on public.activation_codes for update
  using (public.is_admin());

create policy "Admins can insert activation codes"
  on public.activation_codes for insert
  with check (public.is_admin());
