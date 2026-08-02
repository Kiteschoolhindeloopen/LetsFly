# Vorher (einmalig)

1. `.env.local` aus `.env.example` erstellen und die beiden Supabase-Keys eintragen.
2. `supabase/migrations/0001_init.sql` im Supabase SQL Editor ausführen (Schema + RLS).
3. `supabase/migrations/0002_seed.sql` im Supabase SQL Editor ausführen (Kurse + Videos).

Danach erst mit den folgenden Schritten weitermachen.

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
