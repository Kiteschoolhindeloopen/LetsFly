import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { GroupSession, GroupSessionAssignment } from "../types";
import type {
  AssignCustomerToGroupSessionInput,
  CreateGroupSessionInput,
  GroupSessionAssignmentFilter,
  GroupSessionFilter,
} from "../repository";
import {
  mapGroupSession,
  mapGroupSessionAssignment,
  type GroupSessionAssignmentRow,
  type GroupSessionRow,
} from "./mappers";
import { createNotification } from "./notifications";

export async function getGroupSessions(filter?: GroupSessionFilter): Promise<GroupSession[]> {
  let query = supabase.from("group_sessions").select("*");
  if (filter?.from) query = query.gte("starts_at", filter.from);
  if (filter?.to) query = query.lte("starts_at", filter.to);
  const { data, error } = await query;
  if (error) throw error;
  return (data as GroupSessionRow[]).map(mapGroupSession);
}

export async function createGroupSession(input: CreateGroupSessionInput): Promise<GroupSession> {
  const { data, error } = await supabase
    .from("group_sessions")
    .insert({
      id: newId("groupsession"),
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      beginner_capacity: input.beginnerCapacity,
      advanced_capacity: input.advancedCapacity,
      status: "OPEN",
      created_by_admin_id: input.createdByAdminId,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapGroupSession(data as GroupSessionRow);
}

export async function getGroupSessionAssignments(
  filter?: GroupSessionAssignmentFilter
): Promise<GroupSessionAssignment[]> {
  let query = supabase.from("group_session_assignments").select("*");
  if (filter?.groupSessionId) query = query.eq("group_session_id", filter.groupSessionId);
  if (filter?.customerId) query = query.eq("customer_id", filter.customerId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as GroupSessionAssignmentRow[]).map(mapGroupSessionAssignment);
}

export async function assignCustomerToGroupSession(
  input: AssignCustomerToGroupSessionInput
): Promise<GroupSessionAssignment> {
  const seats = input.seats ?? 1;

  const { data: sessionData, error: sessionError } = await supabase
    .from("group_sessions")
    .select("*")
    .eq("id", input.groupSessionId)
    .single();
  if (sessionError) throw sessionError;
  const session = sessionData as GroupSessionRow;

  const { data: existingAssignments, error: assignmentsError } = await supabase
    .from("group_session_assignments")
    .select("*")
    .eq("group_session_id", input.groupSessionId)
    .eq("level", input.level)
    .eq("status", "CONFIRMED");
  if (assignmentsError) throw assignmentsError;
  const bookedSeats = (existingAssignments as GroupSessionAssignmentRow[]).reduce((sum, a) => sum + a.seats, 0);
  const capacity = input.level === "BEGINNER" ? session.beginner_capacity : session.advanced_capacity;
  if (bookedSeats + seats > capacity) {
    throw new Error("Für dieses Level sind in dieser Session nicht genug freie Plätze.");
  }

  const { data, error } = await supabase
    .from("group_session_assignments")
    .insert({
      id: newId("groupassign"),
      group_session_id: input.groupSessionId,
      customer_id: input.customerId,
      level: input.level,
      seats,
      hour_package_purchase_id: input.hourPackagePurchaseId ?? null,
      status: "CONFIRMED",
      assigned_by_admin_id: input.assignedByAdminId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

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

  await createNotification({
    customerId: input.customerId,
    icon: "🏄",
    title: "Gruppensession zugewiesen",
    message: `Dir wurde eine Gruppensession am ${new Date(session.starts_at).toLocaleString("de-DE")} zugewiesen.`,
  });

  return mapGroupSessionAssignment(data as GroupSessionAssignmentRow);
}

export async function cancelGroupSessionAssignment(assignmentId: string): Promise<void> {
  const { data: assignmentData, error: fetchError } = await supabase
    .from("group_session_assignments")
    .select("*")
    .eq("id", assignmentId)
    .single();
  if (fetchError) throw fetchError;
  const assignment = assignmentData as GroupSessionAssignmentRow;

  const { error: cancelError } = await supabase
    .from("group_session_assignments")
    .update({ status: "CANCELLED", cancelled_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (cancelError) throw cancelError;

  if (assignment.hour_package_purchase_id) {
    const { data: pkgData } = await supabase
      .from("hour_package_purchases")
      .select("hours_scheduled")
      .eq("id", assignment.hour_package_purchase_id)
      .single();
    if (pkgData) {
      const hoursScheduled = Math.max(
        0,
        (pkgData as { hours_scheduled: number }).hours_scheduled - assignment.seats
      );
      await supabase
        .from("hour_package_purchases")
        .update({ hours_scheduled: hoursScheduled })
        .eq("id", assignment.hour_package_purchase_id);
    }
  }
}
