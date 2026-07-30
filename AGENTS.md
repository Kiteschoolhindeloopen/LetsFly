<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Phasenplan & Backend-Constraint

**Status:** Es gibt noch KEINEN Supabase-Account und keine echten Login-/Env-Credentials. Der Kunde soll den Prototyp trotzdem lokal auf seinem Laptop starten und klicken können (`npm run dev`, kein Internet/Account nötig).

**Regel für jede weitere Implementierung:**
- Baue die Datenzugriffe hinter einem Repository-/Interface-Layer (z.B. `src/lib/data/*`), NICHT direkt gegen den Supabase-Client. UI-Code ruft nur Funktionen wie `getCourses()`, `createBooking()`, `getCustomer()` auf.
- Implementiere diese Funktionen vorerst mit lokalen Mock-Daten / `localStorage` / In-Memory-State (siehe `src/lib/data/courses.ts` als bestehendes Beispiel für statische Daten).
- Auth: nur ein einfaches Mock-Login/Dummy-Session, kein echter Supabase-Auth-Call, solange kein Account existiert.
- Erst wenn der Nutzer explizit sagt, dass echte Supabase-Credentials vorhanden sind, darf `@supabase/supabase-js` eingebunden und die Mock-Implementierungen im Repository-Layer gegen echte Supabase-Calls ausgetauscht werden. Seiten/Komponenten sollen dabei unverändert bleiben.
- Nicht ohne Rückfrage: Supabase-Projekt anlegen, `.env`-Keys erwarten/einfordern, oder Features bauen, die zwingend einen Cloud-Account voraussetzen (echte Multi-User-Sync, E-Mail-Bestätigung, Row-Level-Security).

Diese Einschränkung gilt bis der Kunde/Nutzer einen Supabase-Account + Zugangsdaten bereitstellt.

# Farbpalette (verbindlich)

Definiert in `src/app/globals.css` (`:root`) und als Tailwind-Utilities über `@theme inline` verfügbar (`bg-primary`, `text-text`, etc.):

```css
--text: #051218;
--background: #f7fbfd;
--primary: #3290d1;
--secondary: #9095e6;
--accent: #776cde;
```

Keine anderen Marken-/Akzentfarben einführen, ohne Rückfrage. Bestehende `--lf-*`-Variablen sind von dieser Palette abgeleitet (z.B. `--lf-ocean` = `--primary`) — neue Komponenten sollen bevorzugt direkt `--text`, `--background`, `--primary`, `--secondary`, `--accent` nutzen statt neuer `--lf-*`-Namen.

