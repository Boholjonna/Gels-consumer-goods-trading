-- Ensure order edit from admin dashboard works reliably.
-- 1) Guarantee orders.delivery_address exists (safe/idempotent)
-- 2) Add missing admin RLS policies for order_items insert/update

alter table public.orders
add column if not exists delivery_address text;

comment on column public.orders.delivery_address is 'Custom delivery address for this order, overrides store address if set';

-- Admins need insert/update rights on order_items because OrderEditPage
-- updates existing items and can insert newly added items.
drop policy if exists "Admins can insert order_items" on public.order_items;
create policy "Admins can insert order_items"
  on public.order_items for insert
  with check (public.is_admin());

drop policy if exists "Admins can update order_items" on public.order_items;
create policy "Admins can update order_items"
  on public.order_items for update
  using (public.is_admin())
  with check (public.is_admin());
