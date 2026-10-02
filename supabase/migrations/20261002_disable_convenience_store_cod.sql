-- Stop new cash-on-pickup orders while retaining accurate historical orders.
-- Checkout calls create_order_with_payment() directly, so the database must
-- enforce this independently of the cart page.
create or replace function public.reject_new_convenience_store_cod_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.payment_method = 'convenience_store_cod' then
      raise exception '目前不提供超商取貨付款，請使用銀行匯款';
    end if;
  elsif new.payment_method = 'convenience_store_cod'
      and old.payment_method is distinct from new.payment_method then
    raise exception '目前不提供超商取貨付款，請使用銀行匯款';
  end if;

  return new;
end;
$$;

drop trigger if exists reject_new_convenience_store_cod_order on public.orders;
create trigger reject_new_convenience_store_cod_order
before insert or update of payment_method on public.orders
for each row execute function public.reject_new_convenience_store_cod_order();
