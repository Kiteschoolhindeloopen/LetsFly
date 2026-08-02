# Supabase-Integration: echte Auth + Datenmigration für 3 Rollen

## Kontext

Laut [AGENTS.md](../../../AGENTS.md) lief der Prototyp bisher komplett gegen
Mock-Daten hinter dem `Repository`-Interface
([data/repository.ts](../../../src/lib/data/repository.ts)), da kein
Supabase-Account existierte. Der Nutzer hat jetzt ein echtes Supabase-Projekt
angelegt und Project URL + anon Key bereitgestellt — laut AGENTS.md ist das
der Startpunkt, um `@supabase/supabase-js` einzubinden und die
Mock-Implementierung im Repository-Layer gegen echte Supabase-Calls
auszutauschen, **ohne dass Seiten/Komponenten sich ändern müssen**.

Ist-Zustand Auth: [src/lib/demoSession.ts](../../../src/lib/demoSession.ts)
ist ein Platzhalter — Login auf [src/app/page.tsx](../../../src/app/page.tsx)
fragt nur eine E-Mail ab (kein Passwort), löst sie gegen
`mockRepository.getUserByEmail` auf und merkt sich die User-ID in
`localStorage`. Es gibt keinen echten Signup, kein Passwort, kein Logout.
Der `RoleSwitcher` ([src/components/RoleSwitcher.tsx](../../../src/components/RoleSwitcher.tsx))
erlaubt aktuell freien Wechsel zwischen Kunde-/Lehrer-/Admin-Ansicht,
unabhängig vom Login — ein reines Prototyp-Hilfsmittel.

Wichtige Besonderheit dieser Next.js-Version (16.2.12, siehe
[AGENTS.md](../../../AGENTS.md) Hinweis "Read the relevant guide in
`node_modules/next/dist/docs/`"): `middleware.ts` ist deprecated und durch
`proxy.ts` ersetzt (andere Datei- und Funktionsnamen, Node.js-Runtime als
Default). Dieses Design nutzt bewusst **keinen** serverseitigen Routenschutz
über `proxy.ts`, siehe Entscheidung unten.

## Ziel / Nicht-Ziel

- **Ziel:** Login mit echter E-Mail+Passwort-Authentifizierung über Supabase
  Auth, für alle drei Rollen (Kunde, Lehrer, Admin).
- **Ziel:** Rollenbasierter Zugriff — jede Rolle sieht nach Login nur ihren
  Bereich (`/dashboard`, `/instructor`, `/admin`); echte Sicherheitsgrenze
  ist Row-Level-Security (RLS) in der Datenbank, nicht nur die UI.
- **Ziel:** Alle Datentabellen (Kurse, Slots, Buchungen, Stundenpakete,
  Videos, Benachrichtigungen, Instructor-/Package-Requests) als echte
  Supabase/Postgres-Tabellen, `supabaseRepository` ersetzt `mockRepository`
  als aktive Implementierung — Interface aus `repository.ts` bleibt
  unverändert, UI-Code ändert sich nicht.
- **Ziel:** Bestehende Mock-Seed-Daten (Kurse, Videos, Verfügbarkeitsfenster)
  werden als Startdaten übernommen, damit die App weiterhin Inhalte zum
  Klicken hat.
- **Nicht-Ziel:** Kein öffentliches Self-Signup — Accounts (alle drei
  Rollen) werden weiterhin nur manuell vergeben (Supabase Dashboard), wie in
  AGENTS.md für Kunden bereits vorgesehen; hier auf alle Rollen ausgeweitet,
  per expliziter Nutzerentscheidung.
- **Nicht-Ziel:** Kein serverseitiger Routenschutz via `proxy.ts` in diesem
  Schritt — siehe Architekturentscheidung unten.
- **Nicht-Ziel:** Der Onboarding-Präferenzen-Wizard
  ([src/app/onboarding/page.tsx](../../../src/app/onboarding/page.tsx))
  bleibt inhaltlich unverändert; er ist kein Account-Erstellungs-Flow und
  wird hier nicht angefasst außer der Entfernung des
  "Jetzt registrieren"-Links auf der Login-Seite.
- **Nicht-Ziel:** Passwort-Reset-/"Passwort vergessen"-Flow ist nicht Teil
  dieses Schritts (kann später ergänzt werden).

## Architekturentscheidung: Routenschutz

**Client-seitiger `AuthGuard`** statt serverseitigem `proxy.ts` mit
`@supabase/ssr`-Cookie-Sessions. Begründung:

- Die eigentliche Sicherheitsgrenze für Daten ist RLS in Postgres — die gilt
  unabhängig davon, ob die UI-Route "sauber" geschützt ist. Ein umgangener
  Client-Check kann keine fremden Daten lesen/schreiben.
- Passt zum bestehenden Code-Stil: praktisch alle Seiten sind bereits
  `"use client"` mit `useRouter`/`useEffect`-Redirect-Mustern (siehe
  `demoSession.ts`-Nutzung).
- `proxy.ts` ist in dieser Next-Version neu und ungetestet im Repo — höheres
  Risiko für subtile Fehler ohne bestehende Referenz-Implementierung.

## Umsetzung

### 1. Supabase-Client & Config

- `src/lib/supabase/client.ts`: Browser-Client via `createBrowserClient` aus
  `@supabase/ssr`, liest `NEXT_PUBLIC_SUPABASE_URL` +
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` aus `.env.local`.
- `.env.local` (gitignored) mit den beiden Keys; `.env.example` als Vorlage
  ohne echte Werte im Repo.
- Neue Dependencies: `@supabase/supabase-js`, `@supabase/ssr`.

### 2. Datenschema (`supabase/migrations/0001_init.sql`)

Tabellen 1:1 abgeleitet aus [src/lib/data/types.ts](../../../src/lib/data/types.ts):
`profiles`, `course_offerings`, `availability_windows`, `slots`,
`hour_package_purchases`, `bookings`, `videos`, `watched_videos`,
`notifications`, `instructor_slot_requests`, `package_requests`.
`profiles.id` referenziert `auth.users.id` (uuid), `role` als
check-constraint (`CUSTOMER` | `INSTRUCTOR` | `ADMIN`). Fremdschlüssel
zwischen Tabellen wie in den TS-Interfaces vorhanden (z.B.
`bookings.customer_id → profiles.id`, `bookings.slot_id → slots.id`).

Trigger `handle_new_user` auf `auth.users` (AFTER INSERT): legt automatisch
eine `profiles`-Zeile mit `role = 'CUSTOMER'` an. Admin/Lehrer-Rolle wird
danach manuell per SQL gesetzt (siehe Abschnitt 4).

### 3. Row-Level-Security (`supabase/migrations/0001_init.sql`, gleiche Datei)

RLS aktiviert auf allen Tabellen. Policies:

| Tabelle | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `profiles` | eigene Zeile; Admin: alle | eigene Zeile; Admin: alle |
| `course_offerings`, `availability_windows`, `videos` | alle eingeloggten Nutzer | nur Admin |
| `slots` | alle eingeloggten Nutzer | Lehrer: nur `instructor_id = auth.uid()`; Admin: alle |
| `bookings`, `hour_package_purchases`, `watched_videos`, `notifications` | `customer_id = auth.uid()`; Admin: alle | `customer_id = auth.uid()`; Admin: alle |
| `instructor_slot_requests` | `instructor_id = auth.uid()`; Admin: alle | Lehrer: eigene erstellen; Admin: alle entscheiden |
| `package_requests` | `customer_id = auth.uid()`; Admin: alle | Kunde: eigene erstellen; Admin: alle entscheiden |

Admin-Erkennung über eine `SECURITY DEFINER`-Hilfsfunktion `is_admin(uid uuid)
returns boolean`, die `profiles` **unter Umgehung von RLS** abfragt. Direkte
Subqueries auf `profiles.role = 'ADMIN'` innerhalb einer Policy auf
`profiles` selbst würden eine RLS-Endlosrekursion auslösen (die Policy prüft
die Rolle, indem sie `profiles` liest, was wiederum dieselbe Policy
auslöst) — deshalb zwingend über die `SECURITY DEFINER`-Funktion, auch für
alle anderen Tabellen (Konsistenz).

### 4. Seed-Daten (`supabase/migrations/0002_seed.sql`)

Übernahme von `seedCourses`, `seedVideos`, `seedAvailabilityWindows` aus
[src/lib/data/mock/seed.ts](../../../src/lib/data/mock/seed.ts) als
`insert`-Statements — nur Daten ohne User-Bindung.

Nutzergebundene Seed-Daten (Demo-Buchungen/-Pakete/-Notifications für
"Lisa", Slot-Requests für "Merlin") folgen erst nach manueller Account-
Anlage als drittes, separates SQL-Snippet (nicht Teil der Migration-Dateien,
da abhängig von echten `auth.uid()`-Werten, die erst nach Account-Erstellung
existieren).

### 5. Account-Vergabe (manuell)

Kein Self-Signup. Ablauf pro Account (Kunde, Lehrer, Admin):

1. Nutzer legt Account im Supabase Dashboard an (Authentication → Users →
   Add user, E-Mail + Passwort).
2. `handle_new_user`-Trigger legt automatisch `profiles`-Zeile mit
   `role = 'CUSTOMER'` an.
3. Für Lehrer/Admin: SQL-Snippet (von Claude bereitgestellt) setzt Rolle und
   Namen anhand der E-Mail, z.B.
   `update profiles set role = 'ADMIN', name = '...' where email = '...';`

### 6. Repository-Swap

- `src/lib/data/supabase/supabaseRepository.ts`: implementiert das
  bestehende `Repository`-Interface vollständig, gleiche Methodensignaturen
  wie `mockRepository`.
- `getRepository()` in `repository.ts`: liefert ab jetzt immer
  `supabaseRepository` — kein Mock-Fallback mehr. Ein halber Fallback (Daten
  gemockt, aber Auth zwingend über Supabase, siehe Abschnitt 7) wäre ein
  kaputter Zustand: ohne Supabase-Zugriff könnte sich niemand einloggen,
  egal ob die Daten gemockt sind. `mockRepository` bleibt im Code (für
  Tests/Referenz), wird aber nicht mehr automatisch verwendet. Die
  "ohne Internet/Account startbar"-Vorgabe aus AGENTS.md galt laut dortiger
  Formulierung ausdrücklich nur, bis echte Supabase-Credentials vorliegen —
  das ist jetzt der Fall.

### 7. Auth-Flow

- `src/lib/auth/session.ts` ersetzt `demoSession.ts`: liest echte Supabase-
  Session (`supabase.auth.getSession()`, `onAuthStateChange`), liefert
  `{ id, role, email }` aus der `profiles`-Tabelle des eingeloggten Users.
- Login-Seite (`src/app/page.tsx`): Passwort-Feld ergänzt,
  `supabase.auth.signInWithPassword({ email, password })` ersetzt
  `getUserByEmail`; bei Erfolg Redirect zur rollenpassenden Route
  (`ROLE_ROUTES` bleibt). "Jetzt registrieren"-Button wird entfernt (kein
  Self-Signup).
- Neue `AuthGuard`-Komponente prüft Session + Rolle pro Rollenbereich,
  redirected zu `/` bei fehlendem Login, zur eigenen Rollen-Route bei
  falscher Rolle.
- Logout (`supabase.auth.signOut()`) wird ergänzt, z.B. im Profilbereich
  ([src/app/profile/page.tsx](../../../src/app/profile/page.tsx)), da
  aktuell kein Logout existiert.

### 8. Aufräumen

- `RoleSwitcher.tsx` und seine Einbindung in
  [src/components/AppShell.tsx](../../../src/components/AppShell.tsx)
  werden entfernt.
- `demoSession.ts` wird gelöscht, alle Imports (u.a. `page.tsx`, ggf.
  weitere Seiten) auf `session.ts` umgestellt.

## Fehlerverhalten

- Login mit falschem Passwort/unbekannter E-Mail: Fehlermeldung auf der
  Login-Seite, kein automatischer Redirect zum Onboarding mehr (das gab es
  vorher bei unbekannter E-Mail — entfällt, da kein Self-Signup mehr
  möglich ist; stattdessen klare Fehlermeldung "E-Mail oder Passwort
  falsch").
- Kein `NEXT_PUBLIC_SUPABASE_URL` gesetzt (z.B. `.env.local` fehlt bei einem
  frischen Checkout): App zeigt beim Start einen klaren Fehler statt eines
  stillen Absturzes — `client.ts` wirft beim Fehlen der Env-Variablen sofort
  eine Exception mit verständlicher Meldung ("Supabase-Konfiguration fehlt,
  siehe `.env.example`"), statt dass Login/Daten unklar fehlschlagen.

## Testing

- Manuelle Verifikation: `npm run dev`, jeweils mit den drei manuell
  angelegten Accounts einloggen, prüfen dass nur die passende Rolle
  sichtbar ist und `AuthGuard` bei direktem Aufruf einer fremden
  Rollen-Route redirected.
- RLS-Verifikation: mit dem anon Key + einer fremden User-Session (z.B. über
  Supabase SQL Editor / REST-Test) prüfen, dass fremde `bookings`-Zeilen
  nicht lesbar sind.
