-- ============================================================
-- Migration: Fix FK constraints and add DELETE RLS policies
-- 2026-03-13
-- ============================================================

-- ============================================================
-- A. Add DELETE RLS policies for orders, order_items, inventory_logs, products
-- (These were missing, causing silent delete failures)
-- ============================================================

-- Admins can delete orders
create policy "Admins can delete orders"
  on public.orders for delete
  using (public.is_admin());

-- Admins can delete order_items
create policy "Admins can delete order_items"
  on public.order_items for delete
  using (public.is_admin());

-- Admins can delete inventory_logs
create policy "Admins can delete inventory_logs"
  on public.inventory_logs for delete
  using (public.is_admin());

-- ============================================================
-- B. Fix FK constraint on order_items.product_id
-- Allow SET NULL on product delete so products can be removed
-- while preserving order history (product_name is already stored)
-- ============================================================

-- Drop the existing NOT NULL + FK constraint, replace with nullable FK + ON DELETE SET NULL
alter table public.order_items
  alter column product_id drop not null;

alter table public.order_items
  drop constraint order_items_product_id_fkey;

alter table public.order_items
  add constraint order_items_product_id_fkey
    foreign key (product_id) references public.products(id) on delete set null;

-- ============================================================
-- C. Fix FK constraint on inventory_logs.product_id
-- Allow CASCADE on product delete (logs are cleaned up with the product)
-- ============================================================

alter table public.inventory_logs
  drop constraint inventory_logs_product_id_fkey;

alter table public.inventory_logs
  add constraint inventory_logs_product_id_fkey
    foreign key (product_id) references public.products(id) on delete cascade;

-- ============================================================
-- D. Fix FK constraints for collector deletion
-- orders.collector_id and inventory_logs.performed_by reference profiles(id)
-- without cascade, blocking profile (and thus auth user) deletion
-- ============================================================

-- orders.collector_id: SET NULL on profile delete (preserve order history)
alter table public.orders
  alter column collector_id drop not null;

alter table public.orders
  drop constraint orders_collector_id_fkey;

alter table public.orders
  add constraint orders_collector_id_fkey
    foreign key (collector_id) references public.profiles(id) on delete set null;

-- inventory_logs.performed_by: SET NULL on profile delete
alter table public.inventory_logs
  alter column performed_by drop not null;

alter table public.inventory_logs
  drop constraint inventory_logs_performed_by_fkey;

alter table public.inventory_logs
  add constraint inventory_logs_performed_by_fkey
    foreign key (performed_by) references public.profiles(id) on delete set null;
