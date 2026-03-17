-- Create order_events table
create table if not exists public.order_events (
  id uuid default gen_random_uuid() primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (
    event_type in (
      'ORDER_PLACED',
      'PAYMENT_SUCCESS',
      'SHIPPED',
      'OUT_FOR_DELIVERY',
      'DELIVERED',
      'RETURN_REQUESTED',
      'RETURN_APPROVED',
      'RETURN_REJECTED',
      'RETURN_COMPLETED',
      'EXCHANGE_REQUESTED',
      'EXCHANGE_APPROVED',
      'EXCHANGE_REJECTED',
      'EXCHANGE_COMPLETED',
      'LOW_STOCK_ALERT'
    )
  ),
  description text,
  created_at timestamptz default now()
);

-- Create notifications table
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  type text not null,
  message text not null,
  is_read boolean default false,
  reference_id uuid,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.order_events enable row level security;
alter table public.notifications enable row level security;

-- order_events policies
-- Users can read only their own events
create policy if not exists "order_events_select_own"
on public.order_events
for select
to authenticated
using (user_id = auth.uid());

-- notifications policies
-- No authenticated user access directly; service role bypasses RLS for admin backend.
create policy if not exists "notifications_no_direct_select"
on public.notifications
for select
to authenticated
using (false);

create policy if not exists "notifications_no_direct_insert"
on public.notifications
for insert
to authenticated
with check (false);
