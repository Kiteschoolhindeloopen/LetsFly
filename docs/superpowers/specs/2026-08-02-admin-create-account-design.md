# Admin legt Lehrer-/Kunden-Accounts direkt in der App an

## Kontext

Seit der Supabase-Auth-Integration ([2026-08-02-supabase-auth-integration-design.md](2026-08-02-supabase-auth-integration-design.md))
werden Accounts ausschließlich manuell im Supabase Dashboard angelegt
(`supabase/ACCOUNTS.md`) — eine explizite frühere Nutzerentscheidung gegen
Self-Signup. Das bleibt für Endnutzer so; dieses Feature ersetzt aber den
manuellen Dashboard-Schritt für den **Admin**, der Lehrer- und
Kunden-Accounts anlegt, durch ein Formular direkt im Admin-Bereich
(`src/app/admin/page.tsx`, Tab „Verwaltung“, unterhalb der bestehenden
„Lehrer-Team“-Liste, die bereits per `getInstructors()` befüllt wird).

Der Admin tippt Passwort und Daten selbst ein (keine automatische
E-Mail-Zustellung — Supabase-SMTP ist nicht konfiguriert) und gibt Login-Link
+ Passwort danach manuell an den neuen Nutzer weiter, genau wie es die Schule
laut [AGENTS.md](../../../AGENTS.md) bisher schon persönlich macht.

## Ziel / Nicht-Ziel

- **Ziel:** Admin kann im „Verwaltung“-Tab einen neuen Account (Kunde oder
  Lehrer) mit E-Mail, Passwort, Name anlegen, ohne das Supabase Dashboard zu
  öffnen.
- **Ziel:** Nach erfolgreichem Anlegen zeigt die App Login-Link + Passwort
  zum Kopieren an, damit der Admin es weitergeben kann.
- **Ziel:** Neu angelegte Lehrer erscheinen sofort in der bestehenden
  „Lehrer-Team“-Liste (kein zusätzlicher Reload-Mechanismus nötig — die
  bestehende `load()`-Funktion wird nach Erfolg erneut aufgerufen).
- **Nicht-Ziel:** Kein Self-Signup für Endnutzer — nur der eingeloggte Admin
  kann diese Funktion nutzen.
- **Nicht-Ziel:** Kein automatischer E-Mail-Versand (Einladung/Magic-Link) —
  das würde SMTP-Konfiguration in Supabase voraussetzen, die nicht existiert.
- **Nicht-Ziel:** Kein Editieren/Löschen bestehender Accounts über dieses
  Formular — nur Neuanlage.
- **Nicht-Ziel:** Admin-Accounts werden über dieses Formular nicht anlegbar
  (Rollenauswahl ist auf Kunde/Lehrer beschränkt) — ein zusätzlicher
  Admin-Account bleibt bewusst ein manueller Dashboard-Schritt, um
  versehentliche Admin-Vergabe aus der UI heraus auszuschließen.

## Architektur

### Warum ein Server-Endpoint nötig ist

`supabase.auth.admin.createUser()` erfordert den **service_role Key** —
anders als der bisher genutzte anon key ist dieser hochprivilegiert und darf
niemals im Browser-Bundle landen. Deshalb:

- Neue Server-only Env-Variable `SUPABASE_SERVICE_ROLE_KEY` (ohne
  `NEXT_PUBLIC_`-Prefix, damit sie nie ins Client-Bundle kompiliert wird) in
  `.env.local`/`.env.example`.
- Neuer Server-Client `src/lib/supabase/adminClient.ts`
  (`createClient(url, serviceRoleKey)` aus `@supabase/supabase-js`, **nicht**
  `@supabase/ssr`, da kein Browser-Cookie-Handling nötig ist — reiner
  Server-zu-Server-Zugriff).
- Neue Route `src/app/api/admin/create-user/route.ts` (Next.js Route
  Handler, `POST`), die:
  1. Das Access-Token aus dem `Authorization: Bearer <token>`-Header liest
     (vom Client mitgeschickt, siehe UI-Abschnitt).
  2. Mit dem bestehenden **anon-Key-Client** `supabase.auth.getUser(token)`
     aufruft, um den Aufrufer zu verifizieren.
  3. Aus `profiles` die Rolle des Aufrufers lädt und bei `role !== 'ADMIN'`
     mit `403` abbricht — verhindert, dass ein Nicht-Admin (oder ein
     Aufrufer ganz ohne gültiges Token) die Route missbrauchen kann.
  4. Mit dem **service_role Client** `adminClient.auth.admin.createUser({
     email, password, email_confirm: true })` aufruft (`email_confirm: true`,
     damit der neue Account sofort einloggbar ist, ohne
     Bestätigungs-E-Mail).
  5. Der bestehende `handle_new_user`-Trigger legt automatisch eine
     `profiles`-Zeile mit `role='CUSTOMER'` an. Die Route aktualisiert
     direkt danach `role` und `name` (per service_role Client, umgeht RLS)
     auf den vom Admin gewählten Wert.
  6. Bei jedem Fehlschlag (Schritt 4 oder 5) eine klare Fehlermeldung als
     JSON zurückgibt, die das Formular anzeigen kann (z.B. „E-Mail bereits
     vergeben“).

Diese Route ist bewusst **nicht** Teil des `Repository`-Interfaces
([data/repository.ts](../../../src/lib/data/repository.ts)) — sie ist eine
privilegierte Supabase-Auth-Admin-Operation, keine der Mock/Supabase
austauschbaren Kunden-/Buchungsdaten-Operationen, für die der
Repository-Layer laut AGENTS.md gedacht ist. Sie existiert nur in der
Supabase-Welt; ein Mock-Äquivalent ergibt für diese Funktion keinen Sinn.

## UI (`src/app/admin/page.tsx`)

Neue Sektion direkt unter der bestehenden „Lehrer-Team“-Liste, innerhalb
`{tab === "verwaltung" && (...)}`:

- Formular mit vier Feldern: E-Mail (`type="email"`), Passwort
  (**`type="text"`**, nicht `password` — der Admin soll es direkt ablesen
  können, um es weiterzugeben), Name, Rolle (Radio-Buttons oder `<select>`:
  „Kunde“ / „Lehrer“).
- Client-seitige Minimal-Validierung: alle vier Felder Pflicht, Passwort
  mind. 8 Zeichen (matcht Supabase-Default-Minimum ist niedriger, 8 ist eine
  bewusst etwas strengere, aber unaufdringliche Untergrenze).
- Beim Absenden: `fetch("/api/admin/create-user", { method: "POST", headers:
  { Authorization: \`Bearer ${session.access_token}\` }, body: JSON.stringify({
  email, password, name, role }) })`. Das Access-Token kommt aus
  `supabase.auth.getSession()` (Supabase-Client ist im Browser bereits
  eingeloggt als der aktuelle Admin).
- Ladezustand (`creatingAccount`, Button disabled + „Erstelle…“) analog zu
  bestehenden Mustern wie `savingCourse`/`creatingWindow` im selben File.
- Bei Erfolg: Formular leert sich, und eine Erfolgsbox erscheint mit
  Login-Link (`window.location.origin + "/"`) und dem eingegebenen Passwort
  als selektierbarer/kopierbarer Text — verschwindet erst beim nächsten
  Absenden oder Tab-Wechsel.
- Bei Fehler: Fehlermeldung im Formularbereich (roter Text, gleiches Muster
  wie die Login-Seiten-Fehlermeldung aus der Auth-Integration), kein Absturz.
- Nach Erfolg wird die bestehende Daten-Ladefunktion der Seite erneut
  aufgerufen, damit ein neu angelegter Lehrer sofort in der „Lehrer-Team“-
  Liste erscheint (die Liste lädt bereits über `getInstructors()`).

## Fehlerverhalten

- E-Mail bereits vergeben: Supabase Admin API liefert einen Fehler beim
  `createUser`-Aufruf → Route gibt `400` mit lesbarer Meldung zurück →
  Formular zeigt „Diese E-Mail-Adresse ist bereits vergeben.“
- Aufrufer ist kein Admin oder Token fehlt/ungültig: Route antwortet `403`,
  Formular zeigt generische Fehlermeldung (dieser Fall sollte in der Praxis
  nie auftreten, da die Seite selbst schon per `AuthGuard role="ADMIN"`
  geschützt ist — die serverseitige Prüfung ist eine zweite,
  unabhängige Absicherung, kein normaler Nutzerpfad).
- `SUPABASE_SERVICE_ROLE_KEY` fehlt in der Server-Umgebung: Route antwortet
  `500` mit einer klaren Meldung („Server-Konfiguration unvollständig“),
  analog zum bestehenden Fail-Fast-Verhalten von `src/lib/supabase/client.ts`
  für die Browser-Keys.

## Testing

- Manuell: als Admin eingeloggt einen Kunden- und einen Lehrer-Account
  anlegen, prüfen dass beide sich danach mit dem gesetzten Passwort
  einloggen können und in der richtigen Rolle landen (`/dashboard` bzw.
  `/instructor`).
- Manuell: Versuch, dieselbe E-Mail zweimal anzulegen → erwartete
  Fehlermeldung, kein halb angelegter Zustand.
- Manuell: `/api/admin/create-user` direkt ohne gültiges Token aufrufen
  (z.B. per curl) → erwartet `403`.
