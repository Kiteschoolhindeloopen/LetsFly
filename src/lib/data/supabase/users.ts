import { supabase } from "@/lib/supabase/client";
import type { User } from "../types";
import { mapProfile, type ProfileRow } from "./mappers";

export async function getCustomer(id: string): Promise<User | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data as ProfileRow) : null;
}

export async function getInstructors(): Promise<User[]> {
  const { data, error } = await supabase.from("profiles").select("*").eq("role", "INSTRUCTOR");
  if (error) throw error;
  return (data as ProfileRow[]).map(mapProfile);
}
