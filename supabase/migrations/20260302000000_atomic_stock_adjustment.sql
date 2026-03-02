-- Atomic stock adjustment function to prevent race conditions
-- Uses SQL arithmetic instead of read-modify-write pattern

create or replace function public.adjust_product_stock(
  p_product_id uuid,
  p_change integer
)
returns void as $$
declare
  v_current_stock integer;
begin
  -- Lock the row and get current stock
  select stock_quantity into v_current_stock
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found: %', p_product_id;
  end if;

  if v_current_stock + p_change < 0 then
    raise exception 'Insufficient stock: available %, adjustment %', v_current_stock, p_change;
  end if;

  update public.products
  set stock_quantity = stock_quantity + p_change
  where id = p_product_id;
end;
$$ language plpgsql security definer;

-- Add CHECK constraint to prevent negative stock at database level
alter table public.products add constraint products_stock_non_negative check (stock_quantity >= 0);
