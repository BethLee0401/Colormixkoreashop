-- Execute as one statement in the Supabase SQL Editor.
-- The final exception is intentional: it rolls back every test row.
-- Never remove the final RAISE EXCEPTION when running against production.
do $cm_flow$
declare
  v_user_id uuid := gen_random_uuid();
  v_product_id bigint;
  v_order_id bigint;
  v_result jsonb;
  v_items jsonb;
  v_stock bigint;
  v_total_stock integer;
  v_status text;
  v_payment text;
  v_cancelled integer;
  v_deducted integer;
  v_preorder boolean;
  v_count integer;
begin
  if exists (
    select 1 from public.orders
    where status in ('pending', 'pending_payment', 'payment_pending')
      and payment_last5 is null
      and payment_method = 'bank_transfer'
      and created_at <= now() - interval '24 hours'
  ) then
    raise exception 'FLOW_TEST_PRECONDITION: existing expired orders';
  end if;

  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values (
    v_user_id, 'authenticated', 'authenticated',
    'rollback+' || replace(v_user_id::text, '-', '') || '@example.invalid',
    '{}'::jsonb
  );
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);

  insert into public."Products"
    (name, price, product_type, active, stock_quantity)
  values ('[ROLLBACK FLOW TEST] inventory', 1000, 'stock', true, 5)
  returning id into v_product_id;
  insert into public.product_variants
    (product_id, size, color, stock, active)
  values (v_product_id, 'M', '黑', 5, true);

  v_items := jsonb_build_array(jsonb_build_object(
    'product_id', v_product_id, 'quantity', 2,
    'size', 'M', 'color', '黑'
  ));
  v_result := public.create_order_with_payment(
    '回滾流程測試', '0912345678', 'family', '測試門市（123456）',
    '', v_items, 'bank_transfer'
  );
  select id, status into v_order_id, v_status
  from public.orders
  where user_id = v_user_id and order_number = v_result->>'order_number';
  select stock into v_stock from public.product_variants
  where product_id = v_product_id;
  select stock_quantity into v_total_stock from public."Products"
  where id = v_product_id;
  if v_status is distinct from 'pending'
    or v_stock is distinct from 3
    or v_total_stock is distinct from 3
    or (v_result->>'total')::integer is distinct from 1760
  then
    raise exception 'FLOW_TEST_FAIL: new order status/price/stock';
  end if;

  update public.orders set created_at = now() - interval '25 hours'
  where id = v_order_id;
  v_cancelled := public.cancel_unpaid_orders();
  select status into v_status from public.orders where id = v_order_id;
  select stock into v_stock from public.product_variants
  where product_id = v_product_id;
  select stock_quantity into v_total_stock from public."Products"
  where id = v_product_id;
  select stock_deducted into v_deducted from public.order_items
  where order_id = v_order_id;
  if v_cancelled is distinct from 1
    or v_status is distinct from 'cancelled'
    or v_stock is distinct from 5
    or v_total_stock is distinct from 5
    or v_deducted is distinct from 0
  then
    raise exception 'FLOW_TEST_FAIL: 24-hour cancellation/restoration';
  end if;

  v_result := public.create_order_with_payment(
    '回滾流程測試', '0912345678', 'seven', '測試門市（123456）',
    '', v_items, 'bank_transfer'
  );
  select id into v_order_id from public.orders
  where user_id = v_user_id and order_number = v_result->>'order_number';
  insert into public.admin_users (user_id) values (v_user_id);
  if public.admin_delete_order(v_order_id) is distinct from true then
    raise exception 'FLOW_TEST_FAIL: admin delete returned false';
  end if;
  select stock into v_stock from public.product_variants
  where product_id = v_product_id;
  select stock_quantity into v_total_stock from public."Products"
  where id = v_product_id;
  if exists (select 1 from public.orders where id = v_order_id)
    or v_stock is distinct from 5
    or v_total_stock is distinct from 5
  then
    raise exception 'FLOW_TEST_FAIL: admin deletion/restoration';
  end if;

  v_items := jsonb_build_array(jsonb_build_object(
    'product_id', v_product_id, 'quantity', 1,
    'size', 'M', 'color', '黑'
  ));
  v_result := public.create_order_with_payment(
    '回滾流程測試', '0912345678', 'family', '測試門市（123456）',
    '', v_items, 'bank_transfer'
  );
  update public.orders set status = 'completed'
  where user_id = v_user_id and order_number = v_result->>'order_number';

  v_result := public.create_order_with_payment(
    '回滾流程測試', '0912345678', 'family', '測試門市（123456）',
    '', v_items, 'convenience_store_cod'
  );
  select id, payment_method into v_order_id, v_payment
  from public.orders
  where user_id = v_user_id and order_number = v_result->>'order_number';
  select stock into v_stock from public.product_variants
  where product_id = v_product_id;
  if v_payment is distinct from 'convenience_store_cod'
    or v_stock is distinct from 3
  then
    raise exception 'FLOW_TEST_FAIL: eligible COD';
  end if;

  begin
    perform public.create_order_with_payment(
      '回滾流程測試', '0912345678', 'family', '測試門市（123456）',
      '', jsonb_build_array(jsonb_build_object(
        'product_id', v_product_id, 'quantity', 10,
        'size', 'M', 'color', '黑'
      )), 'convenience_store_cod'
    );
    raise exception 'FLOW_TEST_FAIL: COD preorder was accepted';
  exception when others then
    if sqlerrm not like '%訂單含有預購商品%' then
      raise;
    end if;
  end;
  select count(*) into v_count from public.orders where user_id = v_user_id;
  select stock into v_stock from public.product_variants
  where product_id = v_product_id;
  if v_count is distinct from 3 or v_stock is distinct from 3 then
    raise exception 'FLOW_TEST_FAIL: rejected COD changed order/stock';
  end if;

  v_result := public.create_order_with_payment(
    '回滾流程測試', '0912345678', 'post', '測試郵寄地址',
    '', jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id, 'quantity', 5,
      'size', 'M', 'color', '黑'
    )), 'bank_transfer'
  );
  select id into v_order_id from public.orders
  where user_id = v_user_id and order_number = v_result->>'order_number';
  select is_preorder, stock_deducted into v_preorder, v_deducted
  from public.order_items where order_id = v_order_id;
  select stock into v_stock from public.product_variants
  where product_id = v_product_id;
  select stock_quantity into v_total_stock from public."Products"
  where id = v_product_id;
  if v_preorder is distinct from true
    or v_deducted is distinct from 3
    or v_stock is distinct from 0
    or v_total_stock is distinct from 0
    or (v_result->>'total')::integer is distinct from 4330
  then
    raise exception 'FLOW_TEST_FAIL: bank transfer preorder';
  end if;

  raise exception 'ROLLBACK_FLOW_PASS: order, price, stock, cancellation, admin restore, COD and preorder verified';
end
$cm_flow$;
