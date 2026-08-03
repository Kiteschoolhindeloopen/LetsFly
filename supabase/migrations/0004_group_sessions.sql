-- 0004_group_sessions.sql — admin-scheduled group sessions with beginner/advanced capacity
-- Run once in Supabase SQL Editor, after 0001-0003.

create table public.group_sessions (
  id text primary key,
  starts_at text not null,
  ends_at text not null,
  beginner_capacity int not null default 0,
  advanced_capacity int not null default 0,
  status text not null check (status in ('OPEN','CANCELLED','COMPLETED')) default 'OPEN',
  created_by_admin_id uuid not null references public.profiles(id),
  notes text
);

create table public.group_session_assignments (
  id text primary key,
  group_session_id text not null references public.group_sessions(id),
  customer_id uuid not null references public.profiles(id),
  level text not null check (level in ('BEGINNER','ADVANCED')),
  seats int not null default 1,
  hour_package_purchase_id text references public.hour_package_purchases(id),
  status text not null check (status in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')) default 'CONFIRMED',
  assigned_by_admin_id uuid not null references public.profiles(id),
  created_at text not null,
  cancelled_at text
);

alter table public.group_sessions enable row level security;
alter table public.group_session_assignments enable row level security;

-- group_sessions: any authenticated user reads (customers need to see their assigned session), only admin writes
create policy "group_sessions_select_authenticated" on public.group_sessions
  for select using (auth.uid() is not null);
create policy "group_sessions_write_admin" on public.group_sessions
  for insert with check (public.is_admin(auth.uid()));
create policy "group_sessions_update_admin" on public.group_sessions
  for update using (public.is_admin(auth.uid()));

-- group_session_assignments: own rows or admin read; admin-only write (assignment is an admin action)
create policy "group_session_assignments_select_own_or_admin" on public.group_session_assignments
  for select using (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "group_session_assignments_write_admin" on public.group_session_assignments
  for insert with check (public.is_admin(auth.uid()));
create policy "group_session_assignments_update_admin" on public.group_session_assignments
  for update using (public.is_admin(auth.uid()));
