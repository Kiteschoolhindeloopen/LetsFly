"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  getRepository,
  type CourseCategory,
  type CourseOffering,
  type HourPackagePurchase,
  type Slot,
} from "@/lib/data/repository";
import { categoryLabels, formatDateTime, formatEuro } from "@/lib/format";
import { getCurrentCustomerId } from "@/lib/demoSession";
import { WaiverConsent } from "@/components/WaiverConsent";
import { fetchHourlyWindKn, windHourKey } from "@/lib/wind/openMeteo";
import { getWindThresholds } from "@/lib/wind/config";
import { categorizeWind, WIND_TONE_TEXT_CLASS } from "@/lib/wind/categorize";

const HOURS = [10, 11, 12, 13, 14, 15, 16, 17];
const WEEKDAY_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d;
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

interface Cell {
  date: Date;
  hour: number;
  iso: string;
  isPast: boolean;
  isBooked: boolean;
}

interface CampRow {
  slot: Slot;
  course: CourseOffering;
  freeSeats: number;
}

function HourPicker({ courseOfferingId, course }: { courseOfferingId: string; course: CourseOffering }) {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [bookedIsoSet, setBookedIsoSet] = useState<Set<string>>(new Set());
  const [pkg, setPkg] = useState<HourPackagePurchase | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [booking, setBooking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [windByHour, setWindByHour] = useState<Map<string, number> | null>(null);
  const [windThresholds] = useState(() => getWindThresholds());

  useEffect(() => {
    fetchHourlyWindKn()
      .then(setWindByHour)
      .catch(() => setWindByHour(null));
  }, []);

  const weekStart = new Date(startOfWeek(new Date()));
  weekStart.setDate(weekStart.getDate() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  async function load() {
    const repo = getRepository();
    const [slots, packages] = await Promise.all([
      repo.getSlots({ from: weekStart.toISOString(), to: weekEnd.toISOString() }),
      repo.getMyPackages(getCurrentCustomerId()),
    ]);
    const taken = new Set(
      slots
        .filter((s) => s.courseOfferingId === courseOfferingId && s.bookedCount >= s.capacity)
        .map((s) => s.startsAt)
    );
    setBookedIsoSet(taken);
    setPkg(packages.find((p) => p.courseOfferingId === courseOfferingId) ?? packages[0] ?? null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, courseOfferingId]);

  const now = new Date();
  const days: { date: Date; label: string; cells: Cell[] }[] = Array.from({ length: 7 }).map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const cells: Cell[] = HOURS.map((hour) => {
      const cellDate = new Date(date);
      cellDate.setHours(hour, 0, 0, 0);
      const iso = cellDate.toISOString();
      return {
        date: cellDate,
        hour,
        iso,
        isPast: cellDate < now,
        isBooked: bookedIsoSet.has(iso),
      };
    });
    return {
      date,
      label: `${WEEKDAY_LABELS[i]}, ${pad(date.getDate())}.${pad(date.getMonth() + 1)}.`,
      cells,
    };
  });

  function openCell(cell: Cell) {
    if (cell.isPast || cell.isBooked) return;
    setErrorMessage(null);
    setConfirmed(false);
    setWaiverAccepted(false);
    setSelected(cell);
  }

  async function handleConfirm() {
    if (!selected) return;
    setBooking(true);
    setErrorMessage(null);
    try {
      const endsAt = new Date(selected.date);
      endsAt.setHours(endsAt.getHours() + 1);
      await getRepository().bookHourSlot({
        customerId: getCurrentCustomerId(),
        courseOfferingId,
        hourPackagePurchaseId: pkg?.id,
        startsAt: selected.date.toISOString(),
        endsAt: endsAt.toISOString(),
        waiverAccepted,
      });
      setConfirmed(true);
      await load();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Buchung fehlgeschlagen");
    } finally {
      setBooking(false);
    }
  }

  const remaining = pkg ? pkg.totalHours - pkg.hoursScheduled - pkg.hoursCompleted : null;

  return (
    <div>
      {pkg && (
        <p className="mt-4 text-xs font-semibold text-lf-ocean">
          {remaining} von {pkg.totalHours} Stunden übrig aus deinem Paket
        </p>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
          disabled={weekOffset === 0}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-lf-border text-sm disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-[13.5px] font-bold text-foreground">
          {weekOffset === 0 ? "Diese Woche" : `+${weekOffset} Woche${weekOffset > 1 ? "n" : ""}`}
        </p>
        <button
          onClick={() => setWeekOffset((w) => w + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-lf-border text-sm"
        >
          ›
        </button>
      </div>

      {errorMessage && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3.5">
        {days.map((day) => (
          <div key={day.label}>
            <p className="mb-2 text-xs font-bold text-foreground">{day.label}</p>
            <div className="flex flex-wrap gap-2">
              {day.cells.map((cell) => {
                const disabled = cell.isPast || cell.isBooked;
                const windKn = windByHour?.get(windHourKey(cell.date));
                const wind = windKn !== undefined ? categorizeWind(windKn, windThresholds) : null;
                return (
                  <button
                    key={cell.iso}
                    onClick={() => openCell(cell)}
                    disabled={disabled}
                    className={
                      disabled
                        ? "rounded-lg bg-lf-border px-3 py-2 text-xs font-bold text-lf-muted"
                        : "rounded-lg border-2 border-emerald-400 bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-900 transition-colors hover:bg-emerald-200 active:bg-emerald-300 dark:border-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                    }
                  >
                    <span className="block">{pad(cell.hour)}:00</span>
                    {wind && (
                      <span
                        className={`mt-0.5 block text-[10px] font-semibold normal-case ${WIND_TONE_TEXT_CLASS[wind.tone]}`}
                      >
                        {Math.round(windKn as number)}kn · {wind.shortLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-[480px] rounded-t-3xl bg-lf-card p-6 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-lf-border" />
            {confirmed ? (
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-13 w-13 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600 dark:bg-emerald-950">
                  ✓
                </div>
                <p className="text-base font-extrabold text-foreground">Termin gebucht!</p>
                <p className="mt-1.5 text-sm text-lf-muted">
                  {formatDateTime(selected.iso)} · 1 Stunde von deinem Paket abgezogen
                </p>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="mt-5 w-full rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white"
                >
                  Fertig
                </button>
              </div>
            ) : (
              <>
                <p className="text-base font-extrabold text-foreground">Termin bestätigen</p>
                <p className="mt-1 text-sm text-lf-muted">{formatDateTime(selected.iso)}</p>
                <div className="mt-4 flex flex-col gap-2 rounded-xl bg-lf-ocean-light p-3.5">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-lf-muted">Angebot</span>
                    <span className="font-bold text-lf-ocean">{course.name}</span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-lf-muted">Kosten</span>
                    <span className="font-bold text-lf-ocean">
                      {pkg ? "1 Stunde vom Paket" : formatEuro(course.pricePerHourCents ?? course.priceCents)}
                    </span>
                  </div>
                </div>
                <WaiverConsent accepted={waiverAccepted} onChange={setWaiverAccepted} />
                <div className="mt-5 flex gap-2.5">
                  <button
                    onClick={() => setSelected(null)}
                    className="flex-1 rounded-xl border border-lf-border py-3.5 text-sm font-bold text-foreground"
                  >
                    Abbrechen
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={booking || !waiverAccepted}
                    className="flex-1 rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {booking ? "…" : "Bestätigen"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BookPageContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category") as CourseCategory | null;

  const [category, setCategory] = useState<CourseCategory>(categoryParam ?? "PRIVATE_HOURS");
  const [courses, setCourses] = useState<CourseOffering[]>([]);
  const [campRows, setCampRows] = useState<CampRow[]>([]);
  const [campBookingId, setCampBookingId] = useState<string | null>(null);
  const [campConfirmedId, setCampConfirmedId] = useState<string | null>(null);
  const [campConfirming, setCampConfirming] = useState<CampRow | null>(null);
  const [campWaiverAccepted, setCampWaiverAccepted] = useState(false);

  useEffect(() => {
    getRepository()
      .getCourses()
      .then(setCourses);
  }, []);

  async function loadCamps() {
    const repo = getRepository();
    const [allCourses, slots] = await Promise.all([repo.getCourses(), repo.getSlots()]);
    const courseById = new Map(allCourses.map((c) => [c.id, c]));
    const rows = slots
      .filter((s) => s.status === "OPEN" && s.bookedCount < s.capacity)
      .map((s) => ({ slot: s, course: courseById.get(s.courseOfferingId)!, freeSeats: s.capacity - s.bookedCount }))
      .filter((row) => row.course && row.course.category === "GROUP_CAMP")
      .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));
    setCampRows(rows);
  }

  useEffect(() => {
    if (category === "GROUP_CAMP") loadCamps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function handleBookCamp(slotId: string, waiverAccepted: boolean) {
    setCampBookingId(slotId);
    await getRepository().createBooking({ customerId: getCurrentCustomerId(), slotId, waiverAccepted });
    setCampConfirmedId(slotId);
    setCampBookingId(null);
    setCampConfirming(null);
    await loadCamps();
  }

  const privateHourCourse = courses.find((c) => c.category === "PRIVATE_HOURS");

  return (
    <main className="flex-1 px-5 py-6">
      <h1 className="text-3xl font-bold tracking-tight text-foreground">Termin buchen</h1>
      <p className="mt-2 text-lf-muted">Freie Zeitfenster sind grün markiert.</p>

      <div className="mt-5 flex gap-2">
        <button
          onClick={() => setCategory("PRIVATE_HOURS")}
          className={
            category === "PRIVATE_HOURS"
              ? "rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white"
              : "rounded-full bg-lf-ocean-light px-4 py-2 text-sm font-medium text-lf-ocean"
          }
        >
          Privatstunden
        </button>
        <button
          onClick={() => setCategory("GROUP_CAMP")}
          className={
            category === "GROUP_CAMP"
              ? "rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white"
              : "rounded-full bg-lf-ocean-light px-4 py-2 text-sm font-medium text-lf-ocean"
          }
        >
          Kitecamps
        </button>
      </div>

      {category === "PRIVATE_HOURS" && privateHourCourse && (
        <HourPicker courseOfferingId={privateHourCourse.id} course={privateHourCourse} />
      )}

      {category === "GROUP_CAMP" && (
        <div className="mt-6 flex flex-col gap-3">
          {campRows.length === 0 && <p className="text-sm text-lf-muted">Aktuell keine freien Kitecamps.</p>}
          {campRows.map(({ slot, course, freeSeats }) => (
            <div
              key={slot.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-lf-border bg-lf-card p-5"
            >
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-lf-ocean">
                  {categoryLabels[course.category]}
                </p>
                <p className="mt-1 font-semibold text-foreground">{course.name}</p>
                <p className="mt-1 text-sm text-lf-muted">
                  {formatDateTime(slot.startsAt)} · {freeSeats} von {slot.capacity} Plätzen frei
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {formatEuro(slot.priceCentsOverride ?? course.priceCents)}
                </p>
              </div>
              {campConfirmedId === slot.id ? (
                <span className="shrink-0 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                  Gebucht ✓
                </span>
              ) : (
                <button
                  onClick={() => {
                    setCampWaiverAccepted(false);
                    setCampConfirming({ slot, course, freeSeats });
                  }}
                  className="shrink-0 rounded-full bg-lf-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Buchen
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {campConfirming && (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center bg-black/40"
          onClick={() => setCampConfirming(null)}
        >
          <div
            className="w-full max-w-[480px] rounded-t-3xl bg-lf-card p-6 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-lf-border" />
            <p className="text-base font-extrabold text-foreground">Buchung bestätigen</p>
            <p className="mt-1 text-sm text-lf-muted">{formatDateTime(campConfirming.slot.startsAt)}</p>
            <div className="mt-4 flex flex-col gap-2 rounded-xl bg-lf-ocean-light p-3.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-lf-muted">Angebot</span>
                <span className="font-bold text-lf-ocean">{campConfirming.course.name}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-lf-muted">Kosten</span>
                <span className="font-bold text-lf-ocean">
                  {formatEuro(campConfirming.slot.priceCentsOverride ?? campConfirming.course.priceCents)}
                </span>
              </div>
            </div>
            <WaiverConsent accepted={campWaiverAccepted} onChange={setCampWaiverAccepted} />
            <div className="mt-5 flex gap-2.5">
              <button
                onClick={() => setCampConfirming(null)}
                className="flex-1 rounded-xl border border-lf-border py-3.5 text-sm font-bold text-foreground"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleBookCamp(campConfirming.slot.id, campWaiverAccepted)}
                disabled={campBookingId === campConfirming.slot.id || !campWaiverAccepted}
                className="flex-1 rounded-xl bg-lf-ocean py-3.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {campBookingId === campConfirming.slot.id ? "…" : "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BookPage() {
  return (
    <Suspense>
      <BookPageContent />
    </Suspense>
  );
}
