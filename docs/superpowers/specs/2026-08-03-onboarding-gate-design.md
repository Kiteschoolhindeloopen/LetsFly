# Onboarding-Wizard beim ersten Login neu angelegter Kunden-Accounts

## Kontext

Der bestehende 4-seitige Onboarding-Wizard ([src/app/onboarding/page.tsx](../../../src/app/onboarding/page.tsx))
ist seit der Supabase-Auth-Integration verwaist: Login
([src/app/page.tsx](../../../src/app/page.tsx)) routet nach erfolgreichem
Login direkt zu `ROLE_ROUTES[profile.role]`, `/onboarding` wird nirgends
mehr verlinkt. Der Wizard selbst ist unverändert aus der Mock-Ära: kein
`AuthGuard`, keine Persistenz der Auswahl, hardcodierter Name „Lisa" im
Willkommenstext (`Willkommen bei LetsFly, Lisa! 🌊`).

Seit dem gerade fertiggestellten Admin-Account-Anlage-Feature
([2026-08-02-admin-create-account-design.md](2026-08-02-admin-create-account-design.md))
können Admins Kunden-Accounts direkt in der App anlegen. Diese neuen Kunden
sollen beim allerersten Login den Onboarding-Wizard sehen, bevor sie ihr
Dashboard erreichen — analog zum ursprünglichen (Mock-Ära) Verhalten, als
eine unbekannte E-Mail beim Login automatisch zu `/onboarding` führte.

## Ziel / Nicht-Ziel

- **Ziel:** Ein Kunden-Account, der den Onboarding-Wizard noch nicht
  abgeschlossen hat, landet beim Login **und** bei jedem direkten Zugriff
  auf eine Kunden-Route (`/dashboard`, `/book`, `/videos`, `/requests`,
  `/profile`) automatisch auf `/onboarding` — nicht nur unmittelbar nach
  dem Login-Formular.
- **Ziel:** Sobald der Wizard einmal abgeschlossen oder übersprungen wurde,
  erscheint er nie wieder für diesen Account.
- **Ziel:** Der Willkommenstext zeigt den echten Namen des eingeloggten
  Kunden statt „Lisa".
- **Nicht-Ziel:** Lehrer- und Admin-Accounts sehen den Wizard nie — der
  Inhalt (Kite-Erfahrung, Kurse, Videos) ist rein kundenspezifisch.
- **Nicht-Ziel:** Die Tile-Auswahl im Schritt „Was bringst du schon mit?"
  wird weiterhin nicht persistiert (war schon in der Mock-Version rein
  visuell/lokaler State) — dieses Feature ändert nur, *ob* und *wann* der
  Wizard erscheint, nicht seinen Inhalt oder seine Datenerhebung.
- **Nicht-Ziel:** Keine Erweiterung der `profiles`-RLS-Policies für
  Selbst-Updates durch Kunden (bewusste Entscheidung, siehe Architektur) —
  die zuletzt gefixte Selbst-Eskalationslücke auf `profiles` bleibt
  geschlossen.

## Architektur

### Warum eine eigene Server-Route statt einer RLS-Policy-Erweiterung

`profiles` hat aktuell nur `profiles_update_admin_only` als UPDATE-Policy
(seit dem Fix der Selbst-Eskalationslücke in der vorherigen Review). Um
Kunden das Setzen von `onboarding_completed_at` auf der eigenen Zeile zu
erlauben, gäbe es zwei Wege: eine neue, spaltenscharf eingeschränkte
Self-Update-Policy (mehr sicherheitskritische SQL-Oberfläche, genau der
Bereich, in dem bereits ein echter Bug auftrat), oder eine kleine
Server-Route nach dem Muster von `POST /api/admin/create-user`. Diese Spec
wählt die Server-Route — kein neues RLS-Risiko, `profiles`-Schreibzugriff
bleibt so restriktiv wie jetzt.

### Datenmodell (`supabase/migrations/0003_onboarding.sql`)

```sql
alter table public.profiles add column onboarding_completed_at text;

-- Backfill: bereits bestehende Accounts (alles, was VOR dieser Migration
-- existierte) gilt als bereits onboarded, sonst würde jeder bestehende
-- Kunde beim nächsten Login unerwartet in den Wizard gezwungen. Nur
-- Accounts, die NACH dieser Migration neu angelegt werden, starten mit
-- NULL und durchlaufen das Gating.
update public.profiles set onboarding_completed_at = now()::text where onboarding_completed_at is null;
```

Nullable, `text`-Typ passend zur bestehenden Konvention aller
Datums-/Zeit-Spalten in diesem Schema (siehe
[0001_init.sql](../../../supabase/migrations/0001_init.sql)). `null` =
Onboarding noch nicht abgeschlossen.

`src/lib/data/types.ts`: `User` bekommt `onboardingCompletedAt?: string`.
`src/lib/data/supabase/mappers.ts` (`mapProfile`) und
`src/lib/auth/session.ts` (`getCurrentProfile`) geben das Feld mit durch.

### Server-Route (`src/app/api/onboarding/complete/route.ts`)

`POST`, kein Body nötig. Ablauf:
1. Bearer-Token aus `Authorization`-Header lesen, fehlt es → `403`.
2. Mit dem anon-Key-Client `auth.getUser(token)` verifizieren → `403` bei
   ungültigem Token.
3. Mit dem service_role Client (`getSupabaseAdmin()` aus
   [adminClient.ts](../../../src/lib/supabase/adminClient.ts), bereits
   vorhanden) `profiles.onboarding_completed_at` für **genau die eigene
   `id` des Aufrufers** (aus dem verifizierten Token, nicht aus dem Body)
   auf `new Date().toISOString()` setzen.
4. `{ success: true }` bei Erfolg, `{ error: "..." }` mit `500` bei
   DB-Fehler.

Kein Admin-Check nötig — jeder eingeloggte Nutzer darf nur seine eigene
Zeile abschließen, das Ziel der Aktualisierung ist immer die eigene,
tokenverifizierte ID.

### Gating (`RequireOnboarding` + Layouts)

Neue Komponente `src/components/RequireOnboarding.tsx` (Client-Component,
analog zu [AuthGuard.tsx](../../../src/components/AuthGuard.tsx)): liest
`useAuthUser()`; falls `role === "CUSTOMER"` und
`onboardingCompletedAt` fehlt, `router.replace("/onboarding")`; sonst
`children` rendern. Muss **innerhalb** von `AuthGuard` liegen (braucht den
`AuthProvider`-Context), nicht davor.

Die 5 bestehenden Kunden-Layouts (`dashboard`, `book`, `videos`,
`requests`, `profile`) werden von

```tsx
<AuthGuard role="CUSTOMER">{children}</AuthGuard>
```

zu

```tsx
<AuthGuard role="CUSTOMER">
  <RequireOnboarding>{children}</RequireOnboarding>
</AuthGuard>
```

geändert. Neues `src/app/onboarding/layout.tsx` bekommt **nur**
`<AuthGuard role="CUSTOMER">{children}</AuthGuard>` — bewusst **ohne**
`RequireOnboarding`, sonst entstünde eine Redirect-Schleife
(`/dashboard` → `/onboarding` → `/dashboard` → …).

Damit greift die Sperre nicht nur unmittelbar nach dem Login-Formular,
sondern bei jedem Aufruf einer Kunden-Route, solange
`onboarding_completed_at` leer ist — auch bei direktem URL-Aufruf oder
Reload.

## UI-Änderungen (`src/app/onboarding/page.tsx`)

- Hardcodierter Name „Lisa" im Willkommenstext → `useAuthUser().name`.
- Alle vier Stellen, die aktuell zu `/dashboard` navigieren (die drei
  „Überspringen"-Buttons in den Schritten `welcome`, `choices`, `benefits`,
  sowie der finale „Los geht's"-Button im Schritt `done`), rufen vorher
  `POST /api/onboarding/complete` auf (mit dem aktuellen Access-Token aus
  `supabase.auth.getSession()`) und navigieren erst danach zu
  `/dashboard`. Der Request-Fehlerfall wird nicht separat behandelt (kein
  UI-Blocker) — schlägt das Markieren fehl, sieht der Kunde den Wizard beim
  nächsten Login erneut, was funktional gleichwertig zu „noch nicht
  abgeschlossen" ist und keine schlechtere UX als der Status quo darstellt.

## Fehlerverhalten

- `POST /api/onboarding/complete` schlägt fehl (Netzwerk, Server-Fehler):
  Navigation zu `/dashboard` passiert trotzdem (kein Blockieren der UX) —
  der Kunde sieht den Wizard beim nächsten Login einfach erneut, kein
  Datenverlust, keine Fehlermeldung nötig.
- `RequireOnboarding` kann `onboardingCompletedAt` nicht laden (z.B.
  Netzwerkfehler in `AuthGuard`s zugrundeliegendem `getCurrentProfile()`):
  bestehendes `AuthGuard`-Verhalten greift bereits (Redirect zu `/`) — kein
  neuer Fehlerfall, da `RequireOnboarding` nur rendert, nachdem `AuthGuard`
  bereits ein gültiges Profil geladen hat.

## Testing

- Manuell: neuen Kunden-Account über das Admin-Formular anlegen, mit
  dessen Zugangsdaten einloggen → erwartet: Onboarding-Wizard erscheint,
  zeigt den echten Namen.
- Manuell: Wizard komplett durchlaufen bis „Los geht's" → landet auf
  `/dashboard`. Ausloggen, erneut einloggen → Wizard erscheint **nicht**
  mehr.
- Manuell: neuen Kunden anlegen, einloggen, im Wizard „Überspringen"
  klicken → landet auf `/dashboard`. Ausloggen, erneut einloggen → Wizard
  erscheint **nicht** mehr.
- Manuell: mit einem Kunden ohne abgeschlossenes Onboarding direkt die URL
  `/dashboard` aufrufen (nicht über Login) → landet auf `/onboarding`.
- Manuell: mit dem bestehenden Admin- oder Lehrer-Account einloggen →
  Wizard erscheint nie, unabhängig vom `onboarding_completed_at`-Wert.
- Manuell: mit einem **bereits vor dieser Migration bestehenden**
  Kunden-Account einloggen → Wizard erscheint **nicht** (Backfill hat
  `onboarding_completed_at` gesetzt).
