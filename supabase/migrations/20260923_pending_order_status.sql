-- Newly created orders must use the status consumed by the admin UI and
-- cancel_unpaid_orders() scheduled job. Existing orders are left unchanged.
alter table public.orders
  alter column status set default 'pending'::text;
