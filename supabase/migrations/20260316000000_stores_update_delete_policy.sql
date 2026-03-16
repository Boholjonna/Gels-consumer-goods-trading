-- ============================================================
-- Migration: Add UPDATE policy for authenticated users on stores
-- Enables collectors to rename and soft-delete stores
-- 2026-03-16
-- ============================================================

create policy "Authenticated users can update stores"
  on public.stores for update
  to authenticated
  using (true)
  with check (true);
