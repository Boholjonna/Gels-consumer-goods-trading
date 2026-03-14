-- ============================================================
-- Migration: Add carton_size to products, create daily_sales table
-- 2026-03-14
-- ============================================================

-- A. Add carton_size (pieces per case/carton) to products
alter table public.products
  add column if not exists carton_size integer;

-- B. Create daily_sales table for historical sales data import
create table if not exists public.daily_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sale_date date not null,
  units_sold integer not null default 0,
  is_duty_day boolean not null default true,
  created_at timestamptz not null default now(),
  unique(product_id, sale_date)
);

-- Indexes for forecast queries
create index if not exists idx_daily_sales_product_date
  on public.daily_sales(product_id, sale_date);

create index if not exists idx_daily_sales_date
  on public.daily_sales(sale_date);

-- Enable RLS
alter table public.daily_sales enable row level security;

-- RLS policies: admins can do everything, collectors can read
create policy "Admins can manage daily_sales"
  on public.daily_sales for all
  using (public.is_admin());

create policy "Collectors can read daily_sales"
  on public.daily_sales for select
  using (true);
