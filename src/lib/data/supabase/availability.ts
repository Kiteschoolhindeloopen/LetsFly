import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { AvailabilityWindow, Slot } from "../types";
import type { CreateWindowInput, SlotFilter } from "../repository";
import { mapSlot, mapWindow, type SlotRow, type WindowRow } from "./mappers";
import { getAllCourses } from "./courses";

export async function getSlots(filter?: SlotFilter): Promise<Slot[]> {
  let query = supabase.from("slots").select("*");
  if (filter?.from) query = query.gte("starts_at", filter.from);
  if (filter?.to) query = query.lte("starts_at", filter.to);
  const { data, error } = await query;
  if (error) throw error;
  let slots = (data as SlotRow[]).map(mapSlot);

  if (filter?.category) {
    const courses = await getAllCourses();
    const courseIds = new Set(
      courses.filter((c) => c.category === filter.category).map((c) => c.id)
    );
    slots = slots.filter((s) => courseIds.has(s.courseOfferingId));
  }
  return slots;
}

export async function getAvailabilityWindows(): Promise<AvailabilityWindow[]> {
  const { data, error } = await supabase.from("availability_windows").select("*");
  if (error) throw error;
  return (data as WindowRow[]).map(mapWindow);
}

export async function getMySlots(instructorId: string): Promise<Slot[]> {
  const { data, error } = await supabase
    .from("slots")
    .select("*")
    .eq("instructor_id", instructorId);
  if (error) throw error;
  return (data as SlotRow[]).map(mapSlot);
}

export async function claimSlot(slotId: string, instructorId: string): Promise<Slot> {
  const { data: existing, error: fetchError } = await supabase
    .from("slots")
    .select("*")
    .eq("id", slotId)
    .single();
  if (fetchError) throw fetchError;
  const slot = existing as SlotRow;
  if (slot.instructor_id) throw new Error("Slot ist bereits einem Lehrer zugeteilt");
  if (slot.status !== "OPEN") throw new Error("Slot ist nicht mehr offen");

  const { data, error } = await supabase
    .from("slots")
    .update({ instructor_id: instructorId })
    .eq("id", slotId)
    .select()
    .single();
  if (error) throw error;
  return mapSlot(data as SlotRow);
}

export async function createWindow(input: CreateWindowInput): Promise<AvailabilityWindow> {
  const windowId = newId("window");
  const { data: windowData, error: windowError } = await supabase
    .from("availability_windows")
    .insert({
      id: windowId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      course_category: input.courseCategory ?? null,
      status: "OPEN",
      created_by_admin_id: input.createdByAdminId,
    })
    .select()
    .single();
  if (windowError) throw windowError;
  const window = mapWindow(windowData as WindowRow);

  const allCourses = await getAllCourses();
  const coursesForWindow = allCourses.filter(
    (c) => c.active && (!input.courseCategory || c.category === input.courseCategory)
  );
  const newSlots = coursesForWindow.map((course) => {
    if (course.category === "GROUP_CAMP") {
      return {
        id: newId("slot"),
        course_offering_id: course.id,
        availability_window_id: window.id,
        starts_at: window.startsAt,
        ends_at: window.endsAt,
        capacity: course.maxGroupSize ?? 4,
        booked_count: 0,
        status: "OPEN" as const,
      };
    }
    const slotEnd = new Date(window.startsAt);
    slotEnd.setHours(slotEnd.getHours() + 2);
    return {
      id: newId("slot"),
      course_offering_id: course.id,
      availability_window_id: window.id,
      starts_at: window.startsAt,
      ends_at: slotEnd.toISOString(),
      capacity: 1,
      booked_count: 0,
      status: "OPEN" as const,
    };
  });

  if (newSlots.length > 0) {
    const { error: slotsError } = await supabase.from("slots").insert(newSlots);
    if (slotsError) throw slotsError;
  }

  return window;
}
