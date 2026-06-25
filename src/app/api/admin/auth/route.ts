import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL        = "admin@green-rides.app";
const ADMIN_SUPABASE_PHONE = "+919668021577";

const body = z.object({
  pin:   z.string().optional(),
  phone: z.string().optional(),
  otp:   z.string().optional(),
});

export async function POST(req: NextRequest) {
  // Read credentials inside the handler so they're never baked in at build time.
  // .trim() guards against \r\n artifacts from stdin-piped env var setup on Windows.
  const adminPhone = (process.env.ADMIN_PHONE || "").trim();
  const adminOtp   = (process.env.ADMIN_OTP   || "").trim();

  let parsed: { pin?: string; phone?: string; otp?: string };
  try {
    parsed = body.parse(await req.json());
  } catch {
    return Response.json({ data: null, error: "Invalid request" }, { status: 400 });
  }

  const phoneMatch = !!adminPhone && parsed.phone === adminPhone && parsed.otp === adminOtp;
  const pinSecret  = process.env.ADMIN_SECRET || "";
  const pinMatch   = !!pinSecret && parsed.pin === pinSecret;

  if (!phoneMatch && !pinMatch) {
    return Response.json({ data: null, error: "Wrong credentials" }, { status: 401 });
  }

  const secret = pinSecret || adminOtp;

  try {
    const db = getAdminClient();

    // Ensure admin user exists
    const { data: listData } = await db.auth.admin.listUsers({ perPage: 1000 });
    let adminUser = (listData?.users ?? []).find((u) => u.email === ADMIN_EMAIL);

    if (!adminUser) {
      const { data: newUser } = await db.auth.admin.createUser({
        email:         ADMIN_EMAIL,
        phone:         ADMIN_SUPABASE_PHONE,
        email_confirm: true,
        phone_confirm: true,
      });
      adminUser = newUser?.user ?? undefined;
    }

    if (adminUser) {
      // Set a single-use random password, sign in server-side, return tokens
      const oneTimePass = crypto.randomUUID();
      await db.auth.admin.updateUserById(adminUser.id, { password: oneTimePass });

      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
        email:    ADMIN_EMAIL,
        password: oneTimePass,
      });

      if (!signInErr && signInData.session) {
        return Response.json({
          data: {
            token: secret,
            session: {
              access_token:  signInData.session.access_token,
              refresh_token: signInData.session.refresh_token,
            },
          },
          error: null,
        });
      }

      console.error("[admin/auth] signInWithPassword failed", signInErr);
    }
  } catch (err) {
    console.error("[admin/auth] session setup failed", err);
  }

  // Fallback — proxy cookie bypass still grants dashboard access
  return Response.json({ data: { token: secret }, error: null });
}
