-- Limit the total number of units in an order, across all product variants.
-- Keep this check in the database because checkout calls Supabase directly.
create or replace function public.enforce_order_item_limit_15()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_quantity bigint;
begin
  if new.quantity is null or new.quantity < 1 then
    raise exception '商品數量必須至少 1 件';
  end if;

  -- Serialize changes to the same order before checking its total.
  perform 1 from public.orders where id = new.order_id for update;

  select coalesce(sum(quantity), 0) into existing_quantity
  from public.order_items
  where order_id = new.order_id;

  if tg_op = 'UPDATE' then
    if old.order_id = new.order_id then
      existing_quantity := existing_quantity - old.quantity;
    end if;
  end if;

  if existing_quantity + new.quantity > 15 then
    raise exception '購物車最多 15 件';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_order_item_limit_15 on public.order_items;
create trigger enforce_order_item_limit_15
before insert or update of quantity, order_id on public.order_items
for each row execute function public.enforce_order_item_limit_15();
