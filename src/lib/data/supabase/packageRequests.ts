import { supabase } from "@/lib/supabase/client";
import { newId } from "../mock/storage";
import type { PackageRequest, PackageRequestStatus } from "../types";
import type { CreatePackageRequestInput } from "../repository";
import { mapPackageRequest, mapProfile, type PackageRequestRow, type ProfileRow } from "./mappers";
import { createNotification } from "./notifications";

export async function createPackageRequest(input: CreatePackageRequestInput): Promise<PackageRequest> {
  const { data: profileData } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", input.customerId)
    .maybeSingle();
  const customerEmail = profileData ? mapProfile(profileData as ProfileRow).email : "";

  const { data, error } = await supabase
    .from("package_requests")
    .insert({
      id: newId("pkgreq"),
      customer_id: input.customerId,
      customer_email: customerEmail,
      course_offering_id: input.courseOfferingId,
      requested_date: input.requestedDate,
      note: input.note ?? null,
      status: "PENDING",
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapPackageRequest(data as PackageRequestRow);
}

export async function getMyPackageRequests(customerId: string): Promise<PackageRequest[]> {
  const { data, error } = await supabase
    .from("package_requests")
    .select("*")
    .eq("customer_id", customerId);
  if (error) throw error;
  return (data as PackageRequestRow[]).map(mapPackageRequest);
}

export async function getAllPackageRequests(status?: PackageRequestStatus): Promise<PackageRequest[]> {
  let query = supabase.from("package_requests").select("*");
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return (data as PackageRequestRow[]).map(mapPackageRequest);
}

export async function resolvePackageRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  adminNote?: string
): Promise<PackageRequest> {
  const { data, error } = await supabase
    .from("package_requests")
    .update({
      status: decision,
      admin_note: adminNote ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  const updated = mapPackageRequest(data as PackageRequestRow);

  await createNotification({
    customerId: updated.customerId,
    icon: decision === "APPROVED" ? "✅" : "❌",
    title: decision === "APPROVED" ? "Anfrage bestätigt" : "Anfrage abgelehnt",
    message:
      decision === "APPROVED"
        ? `Deine Anfrage für ${new Date(updated.requestedDate).toLocaleDateString("de-DE")} wurde bestätigt.`
        : `Deine Anfrage für ${new Date(updated.requestedDate).toLocaleDateString("de-DE")} wurde leider abgelehnt.`,
  });
  return updated;
}

export async function proposeAlternativeDate(
  requestId: string,
  proposedDate: string,
  adminNote?: string
): Promise<PackageRequest> {
  const { data, error } = await supabase
    .from("package_requests")
    .update({ status: "DATE_PROPOSED", proposed_date: proposedDate, admin_note: adminNote ?? null })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  const updated = mapPackageRequest(data as PackageRequestRow);

  await createNotification({
    customerId: updated.customerId,
    icon: "🗓️",
    title: "Neuer Terminvorschlag",
    message: `Die Schule schlägt für deine Anfrage den ${new Date(proposedDate).toLocaleDateString("de-DE")} vor.`,
  });
  return updated;
}

export async function respondToProposedDate(requestId: string, accept: boolean): Promise<PackageRequest> {
  const { data: requestData, error: fetchError } = await supabase
    .from("package_requests")
    .select("*")
    .eq("id", requestId)
    .single();
  if (fetchError) throw fetchError;
  const request = requestData as PackageRequestRow;

  const { data, error } = await supabase
    .from("package_requests")
    .update({
      status: accept ? "APPROVED" : "REJECTED",
      requested_date: accept && request.proposed_date ? request.proposed_date : request.requested_date,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select()
    .single();
  if (error) throw error;
  return mapPackageRequest(data as PackageRequestRow);
}
