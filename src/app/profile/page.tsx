"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getRepository,
  type Booking,
  type CourseOffering,
  type HourPackagePurchase,
  type Slot,
  type User,
} from "@/lib/data/repository";
import { formatDateTime, formatEuro } from "@/lib/format";
import { getCurrentCustomerId } from "@/lib/demoSession";

interface HistoryRow {
  booking: Booking;
  slot: Slot;
  course: CourseOffering;
}

function StarRow({ rating, onRate }: { rating: number; onRate: (stars: number) => void }) {
  return (
    <div className="mt-2 flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onRate(n)} className="text-lg leading-none text-lf-sand">
          {n <= rating ? "★" : "☆"}
        </button>
      ))}
    </div>
  );
}

const UPSELL_PACKAGES = [
  { name: "Kitecamp Holland (2 Tage)", desc: "IJsselmeer, 2-4 Schüler pro Lehrer", price: "ab 220€" },
  { name: "Kitecamp Holland (4-6 Tage)", desc: "Für alle, die es ernst meinen", price: "ab 440€" },
  { name: "Privatstunden-Paket (5 Std.)", desc: "1:1 Unterricht, freie Terminwahl", price: "325€" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [customer, setCustomer] = useState<User | null>(null);
  const [pkg, setPkg] = useState<HourPackagePurchase | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  async function load() {
    const repo = getRepository();
    const [customerData, packages, bookings, courses, slots] = await Promise.all([
      repo.getCustomer(getCurrentCustomerId()),
      repo.getMyPackages(getCurrentCustomerId()),
      repo.getMyBookings(getCurrentCustomerId()),
      repo.getCourses(),
      repo.getSlots(),
    ]);
    const courseById = new Map(courses.map((c) => [c.id, c]));
    const slotById = new Map(slots.map((s) => [s.id, s]));

    setCustomer(customerData);
    setPkg(packages[0] ?? null);
    setHistory(
      bookings
        .flatMap((booking) => {
          const slot = slotById.get(booking.slotId);
          const course = slot && courseById.get(slot.courseOfferingId);
          if (!slot || !course) return [];
          return [{ booking, slot, course }];
        })
        .sort((a, b) => b.slot.startsAt.localeCompare(a.slot.startsAt))
    );
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRate(bookingId: string, stars: number) {
    await getRepository().rateBooking(bookingId, stars);
    await load();
  }

  return (
    <div className="lf-scroll flex flex-1 flex-col overflow-y-auto pb-6">
      <div className="flex items-center gap-3.5 px-5 pb-4 pt-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-lf-ocean-light text-lg font-extrabold text-lf-ocean">
          LM
        </div>
        <div>
          <p className="text-[17px] font-extrabold text-foreground">{customer?.name}</p>
          <p className="text-xs text-lf-muted">{customer?.email}</p>
        </div>
      </div>

      {pkg && (
        <div className="mx-5 my-2 rounded-2xl bg-lf-ocean-light p-4">
          <p className="text-sm font-bold text-lf-ocean">{pkg.totalHours}h Stundenpaket</p>
          <p className="mt-1 text-xs text-lf-muted">
            {pkg.totalHours - pkg.hoursScheduled - pkg.hoursCompleted} von {pkg.totalHours} Stunden übrig
            {pkg.expiresAt ? ` · läuft ab ${new Date(pkg.expiresAt).toLocaleDateString("de-DE")}` : ""}
          </p>
        </div>
      )}

      <p className="mb-2.5 mt-5 px-5 text-[13px] font-bold text-foreground">Weitere Kurse &amp; Camps</p>
      <div className="mx-5 flex flex-col gap-2.5">
        {UPSELL_PACKAGES.map((p) => (
          <div
            key={p.name}
            className="flex items-center justify-between rounded-2xl border border-lf-border p-3.5"
          >
            <div>
              <p className="text-[13.5px] font-bold text-foreground">{p.name}</p>
              <p className="mt-0.5 text-xs text-lf-muted">{p.desc}</p>
            </div>
            <p className="ml-3 whitespace-nowrap text-sm font-extrabold text-lf-ocean">{p.price}</p>
          </div>
        ))}
      </div>

      <p className="mb-2.5 mt-6 px-5 text-[13px] font-bold text-foreground">Meine Buchungshistorie</p>
      <div className="mx-5 flex flex-col gap-2.5">
        {history.map(({ booking, slot, course }) => (
          <div key={booking.id} className="rounded-2xl border border-lf-border p-3.5">
            <div className="flex items-baseline justify-between">
              <p className="text-[13.5px] font-bold text-foreground">{course.name}</p>
              <span
                className={
                  booking.status === "CANCELLED"
                    ? "rounded-lg bg-red-50 px-2 py-0.5 text-[10.5px] font-bold text-red-600 dark:bg-red-950 dark:text-red-300"
                    : booking.status === "COMPLETED"
                      ? "rounded-lg bg-lf-ocean-light px-2 py-0.5 text-[10.5px] font-bold text-lf-ocean"
                      : "rounded-lg bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }
              >
                {booking.status === "CANCELLED"
                  ? "Abgesagt"
                  : booking.status === "COMPLETED"
                    ? "Abgeschlossen"
                    : "Bevorstehend"}
              </span>
            </div>
            <p className="mt-1 text-xs text-lf-muted">
              {formatDateTime(slot.startsAt)} · {formatEuro(slot.priceCentsOverride ?? course.priceCents)}
            </p>
            {booking.status === "COMPLETED" && (
              <StarRow rating={booking.rating ?? 0} onRate={(stars) => handleRate(booking.id, stars)} />
            )}
          </div>
        ))}
      </div>

      <div className="mx-5 mt-6 border-t border-lf-border pt-2.5">
        <p className="px-1 py-3.5 text-[13.5px] font-semibold text-foreground">Zahlungsmethoden</p>
        <button
          onClick={() => router.push("/")}
          className="w-full px-1 py-3.5 text-left text-[13.5px] font-semibold text-red-600 dark:text-red-400"
        >
          Abmelden
        </button>
      </div>
    </div>
  );
}
