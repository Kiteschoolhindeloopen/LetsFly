import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { InstructorSlotRequest, RequestStatus } from "../types";
import type { CreateInstructorRequestInput } from "../repository";
import { mapInstructorRequest, type InstructorRequestRow } from "./mappers";

export async function createInstructorRequest(
  input: CreateInstructorRequestInput
): Promise<InstructorSlotRequest> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("instructor_slot_requests")
    .insert({
      id: newId("request"),
      instructor_id: input.instructorId,
      course_offering_id: input.courseOfferingId,
      requested_starts_at: input.requestedStartsAt,
      requested_ends_at: input.requestedEndsAt,
      status: "PENDING",
      created_at: nowIso,
      updated_at: nowIso,
    })
    .select()
    .single();
  if (error) throw error;
  return mapInstructorRequest(data as InstructorRequestRow);
}

export async function getMyRequests(instructorId: string): Promise<InstructorSlotRequest[]> {
  const { data, error } = await supabase
    .from("instructor_slot_requests")
    .select("*")
    .eq("instructor_id", instructorId);
  if (error) throw error;
  return (data as InstructorRequestRow[]).map(mapInstructorRequest);
}

export async function getAllRequests(status?: RequestStatus): Promise<InstructorSlotRequest[]> {
  let query = supabase.from("instructor_slot_requests").select("*");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as InstructorRequestRow[]).map(mapInstructorRequest);
}

export async function resolveRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  adminNote?: string
): Promise<InstructorSlotRequest> {
  const { data: requestData, error: fetchError } = await supabase
    .from("instructor_slot_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (fetchError) throw fetchError;
  const request = requestData as InstructorRequestRow;

  let resultingSlotId: string | undefined;
  if (decision === "APPROVED") {
    const { data: slotData, error: slotError } = await supabase
      .from("slots")
      .insert({
        id: newId("slot"),
        course_offering_id: request.course_offering_id,
        instructor_id: request.instructor_id,
        starts_at: request.requested_starts_at,
        ends_at: request.requested_ends_at,
        capacity: 1,
        booked_count: 0,
        status: "OPEN",
      })
      .select()
      .single();
    if (slotError) throw slotError;
    resultingSlotId = (slotData as { id: string }).id;
  }

  const { data, error } = await supabase
    .from("instructor_slot_requests")
    .update({
      status: decision,
      admin_note: adminNote ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      resulting_slot_id: resultingSlotId ?? null,
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return mapInstructorRequest(data as InstructorRequestRow);
}
