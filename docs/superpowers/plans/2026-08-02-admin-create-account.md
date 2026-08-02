# Admin legt Lehrer-/Kunden-Accounts direkt in der App an Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create a Kunde/Lehrer Supabase Auth account from a form in the admin "Verwaltung" tab, instead of the Supabase Dashboard.

**Architecture:** A new Next.js Route Handler (`src/app/api/admin/create-user/route.ts`) uses a server-only Supabase client backed by the `service_role` key to call `auth.admin.createUser()` and set the new profile's role/name. The route independently verifies the caller is an admin before doing anything. The admin page gets a new form that calls this route and displays the login link + password on success.

**Tech Stack:** Next.js 16.2 App Router Route Handlers, `@supabase/supabase-js` (already a dependency), existing `profiles` table + `handle_new_user` trigger from the prior Supabase-auth-integration plan.

**Spec:** `docs/superpowers/specs/2026-08-02-admin-create-account-design.md`

## Global Constraints

- `SUPABASE_SERVICE_ROLE_KEY` must never be imported into any `"use client"` file or reach the browser bundle — only used inside the new Route Handler (server-side only).
- The route must verify the caller is an authenticated ADMIN before creating any account — this is a real, independent security check, not just relying on the page's `AuthGuard`.
- Password field in the admin form is `type="text"`, not `type="password"` — the admin needs to read it back to share it (per spec).
- Only `CUSTOMER` and `INSTRUCTOR` are creatable roles from this form — no `ADMIN` option (per spec, prevents accidental admin creation from the UI).
- No automatic email sending — `email_confirm: true` on `createUser` so the account is immediately usable without Supabase SMTP.
- This feature is NOT part of the `Repository` interface (`src/lib/data/repository.ts`) — it's a Supabase Auth Admin operation, not a mock/real-swappable data operation (per spec).

---

### Task 1: Server-only Supabase admin client

**Files:**
- Create: `src/lib/supabase/adminClient.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.SUPABASE_SERVICE_ROLE_KEY`.
- Produces: `supabaseAdmin` (a `SupabaseClient` from `@supabase/supabase-js`, service-role-authenticated). Consumed by Task 2's route handler.

- [ ] **Step 1: Write `src/lib/supabase/adminClient.ts`**

```ts
// Server-only: uses the Supabase service_role key, which bypasses RLS.
// Never import this file from a "use client" component or any code that
// could end up in the browser bundle — only from Route Handlers / other
// server-only code.
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error(
    "Supabase-Server-Konfiguration fehlt. SUPABASE_SERVICE_ROLE_KEY in .env.local setzen (siehe .env.example)."
  );
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/adminClient.ts
git commit -m "feat: add server-only Supabase admin client using the service_role key"
```

---

### Task 2: `create-user` Route Handler

**Files:**
- Create: `src/app/api/admin/create-user/route.ts`

**Interfaces:**
- Consumes: `supabaseAdmin` (Task 1), `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Produces: `POST /api/admin/create-user` — request body `{ email: string; password: string; name: string; role: "CUSTOMER" | "INSTRUCTOR" }`, header `Authorization: Bearer <access_token>`. Response `{ success: true }` on `200`, or `{ error: string }` on `400`/`403`/`500`. Consumed by Task 3's admin page form.

- [ ] **Step 1: Write `src/app/api/admin/create-user/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/adminClient";

interface CreateUserBody {
  email?: string;
  password?: string;
  name?: string;
  role?: "CUSTOMER" | "INSTRUCTOR";
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Server-Konfiguration unvollständig." }, { status: 500 });
  }

  const callerClient = createClient(url, anonKey);
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
  if (callerError || !callerData.user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 403 });
  }

  const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", callerData.user.id)
    .maybeSingle();
  if (callerProfileError || callerProfile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const body = (await request.json()) as CreateUserBody;
  const { email, password, name, role } = body;

  if (!email?.trim() || !password || !name?.trim() || (role !== "CUSTOMER" && role !== "INSTRUCTOR")) {
    return NextResponse.json({ error: "Alle Felder sind erforderlich." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const message = createError?.message.includes("already been registered")
      ? "Diese E-Mail-Adresse ist bereits vergeben."
      : "Account konnte nicht angelegt werden.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ role, name: name.trim() })
    .eq("id", created.user.id);
  if (updateError) {
    return NextResponse.json(
      { error: "Account angelegt, Rolle konnte aber nicht gesetzt werden." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test without a valid token**

Run: `curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/admin/create-user -H "Content-Type: application/json" -d '{"email":"x@x.de","password":"password123","name":"X","role":"CUSTOMER"}'`
(Requires `npm run dev` running in another terminal.)
Expected: `403` (no `Authorization` header sent).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/create-user/route.ts
git commit -m "feat: add admin-only create-user API route using service_role key"
```

---

### Task 3: Admin UI form

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/create-user` (Task 2), `supabase` (browser client, `@/lib/supabase/client`, already exists from the prior Supabase-auth-integration plan), existing `load()` function in this file (re-fetches `instructors` via `repo.getInstructors()`).

- [ ] **Step 1: Add the `supabase` import**

In `src/app/admin/page.tsx`, find this existing import block near the top:

```ts
import { getWindThresholds, saveWindThresholds } from "@/lib/wind/config";
import type { WindThresholds } from "@/lib/wind/categorize";
```

Add a new import line right after it:

```ts
import { getWindThresholds, saveWindThresholds } from "@/lib/wind/config";
import type { WindThresholds } from "@/lib/wind/categorize";
import { supabase } from "@/lib/supabase/client";
```

- [ ] **Step 2: Add state for the new form**

Find this existing block (the course-editing state, near the end of the component's state declarations):

```ts
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseDraftName, setCourseDraftName] = useState("");
  const [courseDraftPriceEuro, setCourseDraftPriceEuro] = useState("");
  const [courseDraftActive, setCourseDraftActive] = useState(true);
  const [savingCourse, setSavingCourse] = useState(false);
```

Add right after it:

```ts
  const [newAccountEmail, setNewAccountEmail] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountRole, setNewAccountRole] = useState<"CUSTOMER" | "INSTRUCTOR">("CUSTOMER");
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [createAccountError, setCreateAccountError] = useState<string | null>(null);
  const [createdAccountInfo, setCreatedAccountInfo] = useState<{ email: string; password: string } | null>(null);
```

- [ ] **Step 3: Add the handler function**

Find this existing function (in the same file):

```ts
  async function handleCreateWindow(e: React.FormEvent) {
    e.preventDefault();
    if (!newWindowStart || !newWindowEnd) return;
    setCreatingWindow(true);
    await getRepository().createWindow({
      startsAt: new Date(newWindowStart).toISOString(),
      endsAt: new Date(newWindowEnd).toISOString(),
      courseCategory: newWindowCategory,
      createdByAdminId: user.id,
    });
    setNewWindowStart("");
    setNewWindowEnd("");
    await load();
    setCreatingWindow(false);
  }
```

Add a new function right after it:

```ts
  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setCreateAccountError(null);
    setCreatedAccountInfo(null);
    if (!newAccountEmail.trim() || !newAccountName.trim() || newAccountPassword.length < 8) {
      setCreateAccountError("Bitte alle Felder ausfüllen (Passwort mind. 8 Zeichen).");
      return;
    }
    setCreatingAccount(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        email: newAccountEmail.trim(),
        password: newAccountPassword,
        name: newAccountName.trim(),
        role: newAccountRole,
      }),
    });
    const result = await res.json();
    setCreatingAccount(false);
    if (!res.ok) {
      setCreateAccountError(result.error ?? "Account konnte nicht angelegt werden.");
      return;
    }
    setCreatedAccountInfo({ email: newAccountEmail.trim(), password: newAccountPassword });
    setNewAccountEmail("");
    setNewAccountPassword("");
    setNewAccountName("");
    setNewAccountRole("CUSTOMER");
    await load();
  }
```

- [ ] **Step 4: Add the form JSX**

Find this exact block (the closing of the "Lehrer-Team" list, right before the "Verfügbarkeit für Lehrer freigeben" heading):

```tsx
          <h2 className="mt-8 text-sm font-semibold text-foreground">Lehrer-Team</h2>
          <div className="mt-2 flex flex-col divide-y divide-lf-border rounded-2xl border border-lf-border bg-lf-card">
            {instructors.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lf-ocean-light text-xs font-bold text-lf-ocean">
                  {i.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <p className="text-sm font-medium text-foreground">{i.name}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-sm font-semibold text-foreground">Verfügbarkeit für Lehrer freigeben</h2>
```

Replace it with (identical content, plus the new section inserted between the two `<h2>` blocks):

```tsx
          <h2 className="mt-8 text-sm font-semibold text-foreground">Lehrer-Team</h2>
          <div className="mt-2 flex flex-col divide-y divide-lf-border rounded-2xl border border-lf-border bg-lf-card">
            {instructors.map((i) => (
              <div key={i.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-lf-ocean-light text-xs font-bold text-lf-ocean">
                  {i.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
                <p className="text-sm font-medium text-foreground">{i.name}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-8 text-sm font-semibold text-foreground">Account anlegen</h2>
          <form
            onSubmit={handleCreateAccount}
            className="mt-2 flex flex-col gap-3 rounded-2xl border border-lf-border bg-lf-card p-5"
          >
            <input
              type="email"
              value={newAccountEmail}
              onChange={(e) => setNewAccountEmail(e.target.value)}
              placeholder="E-Mail-Adresse"
              required
              className="rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newAccountPassword}
              onChange={(e) => setNewAccountPassword(e.target.value)}
              placeholder="Passwort (mind. 8 Zeichen)"
              required
              className="rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Name"
              required
              className="rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
            />
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input
                  type="radio"
                  name="newAccountRole"
                  checked={newAccountRole === "CUSTOMER"}
                  onChange={() => setNewAccountRole("CUSTOMER")}
                />
                Kunde
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input
                  type="radio"
                  name="newAccountRole"
                  checked={newAccountRole === "INSTRUCTOR"}
                  onChange={() => setNewAccountRole("INSTRUCTOR")}
                />
                Lehrer
              </label>
            </div>
            {createAccountError && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400">{createAccountError}</p>
            )}
            <button
              type="submit"
              disabled={creatingAccount}
              className="self-start rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creatingAccount ? "Erstelle…" : "Account anlegen"}
            </button>
          </form>

          {createdAccountInfo && (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Account angelegt!</p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300">
                Login-Link:{" "}
                <span className="select-all font-mono">
                  {typeof window !== "undefined" ? window.location.origin + "/" : ""}
                </span>
              </p>
              <p className="text-emerald-700 dark:text-emerald-300">
                E-Mail: <span className="select-all font-mono">{createdAccountInfo.email}</span>
              </p>
              <p className="text-emerald-700 dark:text-emerald-300">
                Passwort: <span className="select-all font-mono">{createdAccountInfo.password}</span>
              </p>
            </div>
          )}

          <h2 className="mt-8 text-sm font-semibold text-foreground">Verfügbarkeit für Lehrer freigeben</h2>
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Verify lint is unaffected**

Run: `npm run lint`
Expected: no NEW problems compared to before this change (the repo has pre-existing unrelated lint findings — don't introduce new ones in `admin/page.tsx`).

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add account-creation form to admin Verwaltung tab"
```

---

## Final verification

- [ ] Run `npx tsc --noEmit` — no errors.
- [ ] Run `npm run lint` — no new problems.
- [ ] Run `npm run dev`, log in as an existing admin account.
- [ ] Go to `/admin` → „Verwaltung“-Tab → fill out the new form for a test Kunde account (a real, not-yet-used email + password ≥ 8 chars) → submit.
- [ ] Confirm the success box shows the login link, email, and password.
- [ ] Log out, log back in with the new Kunde credentials → confirm it lands on `/dashboard`.
- [ ] Repeat once more with role "Lehrer" → confirm the new name appears in the "Lehrer-Team" list without a page reload, and that logging in with those credentials lands on `/instructor`.
- [ ] Try submitting the same email a second time → confirm the "bereits vergeben" error shows, no crash.

## Deployment note (not a task — tell the user, don't act)

`SUPABASE_SERVICE_ROLE_KEY` must also be added to the Vercel project's Environment Variables (same place `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` were added) before this works in production — it's already in local `.env.local`, which is never deployed.
