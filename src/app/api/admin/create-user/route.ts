import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/adminClient";

interface CreateUserBody {
  email?: string;
  password?: string;
  name?: string;
  role?: "CUSTOMER" | "INSTRUCTOR";
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 403 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      return NextResponse.json({ error: "Server-Konfiguration unvollständig." }, { status: 500 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const callerClient = createClient(url, anonKey);
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 403 });
    }

    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .maybeSingle();
    if (callerProfileError || callerProfile?.role !== "ADMIN") {
      return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
    }

    const body = (await request.json()) as CreateUserBody;
    const { email, password, name, role } = body;

    if (!email?.trim() || !password || !name?.trim() || (role !== "CUSTOMER" && role !== "INSTRUCTOR")) {
      return NextResponse.json({ error: "Alle Felder sind erforderlich." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben." }, { status: 400 });
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
    });
    if (createError || !created.user) {
      const message = createError?.message.includes("already been registered")
        ? "Diese E-Mail-Adresse ist bereits vergeben."
        : "Account konnte nicht angelegt werden.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { data: updatedProfiles, error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role, name: name.trim() })
      .eq("id", created.user.id)
      .select("id");
    if (updateError || !updatedProfiles || updatedProfiles.length === 0) {
      return NextResponse.json(
        { error: "Account angelegt, Rolle konnte aber nicht gesetzt werden." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Serverfehler.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
