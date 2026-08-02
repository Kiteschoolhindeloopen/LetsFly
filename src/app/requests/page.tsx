"use client";

import { useEffect, useState } from "react";
import {
  getRepository,
  type CourseOffering,
  type PackageRequest,
} from "@/lib/data/repository";
import { formatEuro } from "@/lib/format";
import { useAuthUser } from "@/lib/auth/AuthContext";
import { useLiveRefresh } from "@/lib/useLiveRefresh";

function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<PackageRequest["status"], string> = {
  PENDING: "Ausstehend",
  APPROVED: "Bestätigt",
  REJECTED: "Abgelehnt",
  DATE_PROPOSED: "Neuer Termin vorgeschlagen",
};

const STATUS_STYLE: Record<PackageRequest["status"], string> = {
  PENDING: "bg-lf-sand text-white",
  APPROVED: "bg-emerald-500 text-white",
  REJECTED: "bg-red-500 text-white",
  DATE_PROPOSED: "bg-lf-ocean text-white",
};

export default function RequestsPage() {
  const user = useAuthUser();
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [myRequests, setMyRequests] = useState<PackageRequest[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");

  const [courseId, setCourseId] = useState("");
  const [date, setDate] = useState(todayIsoDate());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function load() {
    const repo = getRepository();
    const [allCourses, customer, requests] = await Promise.all([
      repo.getCourses(),
      repo.getCustomer(user.id),
      repo.getMyPackageRequests(user.id),
    ]);
    setCourses(allCourses);
    setCustomerEmail(customer?.email ?? "");
    setMyRequests(requests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  useEffect(() => {
    load();
  }, []);

  useLiveRefresh(load);

  async function handleRespond(requestId: string, accept: boolean) {
    await getRepository().respondToProposedDate(requestId, accept);
    await load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || !date) return;
    setSubmitting(true);
    await getRepository().createPackageRequest({
      customerId: user.id,
      courseOfferingId: courseId,
      requestedDate: new Date(date).toISOString(),
      note: note || undefined,
    });
    setSubmitted(true);
    setNote("");
    await load();
    setSubmitting(false);
  }

  return (
    <div className="lf-scroll flex flex-1 flex-col overflow-y-auto px-5 py-6 pb-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Stunden/Paket anfragen</h1>
      <p className="mt-2 text-lf-muted">
        Wähle ein Paket und dein Wunschdatum — die Schulleitung bestätigt deine Anfrage.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-5 flex flex-col gap-3 rounded-2xl border border-lf-border bg-lf-card p-5"
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Paket / Angebot</label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            required
            className="w-full rounded-lg border border-lf-border bg-background px-3 py-2.5 text-sm"
          >
            <option value="">Bitte wählen…</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {formatEuro(c.priceCents)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Wunschdatum</label>
          <input
            type="date"
            value={date}
            min={todayIsoDate()}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-lg border border-lf-border bg-background px-3 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-foreground">Nachricht (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="z. B. bevorzugte Uhrzeit, Level, Wünsche…"
            className="w-full rounded-lg border border-lf-border bg-background px-3 py-2.5 text-sm"
          />
        </div>

        <p className="text-xs text-lf-muted">
          Deine Anfrage wird mit <span className="font-semibold text-foreground">{customerEmail}</span> an die
          Schulleitung gesendet.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="mt-1 w-full rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {submitting ? "Sende…" : "Anfrage senden"}
        </button>

        {submitted && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            ✓ Anfrage gesendet — du wirst benachrichtigt, sobald sie bestätigt ist.
          </p>
        )}
      </form>

      <h2 className="mb-2.5 mt-7 text-[13px] font-bold text-foreground">Meine Anfragen</h2>
      <div className="flex flex-col gap-2.5">
        {myRequests.length === 0 && <p className="text-sm text-lf-muted">Noch keine Anfragen gestellt.</p>}
        {myRequests.map((r) => {
          const course = courses.find((c) => c.id === r.courseOfferingId);
          return (
            <div key={r.id} className="rounded-2xl border border-lf-border p-3.5">
              <div className="flex items-baseline justify-between">
                <p className="text-[13.5px] font-bold text-foreground">{course?.name ?? "Angebot"}</p>
                <span className={`rounded-lg px-2 py-0.5 text-[10.5px] font-bold ${STATUS_STYLE[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <p className="mt-1 text-xs text-lf-muted">
                Wunschdatum: {new Date(r.requestedDate).toLocaleDateString("de-DE")}
              </p>
              {r.note && <p className="mt-1 text-xs text-lf-muted">„{r.note}"</p>}
              {r.adminNote && (
                <p className="mt-1 text-xs text-lf-muted">Antwort der Schule: {r.adminNote}</p>
              )}
              {r.status === "DATE_PROPOSED" && r.proposedDate && (
                <div className="mt-3 rounded-xl bg-lf-ocean-light p-3">
                  <p className="text-xs font-semibold text-lf-ocean">
                    Neuer Vorschlag: {new Date(r.proposedDate).toLocaleDateString("de-DE")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => handleRespond(r.id, true)}
                      className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-white"
                    >
                      Termin annehmen
                    </button>
                    <button
                      onClick={() => handleRespond(r.id, false)}
                      className="flex-1 rounded-lg border border-red-300 px-3 py-2 text-xs font-bold text-red-600"
                    >
                      Ablehnen
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
