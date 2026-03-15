-- Allow collectors to create multiple stores independently.
-- Removes the old branch-to-store mapping column and ensures
-- authenticated users have INSERT permission on the stores table.

-- 1. Drop the branch_id column and its index from stores
--    (branch-to-store mapping is no longer used)
drop index if exists idx_stores_branch;
alter table public.stores drop column if exists branch_id;

-- 2. Ensure the INSERT policy exists for authenticated users.
--    Guards against duplicate if the policy was already added manually.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'stores'
      and policyname = 'Authenticated users can create stores'
  ) then
    create policy "Authenticated users can create stores"
      on public.stores
      for insert
      to authenticated
      with check (true);
  end if;
end$$;
