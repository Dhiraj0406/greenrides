import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";

function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  // Supabase stores as "919668021577" (without +), strip country code
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) return digits.slice(2);
  return digits;
}

// GET — returns profile and upserts User record on first login
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const phone = normalisePhone(user.phone);

  // Upsert — creates on first login, no-ops on subsequent calls
  await db.from("User").upsert(
    { id: user.id, phone: phone || user.id.slice(0, 10), role: "RIDER" },
    { onConflict: "id", ignoreDuplicates: true }
  );

  const { data: profile } = await db.from("User").select("*").eq("id", user.id).maybeSingle();
  return Response.json({ data: profile, error: null });
}

const patchSchema = z.object({
  whatsapp_consent: z.boolean().optional(),
  name:             z.string().min(1).max(100).optional(),
});

export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getAdminClient();
  const { data: { user }, error: authErr } = await db.auth.getUser(token);
  if (authErr || !user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { error } = await db
    .from("User")
    .update({ ...parsed.data })
    .eq("id", user.id);

  if (error) {
    console.error("[users/me PATCH]", error);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json({ data: { ok: true }, error: null });
}
