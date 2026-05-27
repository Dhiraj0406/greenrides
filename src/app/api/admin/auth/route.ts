import { NextRequest } from "next/server";
import { z } from "zod";
import { getAdminClient } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

const ADMIN_EMAIL = "admin@green-rides.app";
const ADMIN_PHONE = "+919668021577";
const body = z.object({ pin: z.string().min(1) });

export async function POST(req: NextRequest) {
  let parsed: { pin: string };
  try {
    parsed = body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return Response.json({ error: "Admin not configured" }, { status: 500 });
  if (parsed.pin !== secret) return Response.json({ error: "Wrong PIN" }, { status: 401 });

  try {
    const db = getAdminClient();

    // Ensure admin user exists
    const { data: listData } = await db.auth.admin.listUsers({ perPage: 200 });
    let adminUser = (listData?.users ?? []).find((u) => u.email === ADMIN_EMAIL);

    if (!adminUser) {
      const { data: newUser } = await db.auth.admin.createUser({
        email:         ADMIN_EMAIL,
        phone:         ADMIN_PHONE,
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
          token: secret,
          session: {
            access_token:  signInData.session.access_token,
            refresh_token: signInData.session.refresh_token,
          },
        });
      }

      console.error("[admin/auth] signInWithPassword failed", signInErr);
    }
  } catch (err) {
    console.error("[admin/auth] session setup failed", err);
  }

  // Fallback — proxy cookie bypass still grants dashboard access
  return Response.json({ token: secret });
}
