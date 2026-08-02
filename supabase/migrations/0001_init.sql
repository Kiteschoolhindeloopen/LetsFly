-- 0001_init.sql — schema + new-user trigger
-- Run once in Supabase SQL Editor, before 0002_seed.sql.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('CUSTOMER','INSTRUCTOR','ADMIN')) default 'CUSTOMER',
  name text not null default '',
  phone text,
  is_iko_instructor boolean not null default false
);

create table public.course_offerings (
  id text primary key,
  name text not null,
  category text not null check (category in ('GROUP_CAMP','PRIVATE_HOURS')),
  description text not null default '',
  duration_hours numeric,
  min_group_size int,
  max_group_size int,
  package_hours numeric,
  price_cents int not null,
  price_per_hour_cents int,
  includes_equipment boolean not null default false,
  includes_iko boolean not null default false,
  active boolean not null default true
);

create table public.availability_windows (
  id text primary key,
  starts_at text not null,
  ends_at text not null,
  course_category text check (course_category in ('GROUP_CAMP','PRIVATE_HOURS')),
  status text not null check (status in ('OPEN','CLAIMED','FULL')) default 'OPEN',
  created_by_admin_id uuid not null references public.profiles(id)
);

create table public.slots (
  id text primary key,
  course_offering_id text not null references public.course_offerings(id),
  availability_window_id text references public.availability_windows(id),
  instructor_id uuid references public.profiles(id),
  starts_at text not null,
  ends_at text not null,
  capacity int not null default 1,
  booked_count int not null default 0,
  price_cents_override int,
  status text not null check (status in ('OPEN','BOOKED','CANCELLED','COMPLETED')) default 'OPEN'
);

create table public.hour_package_purchases (
  id text primary key,
  customer_id uuid not null references public.profiles(id),
  course_offering_id text not null references public.course_offerings(id),
  total_hours numeric not null,
  hours_scheduled numeric not null default 0,
  hours_completed numeric not null default 0,
  purchased_at text not null,
  expires_at text
);

create table public.bookings (
  id text primary key,
  customer_id uuid not null references public.profiles(id),
  slot_id text not null references public.slots(id),
  hour_package_purchase_id text references public.hour_package_purchases(id),
  seats int not null default 1,
  status text not null check (status in ('CONFIRMED','CANCELLED','COMPLETED','NO_SHOW')) default 'CONFIRMED',
  price_cents_paid int,
  payment_status text not null default 'UNPAID',
  notes text,
  rating int,
  created_at text not null,
  cancelled_at text,
  waiver_accepted_at text
);

create table public.videos (
  id text primary key,
  title text not null,
  category text not null,
  duration text not null,
  image text not null,
  description text not null
);

create table public.watched_videos (
  customer_id uuid not null references public.profiles(id),
  video_id text not null references public.videos(id),
  primary key (customer_id, video_id)
);

create table public.notifications (
  id text primary key,
  customer_id uuid not null references public.profiles(id),
  icon text not null,
  title text not null,
  message text not null,
  time text not null,
  unread boolean not null default true
);

create table public.instructor_slot_requests (
  id text primary key,
  instructor_id uuid not null references public.profiles(id),
  course_offering_id text not null references public.course_offerings(id),
  requested_starts_at text not null,
  requested_ends_at text not null,
  status text not null check (status in ('PENDING','APPROVED','REJECTED')) default 'PENDING',
  admin_note text,
  resolved_at text,
  resolved_by_admin_id uuid references public.profiles(id),
  resulting_slot_id text references public.slots(id),
  created_at text not null,
  updated_at text not null
);

create table public.package_requests (
  id text primary key,
  customer_id uuid not null references public.profiles(id),
  customer_email text not null,
  course_offering_id text not null references public.course_offerings(id),
  requested_date text not null,
  proposed_date text,
  note text,
  status text not null check (status in ('PENDING','APPROVED','REJECTED','DATE_PROPOSED')) default 'PENDING',
  admin_note text,
  resolved_at text,
  created_at text not null
);

-- Auto-create a profiles row (default role CUSTOMER) whenever a new
-- auth.users row appears (i.e. whenever an account is created in the
-- Supabase Dashboard). SECURITY DEFINER so it can write to public.profiles
-- despite RLS (added in 0001 part 2).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, name)
  values (new.id, new.email, 'CUSTOMER', coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: SECURITY DEFINER helper avoids infinite recursion when a policy on
-- `profiles` itself needs to check whether the caller is an admin — a plain
-- subquery on profiles from within a profiles policy would recurse into the
-- same policy check.
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = uid and role = 'ADMIN'
  );
$$;

alter table public.profiles enable row level security;
alter table public.course_offerings enable row level security;
alter table public.availability_windows enable row level security;
alter table public.slots enable row level security;
alter table public.hour_package_purchases enable row level security;
alter table public.bookings enable row level security;
alter table public.videos enable row level security;
alter table public.watched_videos enable row level security;
alter table public.notifications enable row level security;
alter table public.instructor_slot_requests enable row level security;
alter table public.package_requests enable row level security;

-- profiles: own row, or admin sees/writes all
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_select_related" on public.profiles
  for select using (
    id = auth.uid()
    or public.is_admin(auth.uid())
    or exists (
      select 1 from public.bookings b
      join public.slots s on s.id = b.slot_id
      where (b.customer_id = auth.uid() and s.instructor_id = profiles.id)
         or (s.instructor_id = auth.uid() and b.customer_id = profiles.id)
    )
  );
create policy "profiles_update_admin_only" on public.profiles
  for update using (public.is_admin(auth.uid()));

-- course_offerings: any authenticated user reads, only admin writes
create policy "courses_select_authenticated" on public.course_offerings
  for select using (auth.uid() is not null);
create policy "courses_write_admin" on public.course_offerings
  for insert with check (public.is_admin(auth.uid()));
create policy "courses_update_admin" on public.course_offerings
  for update using (public.is_admin(auth.uid()));
create policy "courses_delete_admin" on public.course_offerings
  for delete using (public.is_admin(auth.uid()));

-- availability_windows: any authenticated user reads, only admin writes
create policy "windows_select_authenticated" on public.availability_windows
  for select using (auth.uid() is not null);
create policy "windows_write_admin" on public.availability_windows
  for insert with check (public.is_admin(auth.uid()));
create policy "windows_update_admin" on public.availability_windows
  for update using (public.is_admin(auth.uid()));

-- videos: any authenticated user reads, only admin writes
create policy "videos_select_authenticated" on public.videos
  for select using (auth.uid() is not null);
create policy "videos_write_admin" on public.videos
  for insert with check (public.is_admin(auth.uid()));

-- slots: any authenticated user reads; instructor claims/updates own; admin all
create policy "slots_select_authenticated" on public.slots
  for select using (auth.uid() is not null);
create policy "slots_insert_admin_or_customer" on public.slots
  for insert with check (auth.uid() is not null);
create policy "slots_update_own_instructor_or_admin" on public.slots
  for update using (
    instructor_id = auth.uid()
    or instructor_id is null
    or public.is_admin(auth.uid())
  )
  with check (
    instructor_id = auth.uid()
    or public.is_admin(auth.uid())
    or instructor_id is not distinct from (select s.instructor_id from public.slots s where s.id = slots.id)
  );

-- hour_package_purchases: own rows, admin all
create policy "packages_select_own_or_admin" on public.hour_package_purchases
  for select using (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "packages_insert_own_or_admin" on public.hour_package_purchases
  for insert with check (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "packages_update_own_or_admin" on public.hour_package_purchases
  for update using (customer_id = auth.uid() or public.is_admin(auth.uid()));

-- bookings: own rows, admin all
create policy "bookings_select_own_or_admin" on public.bookings
  for select using (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "bookings_select_instructor" on public.bookings
  for select using (
    exists (
      select 1 from public.slots s
      where s.id = bookings.slot_id and s.instructor_id = auth.uid()
    )
  );
create policy "bookings_insert_own" on public.bookings
  for insert with check (customer_id = auth.uid());
create policy "bookings_update_own_or_admin" on public.bookings
  for update using (customer_id = auth.uid() or public.is_admin(auth.uid()));

-- watched_videos: own rows only
create policy "watched_select_own" on public.watched_videos
  for select using (customer_id = auth.uid());
create policy "watched_insert_own" on public.watched_videos
  for insert with check (customer_id = auth.uid());
create policy "watched_update_own" on public.watched_videos
  for update using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- notifications: own rows, admin all (admin creates notifications for customers)
create policy "notifications_select_own_or_admin" on public.notifications
  for select using (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "notifications_insert_own_or_admin" on public.notifications
  for insert with check (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "notifications_update_own_or_admin" on public.notifications
  for update using (customer_id = auth.uid() or public.is_admin(auth.uid()));

-- instructor_slot_requests: own rows for instructor, admin all
create policy "instr_requests_select_own_or_admin" on public.instructor_slot_requests
  for select using (instructor_id = auth.uid() or public.is_admin(auth.uid()));
create policy "instr_requests_insert_own" on public.instructor_slot_requests
  for insert with check (instructor_id = auth.uid());
create policy "instr_requests_update_admin" on public.instructor_slot_requests
  for update using (public.is_admin(auth.uid()));

-- package_requests: own rows for customer, admin all
create policy "pkg_requests_select_own_or_admin" on public.package_requests
  for select using (customer_id = auth.uid() or public.is_admin(auth.uid()));
create policy "pkg_requests_insert_own" on public.package_requests
  for insert with check (customer_id = auth.uid());
create policy "pkg_requests_update_own_or_admin" on public.package_requests
  for update using (customer_id = auth.uid() or public.is_admin(auth.uid()));
