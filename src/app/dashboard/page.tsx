"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getRepository,
  type Booking,
  type CourseOffering,
  type GroupSession,
  type GroupSessionAssignment,
  type HourPackagePurchase,
  type Notification,
  type Slot,
  type User,
} from "@/lib/data/repository";
import { formatDateTime, formatEuro } from "@/lib/format";
import { useAuthUser } from "@/lib/auth/AuthContext";
import { useLiveRefresh } from "@/lib/useLiveRefresh";
import { fetchCurrentWind } from "@/lib/wind/openMeteo";
import { getWindThresholds, BEACH_FACING_DEG, GUST_FACTOR_THRESHOLD } from "@/lib/wind/config";
import {
  categorizeWind,
  categorizeWindDirection,
  isGusty,
  WIND_TONE_TEXT_CLASS,
  SHORE_DIRECTION_TEXT_CLASS,
} from "@/lib/wind/categorize";

interface BookingRow {
  booking: Booking;
  slot: Slot;
  course: CourseOffering;
  instructorName?: string;
}

const CANCELLATION_CUTOFF_MS = 3 * 24 * 60 * 60 * 1000;
const NOW_TICK_MS = 30 * 1000;

function isCancellable(row: BookingRow): boolean {
  if (row.course.category !== "PRIVATE_HOURS") return true;
  return new Date(row.slot.startsAt).getTime() - Date.now() >= CANCELLATION_CUTOFF_MS;
}

function isRunningNow(startsAt: string, endsAt: string, now: number): boolean {
  return new Date(startsAt).getTime() <= now && now <= new Date(endsAt).getTime();
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthUser();
  const [customer, setCustomer] = useState<User | null>(null);
  const [pkg, setPkg] = useState<HourPackagePurchase | null>(null);
  const [upcoming, setUpcoming] = useState<BookingRow[]>([]);
  const [myGroupSessions, setMyGroupSessions] = useState<{ assignment: GroupSessionAssignment; session: GroupSession }[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [windBannerDismissed, setWindBannerDismissed] = useState(false);
  const [windBannerActive, setWindBannerActive] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [currentWindKn, setCurrentWindKn] = useState<number | null>(null);
  const [currentWindDirectionDeg, setCurrentWindDirectionDeg] = useState<number | null>(null);
  const [currentGustKn, setCurrentGustKn] = useState<number | null>(null);
  const [windThresholds] = useState(() => getWindThresholds());
  const [now, setNow] = useState(() => Date.now());

  async function load() {
    const repo = getRepository();
    const [customerData, myPackages, myBookings, courses, slots, myNotifications, myAssignments, allGroupSessions] =
      await Promise.all([
        repo.getCustomer(user.id),
        repo.getMyPackages(user.id),
        repo.getMyBookings(user.id),
        repo.getCourses(),
        repo.getSlots(),
        repo.getNotifications(user.id),
        repo.getGroupSessionAssignments({ customerId: user.id }),
        repo.getGroupSessions(),
      ]);

    const courseById = new Map(courses.map((c) => [c.id, c]));
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const confirmed = myBookings.filter((b) => b.status === "CONFIRMED");
    const instructorIds = Array.from(
      new Set(confirmed.map((b) => slotById.get(b.slotId)?.instructorId).filter((id): id is string => !!id))
    );
    const instructors = await Promise.all(instructorIds.map((id) => repo.getCustomer(id)));
    const instructorNameById = new Map(instructors.filter((u): u is User => !!u).map((u) => [u.id, u.name]));

    const rows: BookingRow[] = confirmed
      .flatMap((booking) => {
        const slot = slotById.get(booking.slotId);
        const course = slot && courseById.get(slot.courseOfferingId);
        if (!slot || !course) return [];
        return [
          {
            booking,
            slot,
            course,
            instructorName: slot.instructorId ? instructorNameById.get(slot.instructorId) : undefined,
          },
        ];
      })
      .sort((a, b) => a.slot.startsAt.localeCompare(b.slot.startsAt));

    const WIND_WARNING_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
    const msUntilNext = rows[0] ? new Date(rows[0].slot.startsAt).getTime() - Date.now() : null;
    const withinWindWindow = msUntilNext !== null && msUntilNext >= 0 && msUntilNext <= WIND_WARNING_WINDOW_MS;

    const sessionById = new Map(allGroupSessions.map((s) => [s.id, s]));
    const myConfirmedGroupSessions = myAssignments
      .filter((a) => a.status === "CONFIRMED")
      .flatMap((assignment) => {
        const session = sessionById.get(assignment.groupSessionId);
        return session ? [{ assignment, session }] : [];
      })
      .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));

    setCustomer(customerData);
    setPkg(myPackages[0] ?? null);
    setUpcoming(rows);
    setNotifications(myNotifications);
    setWindBannerActive(withinWindWindow);
    setMyGroupSessions(myConfirmedGroupSessions);
  }

  useEffect(() => {
    load();
  }, []);

  useLiveRefresh(load);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchCurrentWind()
      .then((wind) => {
        setCurrentWindKn(wind.speedKn);
        setCurrentWindDirectionDeg(wind.directionDeg);
        setCurrentGustKn(wind.gustKn);
      })
      .catch(() => {
        setCurrentWindKn(null);
        setCurrentWindDirectionDeg(null);
        setCurrentGustKn(null);
      });
  }, []);

  async function handleCancel(row: BookingRow) {
    if (!isCancellable(row)) return;
    setCancellingId(row.booking.id);
    await getRepository().cancelBooking(row.booking.id);
    await load();
    setCancellingId(null);
  }

  async function handleMarkAllRead() {
    await getRepository().markAllNotificationsRead(user.id);
    await load();
  }

  async function handleMarkRead(notificationId: string) {
    await getRepository().markNotificationRead(notificationId);
    await load();
  }

  const next = upcoming[0];
  const hasUnread = notifications.some((n) => n.unread);
  const showWindBanner = !windBannerDismissed && windBannerActive;
  const currentWind = currentWindKn !== null ? categorizeWind(currentWindKn, windThresholds) : null;
  const currentWindDirection =
    currentWindDirectionDeg !== null ? categorizeWindDirection(currentWindDirectionDeg, BEACH_FACING_DEG) : null;
  const currentWindGusty =
    currentWindKn !== null && currentGustKn !== null
      ? isGusty(currentWindKn, currentGustKn, GUST_FACTOR_THRESHOLD)
      : false;

  return (
    <div className="lf-scroll flex flex-1 flex-col overflow-y-auto pb-6">
      <div className="relative overflow-hidden rounded-b-3xl bg-lf-navy px-5 pb-7 pt-6 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://kiteschoolhindeloopen.com/images/kitesurf-bg.webp"
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-lf-ocean-dark/90 via-lf-ocean/75 to-lf-ocean/55" />
        <div className="relative">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs opacity-85">Willkommen zurück</p>
              <p className="text-xl font-extrabold">{customer?.name ?? "…"}</p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setNotifPanelOpen(true)}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-base"
              >
                <svg
                  className="h-[18px] w-[18px]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 8a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6.5H4c.5-1 2-2.5 2-6.5Z" />
                  <path d="M10 18a2 2 0 0 0 4 0" />
                </svg>
                {hasUnread && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-lf-ocean-dark bg-lf-sand-dark" />
                )}
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lf-sand text-sm font-extrabold text-amber-950 shadow">
                LM
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/15 p-4 shadow-lg backdrop-blur">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide opacity-85">Nächster Termin</p>
            {next ? (
              <>
                <p className="text-[17px] font-extrabold">{formatDateTime(next.slot.startsAt)}</p>
                <p className="mt-0.5 text-sm opacity-90">
                  {next.course.name}
                  {next.instructorName ? ` · ${next.instructorName}` : ""}
                </p>
              </>
            ) : (
              <p className="text-sm opacity-90">Noch kein Termin gebucht</p>
            )}
          </div>
        </div>
      </div>

      {currentWind && currentWindKn !== null && (
        <div className="mx-5 mt-4 rounded-2xl border border-lf-border bg-lf-card p-4.5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-lf-muted">Aktuelle Windbedingungen</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-foreground">{Math.round(currentWindKn)}kn</span>
            <span className={`text-sm font-bold ${WIND_TONE_TEXT_CLASS[currentWind.tone]}`}>
              {currentWind.label}
            </span>
            {currentWindDirection && (
              <span className={`text-sm font-bold ${SHORE_DIRECTION_TEXT_CLASS[currentWindDirection.direction]}`}>
                · {currentWindDirection.label}
              </span>
            )}
            {currentWindGusty && (
              <span className="text-sm font-bold text-amber-700 dark:text-amber-300">· Böig</span>
            )}
          </div>
          {currentGustKn !== null && (
            <p className="mt-0.5 text-xs text-lf-muted">Böen bis {Math.round(currentGustKn)}kn</p>
          )}
          <p className="mt-1 text-xs text-lf-muted">Workum, IJsselmeer</p>
        </div>
      )}

      {showWindBanner && next && (
        <div className="mx-5 mt-4 flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-900 dark:bg-amber-950">
          <span className="text-lg leading-none">💨</span>
          <div className="flex-1">
            <p className="text-[13.5px] leading-relaxed text-amber-900 dark:text-amber-200">
              Dein Termin am {formatDateTime(next.slot.startsAt)} ({next.course.name}) könnte wegen Windvorhersage
              abgesagt werden — wir informieren dich rechtzeitig.
            </p>
            <div className="mt-2.5 flex gap-2.5">
              <button
                onClick={() => router.push("/book")}
                className="rounded-lg bg-lf-sand-dark px-3.5 py-2 text-xs font-bold text-white"
              >
                Termine ansehen
              </button>
              <button
                onClick={() => setWindBannerDismissed(true)}
                className="rounded-lg border border-amber-300 px-3.5 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:text-amber-200"
              >
                Ausblenden
              </button>
            </div>
          </div>
        </div>
      )}

      {pkg && (
        <div className="mx-5 mt-4 rounded-2xl border border-lf-border bg-lf-card p-4.5 shadow-sm">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-sm font-bold text-foreground">{pkg.totalHours}h Stundenpaket</p>
            {pkg.expiresAt && (
              <p className="text-xs text-lf-muted">läuft ab {new Date(pkg.expiresAt).toLocaleDateString("de-DE")}</p>
            )}
          </div>
          <p className="mb-3 text-xs text-lf-muted">
            {pkg.totalHours - pkg.hoursScheduled - pkg.hoursCompleted} von {pkg.totalHours} Stunden übrig
          </p>
          <div className="h-2.5 overflow-hidden rounded-full bg-lf-border">
            <div
              className="h-full rounded-full bg-gradient-to-r from-lf-ocean to-lf-sand"
              style={{
                width: `${((pkg.totalHours - pkg.hoursScheduled - pkg.hoursCompleted) / pkg.totalHours) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mx-5 mt-4.5 flex gap-3">
        <button
          onClick={() => router.push("/book")}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-lf-ocean py-4 text-[13.5px] font-bold text-white"
        >
          <svg
            className="h-[18px] w-[18px]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
          Termin buchen
        </button>
        <button
          onClick={() => router.push("/videos")}
          className="flex flex-1 flex-col items-center gap-1.5 rounded-2xl border border-lf-border py-4 text-[13.5px] font-bold text-foreground"
        >
          <span className="text-lg">▶</span>Videos ansehen
        </button>
      </div>

      <div className="mx-5 mt-6">
        <p className="mb-2.5 text-[13px] font-bold text-foreground">Meine Buchungen</p>
        <div className="flex flex-col gap-2.5">
          {upcoming.length === 0 && <p className="text-sm text-lf-muted">Keine bevorstehenden Termine.</p>}
          {upcoming.map((row) => {
            const { booking, slot, course, instructorName } = row;
            const cancellable = isCancellable(row);
            const runningNow = isRunningNow(slot.startsAt, slot.endsAt, now);
            return (
              <div
                key={booking.id}
                className={
                  runningNow
                    ? "flex items-center justify-between gap-3 rounded-2xl border-2 border-lf-ocean bg-lf-ocean-light p-3.5"
                    : "flex items-center justify-between gap-3 rounded-2xl border border-lf-border p-3.5"
                }
              >
                <div>
                  {runningNow && (
                    <span className="mb-1 inline-block rounded-full bg-lf-ocean px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Läuft jetzt
                    </span>
                  )}
                  <p className="text-[13.5px] font-bold text-foreground">{course.name}</p>
                  <p className="mt-0.5 text-xs text-lf-muted">
                    {formatDateTime(slot.startsAt)}
                    {instructorName ? ` · mit ${instructorName}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-lf-muted">
                    {formatEuro(slot.priceCentsOverride ?? course.priceCents)}
                  </p>
                </div>
                {cancellable ? (
                  <button
                    onClick={() => handleCancel(row)}
                    disabled={cancellingId === booking.id}
                    className="shrink-0 rounded-full border border-red-200 px-3.5 py-1.5 text-xs font-bold text-red-600 disabled:opacity-50 dark:border-red-900 dark:text-red-400"
                  >
                    {cancellingId === booking.id ? "…" : "Stornieren"}
                  </button>
                ) : (
                  <span className="shrink-0 text-right text-[11px] font-semibold text-lf-muted">
                    Stornieren nicht mehr möglich
                    <br />
                    (weniger als 3 Tage vorher)
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {myGroupSessions.length > 0 && (
        <div className="mx-5 mt-6">
          <p className="mb-2.5 text-[13px] font-bold text-foreground">Meine Gruppentermine</p>
          <p className="mb-2.5 text-xs text-lf-muted">
            Diese Termine wurden dir von der Kiteschule zugewiesen — der Termin lässt sich hier nicht selbst ändern.
          </p>
          <div className="flex flex-col gap-2.5">
            {myGroupSessions.map(({ assignment, session }) => {
              const runningNow = isRunningNow(session.startsAt, session.endsAt, now);
              return (
                <div
                  key={assignment.id}
                  className={
                    runningNow
                      ? "rounded-2xl border-2 border-lf-ocean bg-lf-ocean-light p-3.5"
                      : "rounded-2xl border border-lf-border p-3.5"
                  }
                >
                  {runningNow && (
                    <span className="mb-1 inline-block rounded-full bg-lf-ocean px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Läuft jetzt
                    </span>
                  )}
                  <p className="text-[13.5px] font-bold text-foreground">
                    {formatDateTime(session.startsAt)} – {formatDateTime(session.endsAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-lf-muted">
                    Level: {assignment.level === "BEGINNER" ? "Anfänger" : "Fortgeschritten"}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {notifPanelOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 p-4 pt-24"
          onClick={() => setNotifPanelOpen(false)}
        >
          <div className="w-full max-w-md rounded-2xl bg-lf-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-foreground">Benachrichtigungen</h3>
              <button onClick={handleMarkAllRead} className="text-sm font-semibold text-lf-ocean">
                Alle gelesen
              </button>
            </div>
            <div className="mt-3 flex max-h-96 flex-col gap-1 overflow-y-auto">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => n.unread && handleMarkRead(n.id)}
                  className={
                    n.unread
                      ? "flex gap-3 rounded-xl bg-lf-ocean-light p-3 text-left"
                      : "flex gap-3 rounded-xl p-3 text-left"
                  }
                >
                  <span className="text-lg">{n.icon}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${n.unread ? "text-lf-ocean" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-sm text-lf-muted">{n.message}</p>
                    <p className="mt-1 text-xs text-lf-muted">{n.time}</p>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setNotifPanelOpen(false)}
              className="mt-4 w-full rounded-full border border-lf-border py-2 text-sm font-semibold text-foreground"
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
