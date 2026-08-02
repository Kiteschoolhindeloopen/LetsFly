import { supabase } from "@/lib/supabase/client";
import type { User } from "@/lib/data/repository";

export async function getCurrentProfile(): Promise<User | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    name: data.name,
    phone: data.phone ?? undefined,
    isIkoInstructor: data.is_iko_instructor ?? undefined,
  };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
