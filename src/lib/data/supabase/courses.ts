import { supabase } from "@/lib/supabase/client";
import type { CourseOffering } from "../types";
import { mapCourse, type CourseRow } from "./mappers";

export async function getCourses(): Promise<CourseOffering[]> {
  const { data, error } = await supabase
    .from("course_offerings")
    .select("*")
    .eq("active", true);
  if (error) throw error;
  return (data as CourseRow[]).map(mapCourse);
}

export async function getAllCourses(): Promise<CourseOffering[]> {
  const { data, error } = await supabase.from("course_offerings").select("*");
  if (error) throw error;
  return (data as CourseRow[]).map(mapCourse);
}

export async function updateCourse(
  courseId: string,
  updates: Partial<Pick<CourseOffering, "name" | "priceCents" | "active">>
): Promise<CourseOffering> {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.priceCents !== undefined) payload.price_cents = updates.priceCents;
  if (updates.active !== undefined) payload.active = updates.active;

  const { data, error } = await supabase
    .from("course_offerings")
    .update(payload)
    .eq("id", courseId)
    .select()
    .single();
  if (error) throw error;
  return mapCourse(data as CourseRow);
}
