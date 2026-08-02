import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { Booking, HourPackagePurchase } from "../types";
import type { BookHourSlotInput, CreateBookingInput } from "../repository";
import { mapBooking, mapPackage, type BookingRow, type PackageRow, type SlotRow } from "./mappers";

export async function getMyBookings(customerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as BookingRow[]).map(mapBooking);
}

export async function getMyPackages(customerId: string): Promise<HourPackagePurchase[]> {
  const { data, error } = await supabase
    .from("hour_package_purchases")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as PackageRow[]).map(mapPackage);
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  if (!input.waiverAccepted) {
    throw new Error("Haftungsausschluss muss akzeptiert werden, bevor gebucht werden kann.");
  }
  const { data: slotData, error: slotError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", input.slotId)
    .single();
  if (slotError) throw slotError;
  const slot = slotData as SlotRow;
  const seats = input.seats ?? 1;
  if (slot.booked_count + seats > slot.capacity) {
    throw new Error("Slot ist bereits ausgebucht");
  }

  const newBookedCount = slot.booked_count + seats;
  const { error: updateSlotError } = await supabase
    .from("slots")
    .update({
      booked_count: newBookedCount,
      status: newBookedCount >= slot.capacity ? "BOOKED" : "OPEN",
    })
    .eq("id", slot.id);
  if (updateSlotError) throw updateSlotError;

  const bookingId = newId("booking");
  const nowIso = new Date().toISOString();
  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .insert({
      id: bookingId,
      customer_id: input.customerId,
      slot_id: input.slotId,
      hour_package_purchase_id: input.hourPackagePurchaseId ?? null,
      seats,
      status: "CONFIRMED",
      payment_status: "UNPAID",
      notes: input.notes ?? null,
      created_at: nowIso,
      waiver_accepted_at: nowIso,
    })
    .select()
    .single();
  if (bookingError) throw bookingError;

  if (input.hourPackagePurchaseId) {
    const { data: pkgData, error: pkgFetchError } = await supabase
      .from("hour_package_purchases")
      .select("hours_scheduled")
      .eq("id", input.hourPackagePurchaseId)
      .single();
    if (pkgFetchError) throw pkgFetchError;
    const currentScheduled = (pkgData as { hours_scheduled: number }).hours_scheduled;
    const { error: pkgUpdateError } = await supabase
      .from("hour_package_purchases")
      .update({ hours_scheduled: currentScheduled + seats })
      .eq("id", input.hourPackagePurchaseId);
    if (pkgUpdateError) throw pkgUpdateError;
  }

  return mapBooking(bookingData as BookingRow);
}

export async function bookHourSlot(input: BookHourSlotInput): Promise<Booking> {
  if (!input.waiverAccepted) {
    throw new Error("Haftungsausschluss muss akzeptiert werden, bevor gebucht werden kann.");
  }
  const { data: existingSlots, error: findError } = await supabase
    .from("slots")
    .select("*")
    .eq("course_offering_id", input.courseOfferingId)
    .eq("starts_at", input.startsAt);
  if (findError) throw findError;
  let slot = (existingSlots as SlotRow[])[0];

  if (!slot) {
    const { data: created, error: createError } = await supabase
      .from("slots")
      .insert({
        id: newId("slot"),
        course_offering_id: input.courseOfferingId,
        starts_at: input.startsAt,
        ends_at: input.endsAt,
        capacity: 1,
        booked_count: 0,
        status: "OPEN",
      })
      .select()
      .single();
    if (createError) throw createError;
    slot = created as SlotRow;
  } else if (slot.booked_count >= slot.capacity) {
    throw new Error("Dieser Termin ist bereits vergeben");
  }

  return createBooking({
    customerId: input.customerId,
    slotId: slot.id,
    hourPackagePurchaseId: input.hourPackagePurchaseId,
    waiverAccepted: input.waiverAccepted,
  });
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const { data: bookingData, error: fetchError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .single();
  if (fetchError) throw fetchError;
  const booking = bookingData as BookingRow;

  const { error: cancelError } = await supabase
    .from("bookings")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("id", bookingId);
  if (cancelError) throw cancelError;

  const { data: slotData, error: slotError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", booking.slot_id)
    .single();
  if (!slotError && slotData) {
    const slot = slotData as SlotRow;
    const bookedCount = Math.max(0, slot.booked_count - booking.seats);
    await supabase.from("slots").update({ booked_count: bookedCount, status: "OPEN" }).eq("id", slot.id);
  }

  if (booking.hour_package_purchase_id) {
    const { data: pkgData } = await supabase
      .from("hour_package_purchases")
      .select("hours_scheduled")
      .eq("id", booking.hour_package_purchase_id)
      .single();
    if (pkgData) {
      const hoursScheduled = Math.max(0, (pkgData as { hours_scheduled: number }).hours_scheduled - booking.seats);
      await supabase
        .from("hour_package_purchases")
        .update({ hours_scheduled: hoursScheduled })
        .eq("id", booking.hour_package_purchase_id);
    }
  }
}

export async function getAllBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from("bookings").select("*");
  if (error) throw error;
  return (data as BookingRow[]).map(mapBooking);
}

export async function rateBooking(bookingId: string, rating: number): Promise<Booking> {
  const { data, error } = await supabase
    .from("bookings")
    .update({ rating })
    .eq("id", bookingId)
    .select()
    .single();
  if (error) throw error;
  return mapBooking(data as BookingRow);
}
