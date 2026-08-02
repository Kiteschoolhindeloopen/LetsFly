# Supabase-Integration: echte Auth + Datenmigration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock repository + fake email-only login with real Supabase Auth (email+password) and Postgres-backed data, with RLS-enforced role access for Kunde/Lehrer/Admin, without changing any page/component beyond auth wiring.

**Architecture:** `Repository` interface (`src/lib/data/repository.ts`) stays the seam; a new `supabaseRepository` implementation replaces `mockRepository` as the only active implementation. Auth uses Supabase Auth with a client-side `AuthGuard` per role area (RLS in Postgres is the real security boundary, not the UI check — see spec). No `proxy.ts`/server-side session handling in this pass.

**Tech Stack:** Next.js 16.2 (App Router, `"use client"`-heavy), `@supabase/supabase-js`, `@supabase/ssr` (browser client only), Postgres/Supabase, existing Tailwind UI (unchanged).

**Spec:** `docs/superpowers/specs/2026-08-02-supabase-auth-integration-design.md`

## Global Constraints

- UI/page components must not change except for auth-related call sites explicitly listed in this plan (per AGENTS.md: "Seiten/Komponenten sollen dabei unverändert bleiben").
- No public self-signup anywhere; accounts are created manually in the Supabase Dashboard (per user decision).
- RLS must be enabled on every new table before the app is considered done (per user decision).
- No `middleware.ts` — this Next.js version (16.2.12) uses `proxy.ts` instead, and this plan does not use either (client-side `AuthGuard` only, per spec's architecture decision).
- Admin-role checks in RLS policies must go through the `is_admin(uid)` `SECURITY DEFINER` function, never a direct subquery on `profiles` from within a `profiles` policy (causes infinite recursion — see spec).
- Keep `mockRepository` and `demoSession.ts`'s replacement pattern intact as reference code where noted; don't delete `mock/` files (only stop using them via `getRepository()`).
- Every SQL file must be idempotent-safe to read (plain `create table`, no `if not exists` needed since these run once each against a fresh project) but must be run in order: `0001_init.sql` before `0002_seed.sql`.

---

## Part A — Database (Supabase Dashboard SQL Editor)

### Task 1: Dependencies & Supabase client setup

**Files:**
- Modify: `package.json`
- Create: `src/lib/supabase/client.ts`
- Create: `.env.local` (gitignored, not committed)
- Create: `.env.example`

**Interfaces:**
- Produces: `supabase` (singleton `SupabaseClient`) exported from `src/lib/supabase/client.ts`, consumed by every later task that talks to Supabase.

- [ ] **Step 1: Install dependencies**

Run: `npm install @supabase/supabase-js @supabase/ssr`

- [ ] **Step 2: Create `.env.local`** (gitignored already via `.env*` in `.gitignore`)

```
NEXT_PUBLIC_SUPABASE_URL=https://yxjnqifafflmhcknmazu.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4am5xaWZhZmZsbWhja25tYXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1ODUyOTYsImV4cCI6MjEwMTE2MTI5Nn0.RM7rrPAEf92_1Lm6keBzPeZzPycgAC_UYVHCoXdDoyc
```

- [ ] **Step 3: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 4: Write `src/lib/supabase/client.ts`**

```ts
import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase-Konfiguration fehlt. NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local setzen (siehe .env.example)."
  );
}

export const supabase = createBrowserClient(url, anonKey);
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/supabase/client.ts .env.example
git commit -m "feat: add Supabase client dependencies and browser client"
```

(`.env.local` is gitignored — do not add it.)

---

### Task 2: Database schema (`supabase/migrations/0001_init.sql`, part 1 — tables + trigger)

This file is run manually by the user in the Supabase Dashboard SQL Editor (Project → SQL Editor → New query). No Supabase CLI is installed locally, so this plan treats SQL files as source-of-truth documents the user pastes in, not an automated migration runner.

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `profiles`, `course_offerings`, `availability_windows`, `slots`, `hour_package_purchases`, `bookings`, `videos`, `watched_videos`, `notifications`, `instructor_slot_requests`, `package_requests`; function `handle_new_user()`; trigger `on_auth_user_created`. Consumed by every `supabaseRepository` task (5–9) and by Task 3 (RLS).

Design note: all date/time columns are `text`, not `timestamptz`. The existing app already treats every date as an opaque ISO string (`Slot.startsAt: string`, formatted via `src/lib/format.ts`) — using `text` avoids introducing timezone-conversion behavior that doesn't exist in the mock today, keeping this a mechanical migration rather than a date-handling rewrite.

- [ ] **Step 1: Write `supabase/migrations/0001_init.sql`**

```sql
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
```

- [ ] **Step 2: Run it**

In the Supabase Dashboard: Project → SQL Editor → New query → paste the file content → Run. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify tables exist**

In SQL Editor, run: `select table_name from information_schema.tables where table_schema = 'public' order by 1;`
Expected: all 11 table names listed above.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add Supabase schema migration (tables + new-user trigger)"
```

---

### Task 3: Row-Level Security (`supabase/migrations/0001_init.sql`, part 2 — appended)

**Files:**
- Modify: `supabase/migrations/0001_init.sql` (append to the same file, per spec: RLS lives in the same migration as the schema it protects)

**Interfaces:**
- Consumes: tables from Task 2.
- Produces: `is_admin(uid uuid)` function, RLS enabled + policies on all 11 tables. Consumed by every `supabaseRepository` task implicitly (queries will fail/return empty without this).

- [ ] **Step 1: Append RLS to `supabase/migrations/0001_init.sql`**

```sql

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
create policy "profiles_update_own_or_admin" on public.profiles
  for update using (id = auth.uid() or public.is_admin(auth.uid()));

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
create policy "bookings_insert_own" on public.bookings
  for insert with check (customer_id = auth.uid());
create policy "bookings_update_own_or_admin" on public.bookings
  for update using (customer_id = auth.uid() or public.is_admin(auth.uid()));

-- watched_videos: own rows only
create policy "watched_select_own" on public.watched_videos
  for select using (customer_id = auth.uid());
create policy "watched_insert_own" on public.watched_videos
  for insert with check (customer_id = auth.uid());

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
```

- [ ] **Step 2: Run it**

Paste the appended section (or the whole file again) into the SQL Editor and run. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify RLS is on**

Run: `select tablename, rowsecurity from pg_tables where schemaname = 'public' order by 1;`
Expected: `rowsecurity = true` for all 11 tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "feat: add RLS policies for role-scoped Supabase data access"
```

---

### Task 4: Seed data (`supabase/migrations/0002_seed.sql`)

Only data with no user reference — `seedCourses`, `seedVideos`, `seedAvailabilityWindows` from `src/lib/data/mock/seed.ts`. `seedWindows` references `created_by_admin_id: "user-admin"`, which doesn't exist as a real uuid yet — this table's seed row is deferred to Task 15 (after the admin account exists). This file covers courses and videos only.

**Files:**
- Create: `supabase/migrations/0002_seed.sql`

**Interfaces:**
- Consumes: `course_offerings`, `videos` tables from Task 2.

- [ ] **Step 1: Write `supabase/migrations/0002_seed.sql`**

```sql
-- 0002_seed.sql — role-independent seed data (courses, videos).
-- availability_windows/slots/bookings seed data that reference specific
-- users is handled separately in Task 15, after those accounts exist.

insert into public.course_offerings
  (id, name, category, description, duration_hours, min_group_size, max_group_size, package_hours, price_cents, price_per_hour_cents, includes_equipment, includes_iko, active)
values
  ('course-camp-2day', '2 Tage Anfänger Kitecamp', 'GROUP_CAMP', '12h Unterricht + 2h Theorie, Gruppe 2-4 Personen.', 14, 2, 4, null, 24000, null, true, true, true),
  ('course-camp-4day', '4 Tage Intensiv Kitecamp', 'GROUP_CAMP', '20-24h Wasserzeit + tägliche Theorie.', null, 2, 4, null, 44000, null, true, true, true),
  ('course-camp-5day', '5 Tage Kitecamp Woche', 'GROUP_CAMP', '25-30h Wasserzeit.', null, 2, 4, null, 55000, null, true, true, true),
  ('course-private-beginner', 'Privatstunden Beginner', 'PRIVATE_HOURS', '3h Stundenpaket.', null, null, null, 3, 21000, 7000, true, true, true),
  ('course-private-intermediate', 'Privatstunden Intermediate', 'PRIVATE_HOURS', '9h Stundenpaket.', null, null, null, 9, 56700, 6300, true, true, true),
  ('course-private-intensive', 'Privatstunden Intensive', 'PRIVATE_HOURS', '15h Stundenpaket.', null, null, null, 15, 84000, 5600, true, true, true);

insert into public.videos (id, title, category, duration, image, description) values
  ('video-1', 'Kite-Check vor dem Start', 'Sicherheit & Material', '6:12', 'https://kiteschoolhindeloopen.com/images/bg-3.webp', 'So prüfst du Leinen, Aufhängung und Sicherheitssystem vor jeder Session – die wichtigste Routine, bevor du überhaupt ins Wasser gehst.'),
  ('video-2', 'Trapez richtig anlegen', 'Sicherheit & Material', '3:40', 'https://kiteschoolhindeloopen.com/images/kite2.webp', 'Sitzhöhe, Hakenposition und Quick-Release im Detail erklärt.'),
  ('video-3', 'Der erste Wasserstart', 'Wasserstart', '3:20', 'https://kiteschoolhindeloopen.com/images/kite1.webp', 'Board anschnallen, Kite in Startposition, Timing für den Zug – Schritt für Schritt zum sauberen Wasserstart.'),
  ('video-4', 'Wasserstart: Häufige Fehler', 'Wasserstart', '4:25', 'https://kiteschoolhindeloopen.com/images/kitesurf-bg.webp', 'Die typischen Anfängerfehler beim Wasserstart und wie du sie vermeidest.'),
  ('video-5', 'Bodydrag upwind', 'Bodydrag', '2:36', 'https://kiteschoolhindeloopen.com/images/kitesurf-bg.webp', 'Mit dem Kite gegen den Wind schwimmen – die Grundlage, um dein Board zurückzuholen.'),
  ('video-6', 'Bodydrag mit Board', 'Bodydrag', '3:12', 'https://kiteschoolhindeloopen.com/images/kite2.webp', 'Das Board vor dir herziehen, bevor du es anschnallst.'),
  ('video-7', 'Erste Meter fahren', 'Erste Fahrversuche', '6:37', 'https://kiteschoolhindeloopen.com/images/kite3.webp', 'Kantendruck aufbauen und die ersten stehenden Meter auf dem Board.'),
  ('video-8', 'Höhe laufen (Upwind)', 'Erste Fahrversuche', '5:48', 'https://kiteschoolhindeloopen.com/images/kite1.webp', 'So verlierst du beim Fahren keinen Weg mehr gegen den Wind.'),
  ('video-9', 'Erster Jump', 'Tricks & Fortgeschritten', '3:56', 'https://kiteschoolhindeloopen.com/images/bg-4.webp', 'Anlauf, Kitesteuerung und Landung für deinen ersten kontrollierten Sprung.'),
  ('video-10', 'Toeside fahren', 'Tricks & Fortgeschritten', '3:46', 'https://kiteschoolhindeloopen.com/images/kite3.webp', 'Die Fahrtrichtung wechseln und sicher auf der Zehenkante fahren.'),
  ('video-11', 'Windfenster verstehen', 'Wind- & Wetterkunde', '3:58', 'https://kiteschoolhindeloopen.com/images/bg-5.webp', 'Wie das Windfenster aufgebaut ist und warum Position im Fenster über Zug entscheidet.'),
  ('video-12', 'Wettervorhersage lesen', 'Wind- & Wetterkunde', '4:18', 'https://kiteschoolhindeloopen.com/images/bg-5.webp', 'Welche Vorhersage-Apps wir nutzen und worauf du für sichere Bedingungen achtest.');
```

- [ ] **Step 2: Run it**

Paste into SQL Editor, run. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify**

Run: `select count(*) from public.course_offerings;` → expect `6`.
Run: `select count(*) from public.videos;` → expect `12`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_seed.sql
git commit -m "feat: seed courses and videos into Supabase"
```

---

## Part B — `supabaseRepository` (mechanical translation of `mockRepository`)

Each task below adds standalone, fully-typed async functions in `src/lib/data/supabase/`. They are composed into the `Repository` object in Task 9 — until then, `mockRepository` stays the active implementation (`getRepository()` isn't touched until Task 9), so the app keeps working throughout Tasks 5–8.

### Task 5: Row mappers + courses + availability/slots

**Files:**
- Create: `src/lib/data/supabase/mappers.ts`
- Create: `src/lib/data/supabase/courses.ts`
- Create: `src/lib/data/supabase/availability.ts`

**Interfaces:**
- Consumes: `supabase` client (Task 1), tables `course_offerings`, `availability_windows`, `slots` (Task 2/3).
- Produces: `mapCourse`, `mapWindow`, `mapSlot` (from `mappers.ts`); `getCourses`, `getAllCourses`, `updateCourse` (from `courses.ts`); `getSlots`, `getAvailabilityWindows`, `getMySlots`, `claimSlot`, `createWindow` (from `availability.ts`). Consumed by Task 9 (composition).

- [ ] **Step 1: Write `src/lib/data/supabase/mappers.ts`**

```ts
import type {
  AvailabilityWindow,
  Booking,
  CourseOffering,
  HourPackagePurchase,
  InstructorSlotRequest,
  Notification,
  PackageRequest,
  Slot,
  User,
  Video,
} from "../types";

export interface ProfileRow {
  id: string;
  email: string;
  role: "CUSTOMER" | "INSTRUCTOR" | "ADMIN";
  name: string;
  phone: string | null;
  is_iko_instructor: boolean;
}

export interface CourseRow {
  id: string;
  name: string;
  category: "GROUP_CAMP" | "PRIVATE_HOURS";
  description: string;
  duration_hours: number | null;
  min_group_size: number | null;
  max_group_size: number | null;
  package_hours: number | null;
  price_cents: number;
  price_per_hour_cents: number | null;
  includes_equipment: boolean;
  includes_iko: boolean;
  active: boolean;
}

export interface WindowRow {
  id: string;
  starts_at: string;
  ends_at: string;
  course_category: "GROUP_CAMP" | "PRIVATE_HOURS" | null;
  status: "OPEN" | "CLAIMED" | "FULL";
  created_by_admin_id: string;
}

export interface SlotRow {
  id: string;
  course_offering_id: string;
  availability_window_id: string | null;
  instructor_id: string | null;
  starts_at: string;
  ends_at: string;
  capacity: number;
  booked_count: number;
  price_cents_override: number | null;
  status: "OPEN" | "BOOKED" | "CANCELLED" | "COMPLETED";
}

export interface BookingRow {
  id: string;
  customer_id: string;
  slot_id: string;
  hour_package_purchase_id: string | null;
  seats: number;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  price_cents_paid: number | null;
  payment_status: string;
  notes: string | null;
  rating: number | null;
  created_at: string;
  cancelled_at: string | null;
  waiver_accepted_at: string | null;
}

export interface PackageRow {
  id: string;
  customer_id: string;
  course_offering_id: string;
  total_hours: number;
  hours_scheduled: number;
  hours_completed: number;
  purchased_at: string;
  expires_at: string | null;
}

export interface VideoRow {
  id: string;
  title: string;
  category: Video["category"];
  duration: string;
  image: string;
  description: string;
}

export interface NotificationRow {
  id: string;
  customer_id: string;
  icon: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
}

export interface InstructorRequestRow {
  id: string;
  instructor_id: string;
  course_offering_id: string;
  requested_starts_at: string;
  requested_ends_at: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by_admin_id: string | null;
  resulting_slot_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PackageRequestRow {
  id: string;
  customer_id: string;
  customer_email: string;
  course_offering_id: string;
  requested_date: string;
  proposed_date: string | null;
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "DATE_PROPOSED";
  admin_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    phone: row.phone ?? undefined,
    isIkoInstructor: row.is_iko_instructor ?? undefined,
  };
}

export function mapCourse(row: CourseRow): CourseOffering {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    durationHours: row.duration_hours ?? undefined,
    minGroupSize: row.min_group_size ?? undefined,
    maxGroupSize: row.max_group_size ?? undefined,
    packageHours: row.package_hours ?? undefined,
    priceCents: row.price_cents,
    pricePerHourCents: row.price_per_hour_cents ?? undefined,
    includesEquipment: row.includes_equipment,
    includesIko: row.includes_iko,
    active: row.active,
  };
}

export function mapWindow(row: WindowRow): AvailabilityWindow {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    courseCategory: row.course_category ?? undefined,
    status: row.status,
    createdByAdminId: row.created_by_admin_id,
  };
}

export function mapSlot(row: SlotRow): Slot {
  return {
    id: row.id,
    courseOfferingId: row.course_offering_id,
    availabilityWindowId: row.availability_window_id ?? undefined,
    instructorId: row.instructor_id ?? undefined,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity,
    bookedCount: row.booked_count,
    priceCentsOverride: row.price_cents_override ?? undefined,
    status: row.status,
  };
}

export function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id,
    customerId: row.customer_id,
    slotId: row.slot_id,
    hourPackagePurchaseId: row.hour_package_purchase_id ?? undefined,
    seats: row.seats,
    status: row.status,
    priceCentsPaid: row.price_cents_paid ?? undefined,
    paymentStatus: row.payment_status,
    notes: row.notes ?? undefined,
    rating: row.rating ?? undefined,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at ?? undefined,
    waiverAcceptedAt: row.waiver_accepted_at ?? undefined,
  };
}

export function mapPackage(row: PackageRow): HourPackagePurchase {
  return {
    id: row.id,
    customerId: row.customer_id,
    courseOfferingId: row.course_offering_id,
    totalHours: row.total_hours,
    hoursScheduled: row.hours_scheduled,
    hoursCompleted: row.hours_completed,
    purchasedAt: row.purchased_at,
    expiresAt: row.expires_at ?? undefined,
  };
}

export function mapVideo(row: VideoRow): Video {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    duration: row.duration,
    image: row.image,
    description: row.description,
  };
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    customerId: row.customer_id,
    icon: row.icon,
    title: row.title,
    message: row.message,
    time: row.time,
    unread: row.unread,
  };
}

export function mapInstructorRequest(row: InstructorRequestRow): InstructorSlotRequest {
  return {
    id: row.id,
    instructorId: row.instructor_id,
    courseOfferingId: row.course_offering_id,
    requestedStartsAt: row.requested_starts_at,
    requestedEndsAt: row.requested_ends_at,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedByAdminId: row.resolved_by_admin_id ?? undefined,
    resultingSlotId: row.resulting_slot_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPackageRequest(row: PackageRequestRow): PackageRequest {
  return {
    id: row.id,
    customerId: row.customer_id,
    customerEmail: row.customer_email,
    courseOfferingId: row.course_offering_id,
    requestedDate: row.requested_date,
    proposedDate: row.proposed_date ?? undefined,
    note: row.note ?? undefined,
    status: row.status,
    adminNote: row.admin_note ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    createdAt: row.created_at,
  };
}
```

- [ ] **Step 2: Write `src/lib/data/supabase/courses.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import type { CourseOffering } from "../types";
import { mapCourse, type CourseRow } from "./mappers";

export async function getCourses(): Promise<CourseOffering[]> {
  const { data, error } = await supabase
    .from("course_offerings")
    .select("*")
    .eq("active", true);
  if (error) throw error;
  return (data as CourseRow[]).map(mapCourse);
}

export async function getAllCourses(): Promise<CourseOffering[]> {
  const { data, error } = await supabase.from("course_offerings").select("*");
  if (error) throw error;
  return (data as CourseRow[]).map(mapCourse);
}

export async function updateCourse(
  courseId: string,
  updates: Partial<Pick<CourseOffering, "name" | "priceCents" | "active">>
): Promise<CourseOffering> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.priceCents !== undefined) payload.price_cents = updates.priceCents;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase
    .from("course_offerings")
    .update(payload)
    .eq("id", courseId)
    .select()
    .single();
  if (error) throw error;
  return mapCourse(data as CourseRow);
}
```

- [ ] **Step 3: Write `src/lib/data/supabase/availability.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { AvailabilityWindow, Slot } from "../types";
import type { CreateWindowInput, SlotFilter } from "../repository";
import { mapSlot, mapWindow, type SlotRow, type WindowRow } from "./mappers";
import { getAllCourses } from "./courses";

export async function getSlots(filter?: SlotFilter): Promise<Slot[]> {
  let query = supabase.from("slots").select("*");
  if (filter?.from) query = query.gte("starts_at", filter.from);
  if (filter?.to) query = query.lte("starts_at", filter.to);
  const { data, error } = await query;
  if (error) throw error;
  let slots = (data as SlotRow[]).map(mapSlot);

  if (filter?.category) {
    const courses = await getAllCourses();
    const courseIds = new Set(
      courses.filter((c) => c.category === filter.category).map((c) => c.id)
    );
    slots = slots.filter((s) => courseIds.has(s.courseOfferingId));
  }
  return slots;
}

export async function getAvailabilityWindows(): Promise<AvailabilityWindow[]> {
  const { data, error } = await supabase.from("availability_windows").select("*");
  if (error) throw error;
  return (data as WindowRow[]).map(mapWindow);
}

export async function getMySlots(instructorId: string): Promise<Slot[]> {
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("instructor_id", instructorId);
  if (error) throw error;
  return (data as SlotRow[]).map(mapSlot);
}

export async function claimSlot(slotId: string, instructorId: string): Promise<Slot> {
  const { data: existing, error: fetchError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", slotId)
    .single();
  if (fetchError) throw fetchError;
  const slot = existing as SlotRow;
  if (slot.instructor_id) throw new Error("Slot ist bereits einem Lehrer zugeteilt");
  if (slot.status !== "OPEN") throw new Error("Slot ist nicht mehr offen");

  const { data, error } = await supabase
    .from("slots")
    .update({ instructor_id: instructorId })
    .eq("id", slotId)
    .select()
    .single();
  if (error) throw error;
  return mapSlot(data as SlotRow);
}

export async function createWindow(input: CreateWindowInput): Promise<AvailabilityWindow> {
  const windowId = newId("window");
  const { data: windowData, error: windowError } = await supabase
    .from("availability_windows")
    .insert({
      id: windowId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      course_category: input.courseCategory ?? null,
      status: "OPEN",
      created_by_admin_id: input.createdByAdminId,
    })
    .select()
    .single();
  if (windowError) throw windowError;
  const window = mapWindow(windowData as WindowRow);

  const allCourses = await getAllCourses();
  const coursesForWindow = allCourses.filter(
    (c) => c.active && (!input.courseCategory || c.category === input.courseCategory)
  );
  const newSlots = coursesForWindow.map((course) => {
    if (course.category === "GROUP_CAMP") {
      return {
        id: newId("slot"),
        course_offering_id: course.id,
        availability_window_id: window.id,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        capacity: course.maxGroupSize ?? 4,
        booked_count: 0,
        status: "OPEN" as const,
      };
    }
    const slotEnd = new Date(window.startsAt);
    slotEnd.setHours(slotEnd.getHours() + 2);
    return {
      id: newId("slot"),
      course_offering_id: course.id,
      availability_window_id: window.id,
      starts_at: window.startsAt,
      ends_at: slotEnd.toISOString(),
      capacity: 1,
      booked_count: 0,
      status: "OPEN" as const,
    };
  });

  if (newSlots.length > 0) {
    const { error: slotsError } = await supabase.from("slots").insert(newSlots);
    if (slotsError) throw slotsError;
  }

  return window;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/supabase/mappers.ts src/lib/data/supabase/courses.ts src/lib/data/supabase/availability.ts
git commit -m "feat: add Supabase-backed course and availability/slot queries"
```

---

### Task 6: Bookings & hour packages

**Files:**
- Create: `src/lib/data/supabase/bookings.ts`

**Interfaces:**
- Consumes: `mapBooking`, `mapPackage`, `mapSlot` (Task 5's `mappers.ts`), `newId` (`../mock/storage`).
- Produces: `getMyBookings`, `getMyPackages`, `createBooking`, `bookHourSlot`, `cancelBooking`, `getAllBookings`, `rateBooking`. Consumed by Task 9.

- [ ] **Step 1: Write `src/lib/data/supabase/bookings.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { Booking, HourPackagePurchase } from "../types";
import type { BookHourSlotInput, CreateBookingInput } from "../repository";
import { mapBooking, mapPackage, type BookingRow, type PackageRow, type SlotRow } from "./mappers";

export async function getMyBookings(customerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as BookingRow[]).map(mapBooking);
}

export async function getMyPackages(customerId: string): Promise<HourPackagePurchase[]> {
  const { data, error } = await supabase
    .from("hour_package_purchases")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as PackageRow[]).map(mapPackage);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  if (!input.waiverAccepted) {
    throw new Error("Haftungsausschluss muss akzeptiert werden, bevor gebucht werden kann.");
  }
  const { data: slotData, error: slotError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", input.slotId)
    .single();
  if (slotError) throw slotError;
  const slot = slotData as SlotRow;
  const seats = input.seats ?? 1;
  if (slot.booked_count + seats > slot.capacity) {
    throw new Error("Slot ist bereits ausgebucht");
  }

  const newBookedCount = slot.booked_count + seats;
  const { error: updateSlotError } = await supabase
    .from("slots")
    .update({
      booked_count: newBookedCount,
      status: newBookedCount >= slot.capacity ? "BOOKED" : "OPEN",
    })
    .eq("id", slot.id);
  if (updateSlotError) throw updateSlotError;

  const bookingId = newId("booking");
  const nowIso = new Date().toISOString();
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      id: bookingId,
      customer_id: input.customerId,
      slot_id: input.slotId,
      hour_package_purchase_id: input.hourPackagePurchaseId ?? null,
      seats,
      status: "CONFIRMED",
      payment_status: "UNPAID",
      notes: input.notes ?? null,
      created_at: nowIso,
      waiver_accepted_at: nowIso,
    })
    .select()
    .single();
  if (bookingError) throw bookingError;

  if (input.hourPackagePurchaseId) {
    const { data: pkgData, error: pkgFetchError } = await supabase
      .from("hour_package_purchases")
      .select("hours_scheduled")
      .eq("id", input.hourPackagePurchaseId)
      .single();
    if (pkgFetchError) throw pkgFetchError;
    const currentScheduled = (pkgData as { hours_scheduled: number }).hours_scheduled;
    const { error: pkgUpdateError } = await supabase
      .from("hour_package_purchases")
      .update({ hours_scheduled: currentScheduled + seats })
      .eq("id", input.hourPackagePurchaseId);
    if (pkgUpdateError) throw pkgUpdateError;
  }

  return mapBooking(bookingData as BookingRow);
}

export async function bookHourSlot(input: BookHourSlotInput): Promise<Booking> {
  if (!input.waiverAccepted) {
    throw new Error("Haftungsausschluss muss akzeptiert werden, bevor gebucht werden kann.");
  }
  const { data: existingSlots, error: findError } = await supabase
    .from("slots")
    .select("*")
    .eq("course_offering_id", input.courseOfferingId)
    .eq("starts_at", input.startsAt);
  if (findError) throw findError;
  let slot = (existingSlots as SlotRow[])[0];

  if (!slot) {
    const { data: created, error: createError } = await supabase
      .from("slots")
      .insert({
        id: newId("slot"),
        course_offering_id: input.courseOfferingId,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        capacity: 1,
        booked_count: 0,
        status: "OPEN",
      })
      .select()
      .single();
    if (createError) throw createError;
    slot = created as SlotRow;
  } else if (slot.booked_count >= slot.capacity) {
    throw new Error("Dieser Termin ist bereits vergeben");
  }

  return createBooking({
    customerId: input.customerId,
    slotId: slot.id,
    hourPackagePurchaseId: input.hourPackagePurchaseId,
    waiverAccepted: input.waiverAccepted,
  });
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const { data: bookingData, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (fetchError) throw fetchError;
  const booking = bookingData as BookingRow;

  const { error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (cancelError) throw cancelError;

  const { data: slotData, error: slotError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", booking.slot_id)
    .single();
  if (!slotError && slotData) {
    const slot = slotData as SlotRow;
    const bookedCount = Math.max(0, slot.booked_count - booking.seats);
    await supabase.from("slots").update({ booked_count: bookedCount, status: "OPEN" }).eq("id", slot.id);
  }

  if (booking.hour_package_purchase_id) {
    const { data: pkgData } = await supabase
      .from("hour_package_purchases")
      .select("hours_scheduled")
      .eq("id", booking.hour_package_purchase_id)
      .single();
    if (pkgData) {
      const hoursScheduled = Math.max(0, (pkgData as { hours_scheduled: number }).hours_scheduled - booking.seats);
      await supabase
        .from("hour_package_purchases")
        .update({ hours_scheduled: hoursScheduled })
        .eq("id", booking.hour_package_purchase_id);
    }
  }
}

export async function getAllBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from("bookings").select("*");
  if (error) throw error;
  return (data as BookingRow[]).map(mapBooking);
}

export async function rateBooking(bookingId: string, rating: number): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .update({ rating })
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return mapBooking(data as BookingRow);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/supabase/bookings.ts
git commit -m "feat: add Supabase-backed booking and hour-package queries"
```

---

### Task 7: Instructor slot requests

**Files:**
- Create: `src/lib/data/supabase/instructorRequests.ts`

**Interfaces:**
- Consumes: `mapInstructorRequest`, `mapSlot` (Task 5), `newId` (`../mock/storage`).
- Produces: `createInstructorRequest`, `getMyRequests`, `getAllRequests`, `resolveRequest`. Consumed by Task 9.

- [ ] **Step 1: Write `src/lib/data/supabase/instructorRequests.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { InstructorSlotRequest, RequestStatus } from "../types";
import type { CreateInstructorRequestInput } from "../repository";
import { mapInstructorRequest, type InstructorRequestRow } from "./mappers";

export async function createInstructorRequest(
  input: CreateInstructorRequestInput
): Promise<InstructorSlotRequest> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("instructor_slot_requests")
    .insert({
      id: newId("request"),
      instructor_id: input.instructorId,
      course_offering_id: input.courseOfferingId,
      requested_starts_at: input.requestedStartsAt,
      requested_ends_at: input.requestedEndsAt,
      status: "PENDING",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();
  if (error) throw error;
  return mapInstructorRequest(data as InstructorRequestRow);
}

export async function getMyRequests(instructorId: string): Promise<InstructorSlotRequest[]> {
  const { data, error } = await supabase
    .from("instructor_slot_requests")
    .select("*")
    .eq("instructor_id", instructorId);
  if (error) throw error;
  return (data as InstructorRequestRow[]).map(mapInstructorRequest);
}

export async function getAllRequests(status?: RequestStatus): Promise<InstructorSlotRequest[]> {
  let query = supabase.from("instructor_slot_requests").select("*");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as InstructorRequestRow[]).map(mapInstructorRequest);
}

export async function resolveRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  adminNote?: string
): Promise<InstructorSlotRequest> {
  const { data: requestData, error: fetchError } = await supabase
    .from("instructor_slot_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (fetchError) throw fetchError;
  const request = requestData as InstructorRequestRow;

  let resultingSlotId: string | undefined;
  if (decision === "APPROVED") {
    const { data: slotData, error: slotError } = await supabase
      .from("slots")
      .insert({
        id: newId("slot"),
        course_offering_id: request.course_offering_id,
        instructor_id: request.instructor_id,
        starts_at: request.requested_starts_at,
        ends_at: request.requested_ends_at,
        capacity: 1,
        booked_count: 0,
        status: "OPEN",
      })
      .select()
      .single();
    if (slotError) throw slotError;
    resultingSlotId = (slotData as { id: string }).id;
  }

  const { data, error } = await supabase
    .from("instructor_slot_requests")
    .update({
      status: decision,
      admin_note: adminNote ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resulting_slot_id: resultingSlotId ?? null,
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return mapInstructorRequest(data as InstructorRequestRow);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/supabase/instructorRequests.ts
git commit -m "feat: add Supabase-backed instructor slot request queries"
```

---

### Task 8: Videos, notifications, users

**Files:**
- Create: `src/lib/data/supabase/videos.ts`
- Create: `src/lib/data/supabase/notifications.ts`
- Create: `src/lib/data/supabase/users.ts`

**Interfaces:**
- Consumes: `mapVideo`, `mapNotification`, `mapProfile` (Task 5).
- Produces: `getVideos`, `getWatchedVideoIds`, `markVideoWatched` (`videos.ts`); `getNotifications`, `markNotificationRead`, `markAllNotificationsRead`, `createNotification` (`notifications.ts`); `getCustomer`, `getUserByEmail`, `getInstructors` (`users.ts`). Consumed by Task 9.

- [ ] **Step 1: Write `src/lib/data/supabase/videos.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import type { Video } from "../types";
import { mapVideo, type VideoRow } from "./mappers";

export async function getVideos(): Promise<Video[]> {
  const { data, error } = await supabase.from("videos").select("*");
  if (error) throw error;
  return (data as VideoRow[]).map(mapVideo);
}

export async function getWatchedVideoIds(customerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("watched_videos")
    .select("video_id")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as { video_id: string }[]).map((row) => row.video_id);
}

export async function markVideoWatched(customerId: string, videoId: string): Promise<void> {
  const { error } = await supabase
    .from("watched_videos")
    .upsert({ customer_id: customerId, video_id: videoId }, { onConflict: "customer_id,video_id" });
  if (error) throw error;
}
```

- [ ] **Step 2: Write `src/lib/data/supabase/notifications.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { Notification } from "../types";
import { mapNotification, type NotificationRow } from "./mappers";

export async function getNotifications(customerId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("customer_id", customerId)
    .order("id", { ascending: false });
  if (error) throw error;
  return (data as NotificationRow[]).map(mapNotification);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ unread: false })
    .eq("id", notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead(customerId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ unread: false })
    .eq("customer_id", customerId);
  if (error) throw error;
}

export async function createNotification(input: {
  customerId: string;
  icon: string;
  title: string;
  message: string;
}): Promise<Notification> {
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      id: newId("notif"),
      customer_id: input.customerId,
      icon: input.icon,
      title: input.title,
      message: input.message,
      time: "Gerade eben",
      unread: true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapNotification(data as NotificationRow);
}
```

- [ ] **Step 3: Write `src/lib/data/supabase/users.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import type { User } from "../types";
import { mapProfile, type ProfileRow } from "./mappers";

export async function getCustomer(id: string): Promise<User | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function getInstructors(): Promise<User[]> {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "INSTRUCTOR");
  if (error) throw error;
  return (data as ProfileRow[]).map(mapProfile);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/supabase/videos.ts src/lib/data/supabase/notifications.ts src/lib/data/supabase/users.ts
git commit -m "feat: add Supabase-backed video, notification, and user queries"
```

---

### Task 9: Package requests + composition + `getRepository()` swap

**Files:**
- Create: `src/lib/data/supabase/packageRequests.ts`
- Create: `src/lib/data/supabase/supabaseRepository.ts`
- Modify: `src/lib/data/repository.ts:141-143` (the `getRepository()` function)

**Interfaces:**
- Consumes: every function produced by Tasks 5–8, plus this task's `packageRequests.ts`.
- Produces: `supabaseRepository: Repository`, wired as the return value of `getRepository()`. This is what every page in Part C consumes indirectly via `getRepository()`.

- [ ] **Step 1: Write `src/lib/data/supabase/packageRequests.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { PackageRequest, PackageRequestStatus } from "../types";
import type { CreatePackageRequestInput } from "../repository";
import { mapPackageRequest, mapProfile, type PackageRequestRow, type ProfileRow } from "./mappers";
import { createNotification } from "./notifications";

export async function createPackageRequest(input: CreatePackageRequestInput): Promise<PackageRequest> {
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", input.customerId)
    .maybeSingle();
  const customerEmail = profileData ? mapProfile(profileData as ProfileRow).email : "";

  const { data, error } = await supabase
    .from("package_requests")
    .insert({
      id: newId("pkgreq"),
      customer_id: input.customerId,
      customer_email: customerEmail,
      course_offering_id: input.courseOfferingId,
      requested_date: input.requestedDate,
      note: input.note ?? null,
      status: "PENDING",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapPackageRequest(data as PackageRequestRow);
}

export async function getMyPackageRequests(customerId: string): Promise<PackageRequest[]> {
  const { data, error } = await supabase
    .from("package_requests")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as PackageRequestRow[]).map(mapPackageRequest);
}

export async function getAllPackageRequests(status?: PackageRequestStatus): Promise<PackageRequest[]> {
  let query = supabase.from("package_requests").select("*");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as PackageRequestRow[]).map(mapPackageRequest);
}

export async function resolvePackageRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  adminNote?: string
): Promise<PackageRequest> {
  const { data, error } = await supabase
    .from("package_requests")
    .update({
      status: decision,
      admin_note: adminNote ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  const updated = mapPackageRequest(data as PackageRequestRow);

  await createNotification({
    customerId: updated.customerId,
    icon: decision === "APPROVED" ? "✅" : "❌",
    title: decision === "APPROVED" ? "Anfrage bestätigt" : "Anfrage abgelehnt",
    message:
      decision === "APPROVED"
        ? `Deine Anfrage für ${new Date(updated.requestedDate).toLocaleDateString("de-DE")} wurde bestätigt.`
        : `Deine Anfrage für ${new Date(updated.requestedDate).toLocaleDateString("de-DE")} wurde leider abgelehnt.`,
  });
  return updated;
}

export async function proposeAlternativeDate(
  requestId: string,
  proposedDate: string,
  adminNote?: string
): Promise<PackageRequest> {
  const { data, error } = await supabase
    .from("package_requests")
    .update({ status: "DATE_PROPOSED", proposed_date: proposedDate, admin_note: adminNote ?? null })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  const updated = mapPackageRequest(data as PackageRequestRow);

  await createNotification({
    customerId: updated.customerId,
    icon: "🗓️",
    title: "Neuer Terminvorschlag",
    message: `Die Schule schlägt für deine Anfrage den ${new Date(proposedDate).toLocaleDateString("de-DE")} vor.`,
  });
  return updated;
}

export async function respondToProposedDate(requestId: string, accept: boolean): Promise<PackageRequest> {
  const { data: requestData, error: fetchError } = await supabase
    .from("package_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (fetchError) throw fetchError;
  const request = requestData as PackageRequestRow;

  const { data, error } = await supabase
    .from("package_requests")
    .update({
      status: accept ? "APPROVED" : "REJECTED",
      requested_date: accept && request.proposed_date ? request.proposed_date : request.requested_date,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return mapPackageRequest(data as PackageRequestRow);
}
```

- [ ] **Step 2: Write `src/lib/data/supabase/supabaseRepository.ts`**

```ts
import type { Repository } from "../repository";
import * as courses from "./courses";
import * as availability from "./availability";
import * as bookings from "./bookings";
import * as instructorRequests from "./instructorRequests";
import * as videos from "./videos";
import * as notifications from "./notifications";
import * as users from "./users";
import * as packageRequests from "./packageRequests";

export const supabaseRepository: Repository = {
  getCourses: courses.getCourses,
  getAllCourses: courses.getAllCourses,
  updateCourse: courses.updateCourse,

  getSlots: availability.getSlots,
  getAvailabilityWindows: availability.getAvailabilityWindows,
  getMySlots: availability.getMySlots,
  claimSlot: availability.claimSlot,
  createWindow: availability.createWindow,

  getCustomer: users.getCustomer,
  getUserByEmail: users.getUserByEmail,
  getInstructors: users.getInstructors,

  getMyBookings: bookings.getMyBookings,
  getMyPackages: bookings.getMyPackages,
  createBooking: bookings.createBooking,
  bookHourSlot: bookings.bookHourSlot,
  cancelBooking: bookings.cancelBooking,
  getAllBookings: bookings.getAllBookings,
  rateBooking: bookings.rateBooking,

  createInstructorRequest: instructorRequests.createInstructorRequest,
  getMyRequests: instructorRequests.getMyRequests,
  getAllRequests: instructorRequests.getAllRequests,
  resolveRequest: instructorRequests.resolveRequest,

  getVideos: videos.getVideos,
  getWatchedVideoIds: videos.getWatchedVideoIds,
  markVideoWatched: videos.markVideoWatched,

  getNotifications: notifications.getNotifications,
  markNotificationRead: notifications.markNotificationRead,
  markAllNotificationsRead: notifications.markAllNotificationsRead,
  createNotification: notifications.createNotification,

  createPackageRequest: packageRequests.createPackageRequest,
  getMyPackageRequests: packageRequests.getMyPackageRequests,
  getAllPackageRequests: packageRequests.getAllPackageRequests,
  resolvePackageRequest: packageRequests.resolvePackageRequest,
  proposeAlternativeDate: packageRequests.proposeAlternativeDate,
  respondToProposedDate: packageRequests.respondToProposedDate,
};
```

- [ ] **Step 3: Swap `getRepository()`**

In `src/lib/data/repository.ts`, replace:

```ts
export function getRepository(): Repository {
  return mockRepository;
}
```

with:

```ts
export function getRepository(): Repository {
  return supabaseRepository;
}
```

And replace the top import line `import { mockRepository } from "./mock/mockRepository";` with `import { supabaseRepository } from "./supabase/supabaseRepository";`.

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors (this is the point where TS checks that `supabaseRepository` fully satisfies `Repository` — any missing/mistyped method surfaces here).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/supabase/packageRequests.ts src/lib/data/supabase/supabaseRepository.ts src/lib/data/repository.ts
git commit -m "feat: compose supabaseRepository and switch getRepository() to it"
```

---

## Part C — Auth & UI wiring

### Task 10: Auth session module + context + hook

**Files:**
- Create: `src/lib/auth/session.ts`
- Create: `src/lib/auth/AuthContext.tsx`
- Create: `src/lib/auth/roleRoutes.ts`

**Interfaces:**
- Consumes: `supabase` client (Task 1), `profiles` table.
- Produces: `getCurrentProfile()`, `signOut()` (`session.ts`); `AuthProvider`, `useAuthUser()` (`AuthContext.tsx`); `ROLE_ROUTES` (`roleRoutes.ts`). Consumed by Task 11 (`AuthGuard`), Task 12 (login page), Task 13 (page rewiring).

- [ ] **Step 1: Write `src/lib/auth/roleRoutes.ts`**

```ts
import type { Role } from "@/lib/data/repository";

export const ROLE_ROUTES: Record<Role, string> = {
  CUSTOMER: "/dashboard",
  INSTRUCTOR: "/instructor",
  ADMIN: "/admin",
};
```

- [ ] **Step 2: Write `src/lib/auth/session.ts`**

```ts
import { supabase } from "@/lib/supabase/client";
import type { User } from "@/lib/data/repository";

export async function getCurrentProfile(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    name: data.name,
    phone: data.phone ?? undefined,
    isIkoInstructor: data.is_iko_instructor ?? undefined,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
```

- [ ] **Step 3: Write `src/lib/auth/AuthContext.tsx`**

```tsx
"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/data/repository";

const AuthContext = createContext<User | null>(null);

export function AuthProvider({ user, children }: { user: User; children: React.ReactNode }) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuthUser(): User {
  const user = useContext(AuthContext);
  if (!user) {
    throw new Error("useAuthUser() must be used within an <AuthGuard>/<AuthProvider> tree");
  }
  return user;
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/session.ts src/lib/auth/AuthContext.tsx src/lib/auth/roleRoutes.ts
git commit -m "feat: add Supabase session lookup, auth context, and role routes"
```

---

### Task 11: `AuthGuard` component + per-role layouts

**Files:**
- Create: `src/components/AuthGuard.tsx`
- Create: `src/app/dashboard/layout.tsx`
- Create: `src/app/book/layout.tsx`
- Create: `src/app/videos/layout.tsx`
- Create: `src/app/requests/layout.tsx`
- Create: `src/app/profile/layout.tsx`
- Create: `src/app/instructor/layout.tsx`
- Create: `src/app/admin/layout.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile` (Task 10 `session.ts`), `AuthProvider` (Task 10 `AuthContext.tsx`), `ROLE_ROUTES` (Task 10 `roleRoutes.ts`).
- Produces: `<AuthGuard role={...}>` used by all 7 layouts. Every page under these 7 routes can now call `useAuthUser()` (Task 13).

- [ ] **Step 1: Write `src/components/AuthGuard.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/session";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ROLE_ROUTES } from "@/lib/auth/roleRoutes";
import type { Role, User } from "@/lib/data/repository";

export function AuthGuard({ role, children }: { role: Role; children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null | "loading">("loading");

  useEffect(() => {
    let cancelled = false;
    getCurrentProfile().then((profile) => {
      if (cancelled) return;
      if (!profile) {
        router.replace("/");
        return;
      }
      if (profile.role !== role) {
        router.replace(ROLE_ROUTES[profile.role]);
        return;
      }
      setUser(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [role, router]);

  if (user === "loading" || user === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-sm text-lf-muted">
        Lädt…
      </div>
    );
  }

  return <AuthProvider user={user}>{children}</AuthProvider>;
}
```

- [ ] **Step 2: Write the 5 customer-area layouts**

`src/app/dashboard/layout.tsx`, `src/app/book/layout.tsx`, `src/app/videos/layout.tsx`, `src/app/requests/layout.tsx`, `src/app/profile/layout.tsx` — identical content, each:

```tsx
import { AuthGuard } from "@/components/AuthGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role="CUSTOMER">{children}</AuthGuard>;
}
```

- [ ] **Step 3: Write `src/app/instructor/layout.tsx`**

```tsx
import { AuthGuard } from "@/components/AuthGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role="INSTRUCTOR">{children}</AuthGuard>;
}
```

- [ ] **Step 4: Write `src/app/admin/layout.tsx`**

```tsx
import { AuthGuard } from "@/components/AuthGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthGuard role="ADMIN">{children}</AuthGuard>;
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/AuthGuard.tsx src/app/dashboard/layout.tsx src/app/book/layout.tsx src/app/videos/layout.tsx src/app/requests/layout.tsx src/app/profile/layout.tsx src/app/instructor/layout.tsx src/app/admin/layout.tsx
git commit -m "feat: add AuthGuard and role-scoped layouts for customer/instructor/admin areas"
```

---

### Task 12: Login page rewrite

**Files:**
- Modify: `src/app/page.tsx` (full rewrite of the login form logic)

**Interfaces:**
- Consumes: `supabase` (Task 1), `getCurrentProfile` (Task 10), `ROLE_ROUTES` (Task 10).

- [ ] **Step 1: Replace `src/app/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getCurrentProfile } from "@/lib/auth/session";
import { ROLE_ROUTES } from "@/lib/auth/roleRoutes";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError("E-Mail oder Passwort falsch.");
      setSubmitting(false);
      return;
    }

    const profile = await getCurrentProfile();
    setSubmitting(false);
    if (!profile) {
      setError("Kein Profil für diesen Account gefunden. Bitte an die Schule wenden.");
      return;
    }
    router.push(ROLE_ROUTES[profile.role]);
  }

  return (
    <div className="flex flex-1 flex-col bg-gradient-to-b from-lf-ocean-light to-lf-card">
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl bg-white shadow-lg shadow-lf-ocean/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/red-waves.png"
            alt="LetsFly Logo"
            className="h-[78%] w-[78%] object-contain"
          />
        </div>
        <h1 className="text-[28px] font-extrabold tracking-tight text-foreground">LetsFly Kiteschule</h1>
        <p className="mt-1.5 text-sm text-lf-muted">Kitesurfen lernen am IJsselmeer</p>
      </div>

      <div className="px-8 pb-12">
        <form onSubmit={handleLogin}>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">E-Mail-Adresse</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="lisa.meyer@email.de"
            type="email"
            className="mb-3.5 w-full rounded-xl border border-lf-border bg-background px-4 py-3.5 text-sm outline-none"
          />
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Passwort</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            type="password"
            className="mb-3.5 w-full rounded-xl border border-lf-border bg-background px-4 py-3.5 text-sm outline-none"
          />
          {error && <p className="mb-3.5 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {submitting ? "Anmelden…" : "Anmelden"}
          </button>
        </form>
        <p className="mt-4.5 text-center text-xs text-lf-muted">
          Noch kein Konto? Wende dich an die Kiteschule.
        </p>
      </div>
    </div>
  );
}
```

This removes the "Jetzt registrieren" button and the `/onboarding` redirect-on-unknown-email behavior (per spec's Ziel/Nicht-Ziel: no self-signup).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: replace mock email-only login with Supabase email+password auth"
```

---

### Task 13: Rewire pages from `demoSession` to `useAuthUser()`, wire logout

**Files:**
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/book/page.tsx`
- Modify: `src/app/videos/page.tsx`
- Modify: `src/app/videos/[id]/page.tsx`
- Modify: `src/app/requests/page.tsx`
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/instructor/page.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `useAuthUser()` (Task 10), `signOut()` (Task 10).

Every one of these pages is a `"use client"` component rendered inside its role's `AuthGuard` (Task 11), so `useAuthUser()` is always safe to call at the top of the component.

- [ ] **Step 1: `src/app/dashboard/page.tsx`** — replace the import and all 5 call sites

Replace:
```ts
import { getCurrentCustomerId } from "@/lib/demoSession";
```
with:
```ts
import { useAuthUser } from "@/lib/auth/AuthContext";
```

Inside the component function body, add near the top: `const user = useAuthUser();`

Replace each `getCurrentCustomerId()` call (lines 44, 45, 46, 49, 108 per the current file) with `user.id`.

- [ ] **Step 2: `src/app/book/page.tsx`** — same pattern

Replace the `demoSession` import with `import { useAuthUser } from "@/lib/auth/AuthContext";`, add `const user = useAuthUser();` in the component, replace the 3 `getCurrentCustomerId()` call sites (lines 75, 130, 321) with `user.id`.

- [ ] **Step 3: `src/app/videos/page.tsx`** — same pattern, 1 call site (line 24)

- [ ] **Step 4: `src/app/videos/[id]/page.tsx`** — same pattern, 1 call site (line 22)

- [ ] **Step 5: `src/app/requests/page.tsx`** — same pattern, 3 call sites (lines 47, 48, 71)

- [ ] **Step 6: `src/app/profile/page.tsx`** — same pattern for the 3 `getCurrentCustomerId()` call sites (lines 49, 50, 51), **plus** wire real logout. Replace:

```tsx
        <button
          onClick={() => router.push("/")}
          className="w-full px-1 py-3.5 text-left text-[13.5px] font-semibold text-red-600 dark:text-red-400"
        >
          Abmelden
        </button>
```

with:

```tsx
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="w-full px-1 py-3.5 text-left text-[13.5px] font-semibold text-red-600 dark:text-red-400"
        >
          Abmelden
        </button>
```

And add `import { signOut } from "@/lib/auth/session";` alongside the other imports.

- [ ] **Step 7: `src/app/instructor/page.tsx`** — replace `import { getCurrentInstructorId } from "@/lib/demoSession";` with `import { useAuthUser } from "@/lib/auth/AuthContext";`, add `const user = useAuthUser();`, replace the 4 `getCurrentInstructorId()` call sites (lines 39, 43, 44, 73, 83) with `user.id`.

- [ ] **Step 8: `src/app/admin/page.tsx`** — replace `import { DEMO_ADMIN_ID } from "@/lib/demoSession";` with `import { useAuthUser } from "@/lib/auth/AuthContext";`, add `const user = useAuthUser();` in the component, replace `createdByAdminId: DEMO_ADMIN_ID` (line 248) with `createdByAdminId: user.id`.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/app/dashboard/page.tsx src/app/book/page.tsx src/app/videos/page.tsx "src/app/videos/[id]/page.tsx" src/app/requests/page.tsx src/app/profile/page.tsx src/app/instructor/page.tsx src/app/admin/page.tsx
git commit -m "feat: replace demoSession lookups with real auth user from AuthGuard context"
```

---

### Task 14: Remove `RoleSwitcher` and `demoSession.ts`

**Files:**
- Delete: `src/components/RoleSwitcher.tsx`
- Delete: `src/lib/demoSession.ts`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: none (this is the cleanup step — by this point Task 13 has removed every `demoSession` import).

- [ ] **Step 1: Confirm no remaining references**

Run: `grep -rn "demoSession\|RoleSwitcher" src --include="*.tsx" --include="*.ts"`
Expected: only `src/components/AppShell.tsx` (the import + JSX usage) and `src/components/RoleSwitcher.tsx` itself.

- [ ] **Step 2: Edit `src/components/AppShell.tsx`**

Remove the line `import { RoleSwitcher } from "./RoleSwitcher";` and the line `<RoleSwitcher />` (currently right before the `<div className="flex min-h-[calc(100vh-41px)] ...">`).

- [ ] **Step 3: Delete the files**

```bash
git rm src/components/RoleSwitcher.tsx src/lib/demoSession.ts
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `grep -rn "demoSession\|RoleSwitcher" src --include="*.tsx" --include="*.ts"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/AppShell.tsx
git commit -m "chore: remove prototype-only RoleSwitcher and demoSession mock auth"
```

---

### Task 15: Account provisioning instructions + user-bound seed data

This task's deliverable is a doc the user runs manually — there's no code to write, since the three real accounts (Kunde/Lehrer/Admin) don't exist yet and only the user can create them in the Supabase Dashboard.

**Files:**
- Create: `supabase/ACCOUNTS.md`

**Interfaces:**
- Consumes: `profiles` table (Task 2), `handle_new_user` trigger (Task 2).

- [ ] **Step 1: Write `supabase/ACCOUNTS.md`**

```markdown
# Accounts anlegen (manuell, einmalig)

Für jeden der drei Test-Accounts:

1. Supabase Dashboard → Authentication → Users → **Add user**
2. E-Mail + Passwort eingeben (z.B. `admin@letsfly.de` für den Admin-Account), **"Auto Confirm User"** aktivieren.
3. Nach dem Anlegen existiert automatisch eine Zeile in `profiles` mit `role = 'CUSTOMER'` (siehe `handle_new_user`-Trigger in `migrations/0001_init.sql`).

## Rollen setzen (SQL Editor, nach Anlage aller drei Accounts)

```sql
update public.profiles set role = 'ADMIN', name = 'LetsFly Verwaltung'
  where email = 'admin@letsfly.de';

update public.profiles set role = 'INSTRUCTOR', name = 'Merlin Muhra', is_iko_instructor = true
  where email = 'merlin@letsfly.de';
```

Ein Kunden-Account (z.B. `lisa.meyer@email.de`) braucht keinen Rollen-Update — er bleibt automatisch `CUSTOMER`.

## Demo-Daten für diese drei Accounts (optional, SQL Editor, danach ausführen)

Ersetzt `<ADMIN_UUID>`, `<INSTRUCTOR_UUID>`, `<CUSTOMER_UUID>` mit den echten UUIDs aus
`select id, email from auth.users;`.

```sql
insert into public.availability_windows (id, starts_at, ends_at, course_category, status, created_by_admin_id)
values ('window-1', '2026-08-03T09:00:00', '2026-08-03T17:00:00', 'PRIVATE_HOURS', 'OPEN', '<ADMIN_UUID>');

insert into public.slots (id, course_offering_id, availability_window_id, instructor_id, starts_at, ends_at, capacity, booked_count, status)
values ('slot-3', 'course-private-beginner', 'window-1', null, '2026-08-04T09:00:00', '2026-08-04T11:00:00', 1, 0, 'OPEN');

insert into public.hour_package_purchases (id, customer_id, course_offering_id, total_hours, hours_scheduled, hours_completed, purchased_at, expires_at)
values ('pkg-1', '<CUSTOMER_UUID>', 'course-private-intermediate', 10, 0, 0, '2026-06-01T00:00:00', '2026-09-30T00:00:00');

insert into public.notifications (id, customer_id, icon, title, message, time, unread)
values ('notif-1', '<CUSTOMER_UUID>', '✅', 'Willkommen bei LetsFly', 'Dein Account ist eingerichtet.', 'Gerade eben', true);
```

Weitere Slots/Buchungen nach demselben Muster ergänzen — Vorlage in `src/lib/data/mock/seed.ts` (`seedSlots`, `seedBookings`).
```

- [ ] **Step 2: Commit**

```bash
git add supabase/ACCOUNTS.md
git commit -m "docs: add manual account provisioning and role assignment instructions"
```

---

## Final verification (after all 15 tasks + user has run Part A SQL + created accounts)

- [ ] Run `npx tsc --noEmit` — no errors.
- [ ] Run `npm run lint` — no errors.
- [ ] Run `npm run dev`, open `http://localhost:3000`.
- [ ] Log in with the admin account → expect redirect to `/admin`, RoleSwitcher gone.
- [ ] Log in with the instructor account → expect redirect to `/instructor`.
- [ ] Log in with the customer account → expect redirect to `/dashboard`, courses/videos visible (from seed data).
- [ ] While logged in as customer, manually navigate to `/admin` in the URL bar → expect redirect back to `/dashboard` (role mismatch).
- [ ] Log out from `/profile` → expect redirect to `/`, and revisiting `/dashboard` directly redirects back to `/` (no session).
