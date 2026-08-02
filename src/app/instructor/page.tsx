"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getRepository,
  type CourseOffering,
  type InstructorSlotRequest,
  type Slot,
  type User,
} from "@/lib/data/repository";
import { formatDateTime } from "@/lib/format";
import { useAuthUser } from "@/lib/auth/AuthContext";
import { signOut } from "@/lib/auth/session";

type Tab = "verfuegbarkeit" | "schueler" | "anfragen";

interface StudentRow {
  slot: Slot;
  course: CourseOffering;
  customerName: string;
}

export default function InstructorPage() {
  const router = useRouter();
  const user = useAuthUser();
  const [tab, setTab] = useState<Tab>("verfuegbarkeit");
  const [instructor, setInstructor] = useState<User | null>(null);
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [openSlots, setOpenSlots] = useState<Slot[]>([]);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [requests, setRequests] = useState<InstructorSlotRequest[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [reqCourseId, setReqCourseId] = useState("");
  const [reqStart, setReqStart] = useState("");
  const [reqEnd, setReqEnd] = useState("");
  const [reqSubmitting, setReqSubmitting] = useState(false);

  async function load() {
    const repo = getRepository();
    const [me, allCourses, allSlots, allBookings, mySlots, myRequests] = await Promise.all([
      repo.getCustomer(user.id),
      repo.getCourses(),
      repo.getSlots(),
      repo.getAllBookings(),
      repo.getMySlots(user.id),
      repo.getMyRequests(user.id),
    ]);

    setInstructor(me);
    setCourses(allCourses);
    setOpenSlots(allSlots.filter((s) => !s.instructorId && s.status === "OPEN"));
    setRequests(myRequests);

    const courseById = new Map(allCourses.map((c) => [c.id, c]));
    const rows: StudentRow[] = [];
    for (const slot of mySlots.filter((s) => s.status === "BOOKED" || s.bookedCount > 0)) {
      const course = courseById.get(slot.courseOfferingId);
      if (!course) continue;
      const bookingsForSlot = allBookings.filter((b) => b.slotId === slot.id && b.status === "CONFIRMED");
      for (const booking of bookingsForSlot) {
        const student = await repo.getCustomer(booking.customerId);
        rows.push({ slot, course, customerName: student?.name ?? "Unbekannt" });
      }
    }
    rows.sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));
    setStudentRows(rows);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleClaim(slotId: string) {
    setClaimingId(slotId);
    await getRepository().claimSlot(slotId, user.id);
    await load();
    setClaimingId(null);
  }

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqCourseId || !reqStart || !reqEnd) return;
    setReqSubmitting(true);
    await getRepository().createInstructorRequest({
      instructorId: user.id,
      courseOfferingId: reqCourseId,
      requestedStartsAt: reqStart,
      requestedEndsAt: reqEnd,
    });
    setReqStart("");
    setReqEnd("");
    await load();
    setReqSubmitting(false);
  }

  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <main className="flex-1 px-5 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-lf-muted">Lehrer-Bereich</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground">
            {instructor?.name ?? "…"}
          </h1>
        </div>
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="shrink-0 rounded-full border border-lf-border px-3 py-1.5 text-xs font-semibold text-foreground"
        >
          Abmelden
        </button>
      </div>

      <div className="mt-6 flex gap-2">
        {(
          [
            ["verfuegbarkeit", "Verfügbarkeit"],
            ["schueler", "Meine Schüler"],
            ["anfragen", "Anfragen"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={
              tab === value
                ? "rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full bg-lf-ocean-light px-4 py-2 text-sm font-medium text-lf-ocean"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "verfuegbarkeit" && (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-sm text-lf-muted">
            Offene Zeitfenster aus freigegebenen Fenstern der Schulleitung — einfach übernehmen.
          </p>
          {openSlots.length === 0 && (
            <p className="text-sm text-lf-muted">Aktuell keine freien Zeitfenster zum Übernehmen.</p>
          )}
          {openSlots.map((slot) => {
            const course = courseById.get(slot.courseOfferingId);
            return (
              <div
                key={slot.id}
                className="flex items-center justify-between gap-4 rounded-2xl border border-lf-border bg-lf-card p-5"
              >
                <div>
                  <p className="font-semibold text-foreground">{course?.name}</p>
                  <p className="mt-1 text-sm text-lf-muted">{formatDateTime(slot.startsAt)}</p>
                </div>
                <button
                  onClick={() => handleClaim(slot.id)}
                  disabled={claimingId === slot.id}
                  className="shrink-0 rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {claimingId === slot.id ? "…" : "Übernehmen"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {tab === "schueler" && (
        <div className="mt-6 flex flex-col gap-3">
          {studentRows.length === 0 && (
            <p className="text-sm text-lf-muted">Noch keine Schüler zugeteilt.</p>
          )}
          {studentRows.map((row, i) => (
            <div key={i} className="rounded-2xl border border-lf-border bg-lf-card p-5">
              <div className="flex items-baseline justify-between">
                <p className="font-semibold text-foreground">{row.customerName}</p>
                <p className="text-sm text-lf-muted">{formatDateTime(row.slot.startsAt)}</p>
              </div>
              <p className="mt-1 text-sm text-lf-muted">{row.course.name}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "anfragen" && (
        <div className="mt-6">
          <form
            onSubmit={handleCreateRequest}
            className="flex flex-col gap-3 rounded-2xl border border-lf-border bg-lf-card p-5"
          >
            <p className="text-sm font-semibold text-foreground">Zusätzliche Zeit anfragen</p>
            <select
              value={reqCourseId}
              onChange={(e) => setReqCourseId(e.target.value)}
              required
              className="rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Angebot wählen…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="flex gap-3">
              <input
                type="datetime-local"
                value={reqStart}
                onChange={(e) => setReqStart(e.target.value)}
                required
                className="flex-1 rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
              />
              <input
                type="datetime-local"
                value={reqEnd}
                onChange={(e) => setReqEnd(e.target.value)}
                required
                className="flex-1 rounded-lg border border-lf-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={reqSubmitting}
              className="self-start rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {reqSubmitting ? "Sende…" : "Anfrage stellen"}
            </button>
          </form>

          <div className="mt-6 flex flex-col gap-3">
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
                {r.adminNote && <p className="mt-1 text-sm text-lf-muted">Notiz: {r.adminNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
