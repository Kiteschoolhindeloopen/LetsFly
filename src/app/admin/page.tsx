"use client";

import { useEffect, useState } from "react";
import {
  getRepository,
  type AvailabilityWindow,
  type Booking,
  type CourseCategory,
  type CourseOffering,
  type InstructorSlotRequest,
  type PackageRequest,
  type Slot,
  type User,
} from "@/lib/data/repository";
import { categoryLabels, formatDateTime, formatEuro } from "@/lib/format";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { DEMO_ADMIN_ID } from "@/lib/demoSession";

type Tab = "uebersicht" | "wind" | "anfragen" | "kundenanfragen" | "verwaltung";

interface BookingRow {
  booking: Booking;
  slot: Slot;
  course: CourseOffering;
  customerName: string;
  instructorName?: string;
}

const WIND_PRESETS = [
  { key: "today", label: "Heute" },
  { key: "tomorrow", label: "Morgen" },
  { key: "weekend", label: "Dieses Wochenende" },
] as const;

function presetRange(key: (typeof WIND_PRESETS)[number]["key"]): [Date, Date] {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (key === "today") {
    const start = startOfDay(now);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [start, end];
  }
  if (key === "tomorrow") {
    const start = startOfDay(now);
    start.setDate(start.getDate() + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return [start, end];
  }
  const start = startOfDay(now);
  const day = start.getDay();
  const daysUntilSaturday = (6 - day + 7) % 7;
  start.setDate(start.getDate() + daysUntilSaturday);
  const end = new Date(start);
  end.setDate(end.getDate() + 2);
  return [start, end];
}

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("uebersicht");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [instructors, setInstructors] = useState<User[]>([]);
  const [requests, setRequests] = useState<InstructorSlotRequest[]>([]);
  const [packageRequests, setPackageRequests] = useState<PackageRequest[]>([]);
  const [windows, setWindows] = useState<AvailabilityWindow[]>([]);

  const [newWindowStart, setNewWindowStart] = useState("");
  const [newWindowEnd, setNewWindowEnd] = useState("");
  const [newWindowCategory, setNewWindowCategory] = useState<CourseCategory>("PRIVATE_HOURS");
  const [creatingWindow, setCreatingWindow] = useState(false);

  const [windPreset, setWindPreset] = useState<(typeof WIND_PRESETS)[number]["key"] | null>(null);
  const [windDone, setWindDone] = useState(false);
  const [windCancelledRows, setWindCancelledRows] = useState<BookingRow[] | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [processingPkgRequestId, setProcessingPkgRequestId] = useState<string | null>(null);
  const [proposingId, setProposingId] = useState<string | null>(null);
  const [proposedDateInput, setProposedDateInput] = useState("");

  async function load() {
    const repo = getRepository();
    const [allBookings, allCourses, allSlots, allInstructors, allRequests, allPackageRequests, allWindows] =
      await Promise.all([
        repo.getAllBookings(),
        repo.getCourses(),
        repo.getSlots(),
        repo.getInstructors(),
        repo.getAllRequests(),
        repo.getAllPackageRequests(),
        repo.getAvailabilityWindows(),
      ]);

    const courseById = new Map(allCourses.map((c) => [c.id, c]));
    const slotById = new Map(allSlots.map((s) => [s.id, s]));
    const instructorNameById = new Map(allInstructors.map((i) => [i.id, i.name]));

    const built: BookingRow[] = [];
    for (const booking of allBookings.filter((b) => b.status === "CONFIRMED")) {
      const slot = slotById.get(booking.slotId);
      const course = slot && courseById.get(slot.courseOfferingId);
      if (!slot || !course) continue;
      const customer = await repo.getCustomer(booking.customerId);
      built.push({
        booking,
        slot,
        course,
        customerName: customer?.name ?? "Unbekannt",
        instructorName: slot.instructorId ? instructorNameById.get(slot.instructorId) : undefined,
      });
    }
    built.sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));

    setRows(built);
    setCourses(allCourses);
    setInstructors(allInstructors);
    setRequests(allRequests);
    setPackageRequests(allPackageRequests);
    setWindows(allWindows.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  }

  useEffect(() => {
    load();
  }, []);

  useLiveRefresh(load);

  const windAffected =
    windPreset &&
    rows.filter((r) => {
      const [start, end] = presetRange(windPreset);
      const startsAt = new Date(r.slot.startsAt);
      return startsAt >= start && startsAt < end;
    });

  async function handleWindCancel() {
    if (!windAffected) return;
    const repo = getRepository();
    for (const row of windAffected) {
      await repo.cancelBooking(row.booking.id);
      await repo.createNotification({
        customerId: row.booking.customerId,
        icon: "💨",
        title: "Termin abgesagt",
        message: `Dein Termin am ${formatDateTime(row.slot.startsAt)} wurde wegen Windvorhersage abgesagt.`,
      });
    }
    setWindCancelledRows(windAffected);
    setWindDone(true);
    await load();
  }

  async function handleResolveRequest(requestId: string, decision: "APPROVED" | "REJECTED") {
    setProcessingRequestId(requestId);
    await getRepository().resolveRequest(requestId, decision);
    await load();
    setProcessingRequestId(null);
  }

  async function handleResolvePackageRequest(requestId: string, decision: "APPROVED" | "REJECTED") {
    setProcessingPkgRequestId(requestId);
    await getRepository().resolvePackageRequest(requestId, decision);
    await load();
    setProcessingPkgRequestId(null);
  }

  async function handleCreateWindow(e: React.FormEvent) {
    e.preventDefault();
    if (!newWindowStart || !newWindowEnd) return;
    setCreatingWindow(true);
    await getRepository().createWindow({
      startsAt: new Date(newWindowStart).toISOString(),
      endsAt: new Date(newWindowEnd).toISOString(),
      courseCategory: newWindowCategory,
      createdByAdminId: DEMO_ADMIN_ID,
    });
    setNewWindowStart("");
    setNewWindowEnd("");
    await load();
    setCreatingWindow(false);
  }

  async function handleProposeDate(requestId: string) {
    if (!proposedDateInput) return;
    setProcessingPkgRequestId(requestId);
    await getRepository().proposeAlternativeDate(requestId, new Date(proposedDateInput).toISOString());
    setProposingId(null);
    setProposedDateInput("");
    await load();
    setProcessingPkgRequestId(null);
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <main className="flex-1 px-5 py-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-lf-muted">Admin-Bereich</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">LetsFly Verwaltung</h1>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["uebersicht", "Übersicht"],
            ["wind", "Wind-Absage"],
            ["anfragen", "Anfragen"],
            ["kundenanfragen", "Kundenanfragen"],
            ["verwaltung", "Verwaltung"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full bg-lf-ocean-light px-4 py-2 text-sm font-medium text-foreground"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "uebersicht" && (
        <div className="mt-6">
          <div className="flex gap-3">
            <div className="flex-1 rounded-2xl bg-lf-ocean-light p-4">
              <p className="text-2xl font-bold text-lf-ocean">{rows.length}</p>
              <p className="mt-1 text-xs text-lf-muted">Bevorstehende Buchungen</p>
            </div>
            <div className="flex-1 rounded-2xl bg-amber-50 p-4 dark:bg-amber-950">
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {new Set(rows.map((r) => r.customerName)).size}
              </p>
              <p className="mt-1 text-xs text-lf-muted">Aktive Kunden</p>
            </div>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-foreground">Alle bevorstehenden Buchungen</h2>
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((r) => (
              <div key={r.booking.id} className="flex items-center gap-3 rounded-xl border border-lf-border p-3">
                <span className="w-32 shrink-0 text-sm font-semibold text-lf-ocean">
                  {formatDateTime(r.slot.startsAt)}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{r.customerName}</p>
                  <p className="text-xs text-lf-muted">
                    {r.course.name}
                    {r.instructorName ? ` · ${r.instructorName}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "wind" && (
        <div className="mt-6">
          <p className="text-sm leading-relaxed text-lf-muted">
            Zeitraum wählen — betroffene Termine werden automatisch abgesagt und Kunden per Nachricht informiert.
          </p>
          <div className="mt-4 flex gap-2">
            {WIND_PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setWindPreset(p.key);
                  setWindDone(false);
                  setWindCancelledRows(null);
                }}
                className={
                  windPreset === p.key
                    ? "flex-1 rounded-xl bg-red-500 px-3 py-3 text-sm font-semibold text-white"
                    : "flex-1 rounded-xl border border-lf-border px-3 py-3 text-sm font-medium text-foreground"
                }
              >
                {p.label}
              </button>
            ))}
          </div>

          {(windCancelledRows ?? windAffected) && (
            <div className="mt-6">
              <p className="text-sm font-semibold text-foreground">
                {(windCancelledRows ?? windAffected)!.length} betroffene Termine
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {(windCancelledRows ?? windAffected)!.map((r) => (
                  <div key={r.booking.id} className="flex items-center gap-3 rounded-xl border border-lf-border p-3">
                    <span className="w-32 shrink-0 text-sm font-semibold text-red-600">
                      {formatDateTime(r.slot.startsAt)}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{r.customerName}</p>
                      <p className="text-xs text-lf-muted">
                        {r.course.name}
                        {r.instructorName ? ` · ${r.instructorName}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {windDone ? (
                <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  ✓ Alle Termine abgesagt · Kunden benachrichtigt
                </p>
              ) : (
                <button
                  onClick={handleWindCancel}
                  disabled={!windAffected || windAffected.length === 0}
                  className="mt-4 w-full rounded-xl bg-red-500 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Alle absagen &amp; Kunden benachrichtigen
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "anfragen" && (
        <div className="mt-6 flex flex-col gap-3">
          {requests.length === 0 && (
            <p className="text-sm text-lf-muted">Keine Instruktor-Anfragen vorhanden.</p>
          )}
          {requests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-lf-border bg-lf-card p-5">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-foreground">{courseById.get(r.courseOfferingId)?.name}</p>
                <span
                  className={
                    r.status === "PENDING"
                      ? "rounded-md bg-lf-sand px-2 py-0.5 text-xs font-semibold text-white"
                      : r.status === "APPROVED"
                        ? "rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white"
                        : "rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white"
                  }
                >
                  {r.status === "PENDING" ? "Ausstehend" : r.status === "APPROVED" ? "Genehmigt" : "Abgelehnt"}
                </span>
              </div>
              <p className="mt-1 text-sm text-lf-muted">
                {formatDateTime(r.requestedStartsAt)} – {formatDateTime(r.requestedEndsAt)}
              </p>
              {r.status === "PENDING" && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleResolveRequest(r.id, "APPROVED")}
                    disabled={processingRequestId === r.id}
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Genehmigen
                  </button>
                  <button
                    onClick={() => handleResolveRequest(r.id, "REJECTED")}
                    disabled={processingRequestId === r.id}
                    className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                  >
                    Ablehnen
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "kundenanfragen" && (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-lf-muted">
            Anfragen von Kunden für Pakete/Stunden zu einem Wunschdatum — inklusive Login-E-Mail zur Kontaktaufnahme.
          </p>
          {packageRequests.length === 0 && (
            <p className="text-sm text-lf-muted">Keine Kundenanfragen vorhanden.</p>
          )}
          {packageRequests.map((r) => (
            <div key={r.id} className="rounded-2xl border border-lf-border bg-lf-card p-5">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-foreground">{courseById.get(r.courseOfferingId)?.name}</p>
                <span
                  className={
                    r.status === "PENDING"
                      ? "rounded-md bg-lf-sand px-2 py-0.5 text-xs font-semibold text-white"
                      : r.status === "APPROVED"
                        ? "rounded-md bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white"
                        : r.status === "DATE_PROPOSED"
                          ? "rounded-md bg-lf-ocean px-2 py-0.5 text-xs font-semibold text-white"
                          : "rounded-md bg-red-500 px-2 py-0.5 text-xs font-semibold text-white"
                  }
                >
                  {r.status === "PENDING"
                    ? "Ausstehend"
                    : r.status === "APPROVED"
                      ? "Genehmigt"
                      : r.status === "DATE_PROPOSED"
                        ? "Neues Datum vorgeschlagen"
                        : "Abgelehnt"}
                </span>
              </div>
              <p className="mt-1 text-sm text-lf-muted">
                Wunschdatum: {new Date(r.requestedDate).toLocaleDateString("de-DE")}
              </p>
              {r.proposedDate && (
                <p className="mt-1 text-sm text-lf-muted">
                  Vorschlag: {new Date(r.proposedDate).toLocaleDateString("de-DE")}
                </p>
              )}
              <p className="mt-1 text-sm text-lf-muted">📧 {r.customerEmail}</p>
              {r.note && <p className="mt-1 text-sm text-lf-muted">„{r.note}"</p>}
              {r.status === "PENDING" && (
                <>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleResolvePackageRequest(r.id, "APPROVED")}
                      disabled={processingPkgRequestId === r.id}
                      className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Bestätigen
                    </button>
                    <button
                      onClick={() => {
                        setProposingId(proposingId === r.id ? null : r.id);
                        setProposedDateInput("");
                      }}
                      className="rounded-full border border-lf-border px-4 py-2 text-sm font-semibold text-foreground"
                    >
                      Anderes Datum vorschlagen
                    </button>
                    <button
                      onClick={() => handleResolvePackageRequest(r.id, "REJECTED")}
                      disabled={processingPkgRequestId === r.id}
                      className="rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 disabled:opacity-50"
                    >
                      Ablehnen
                    </button>
                  </div>
                  {proposingId === r.id && (
                    <div className="mt-3 flex gap-2 rounded-xl bg-lf-ocean-light p-3">
                      <input
                        type="date"
                        value={proposedDateInput}
                        onChange={(e) => setProposedDateInput(e.target.value)}
                        className="flex-1 rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
                      />
                      <button
                        onClick={() => handleProposeDate(r.id)}
                        disabled={!proposedDateInput || processingPkgRequestId === r.id}
                        className="rounded-lg bg-lf-ocean px-3.5 py-2 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Senden
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "verwaltung" && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground">Pakete &amp; Preise</h2>
          <div className="mt-2 flex flex-col divide-y divide-lf-border rounded-2xl border border-lf-border bg-lf-card">
            {courses.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                <p className="text-sm font-bold text-lf-ocean">{formatEuro(c.priceCents)}</p>
              </div>
            ))}
          </div>

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
          <p className="mt-1 text-sm text-lf-muted">
            Zeitraum freigeben — pro passendem Angebot entsteht ein offenes Zeitfenster, das Lehrer unter
            „Verfügbarkeit“ übernehmen können.
          </p>
          <form
            onSubmit={handleCreateWindow}
            className="mt-3 flex flex-col gap-3 rounded-2xl border border-lf-border bg-lf-card p-5"
          >
            <select
              value={newWindowCategory}
              onChange={(e) => setNewWindowCategory(e.target.value as CourseCategory)}
              className="rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
            >
              <option value="PRIVATE_HOURS">{categoryLabels.PRIVATE_HOURS}</option>
              <option value="GROUP_CAMP">{categoryLabels.GROUP_CAMP}</option>
            </select>
            <div className="flex gap-3">
              <input
                type="datetime-local"
                value={newWindowStart}
                onChange={(e) => setNewWindowStart(e.target.value)}
                required
                className="flex-1 rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={newWindowEnd}
                onChange={(e) => setNewWindowEnd(e.target.value)}
                required
                className="flex-1 rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={creatingWindow}
              className="self-start rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creatingWindow ? "Erstelle…" : "Zeitfenster freigeben"}
            </button>
          </form>

          <div className="mt-3 flex flex-col gap-2">
            {windows.length === 0 && <p className="text-sm text-lf-muted">Noch keine Zeitfenster freigegeben.</p>}
            {windows.map((w) => (
              <div key={w.id} className="flex items-center justify-between gap-3 rounded-xl border border-lf-border p-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatDateTime(w.startsAt)} – {formatDateTime(w.endsAt)}
                  </p>
                  <p className="text-xs text-lf-muted">
                    {w.courseCategory ? categoryLabels[w.courseCategory] : "Alle Angebote"}
                  </p>
                </div>
                <span className="shrink-0 rounded-md bg-lf-ocean-light px-2 py-0.5 text-[10.5px] font-bold text-lf-ocean">
                  {w.status === "OPEN" ? "Offen" : w.status === "CLAIMED" ? "Übernommen" : "Voll"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
