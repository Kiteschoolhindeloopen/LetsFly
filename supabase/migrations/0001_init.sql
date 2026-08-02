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
