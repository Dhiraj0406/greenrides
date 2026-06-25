import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase";
import { z } from "zod";

const schema = z.object({
  phone: z.string().min(10),
  otp:   z.string().length(6),
});

function getTestPhones(): Map<string, string> {
  const map = new Map<string, string>();
  const raw = process.env.TEST_PHONES || "";
  raw.split(",").forEach((entry) => {
    const [phone, otp] = entry.trim().split(":");
    if (phone && otp) map.set(phone.trim(), otp.trim());
  });
  return map;
}

export async function POST(req: NextRequest) {
  const testPhones = getTestPhones();
  if (testPhones.size === 0) {
    return Response.json({ data: null, error: "Test login not enabled" }, { status: 403 });
  }

  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return Response.json({ data: null, error: "Invalid request" }, { status: 400 });
  }

  const { phone, otp } = body.data;
  const expectedOtp = testPhones.get(phone);
  if (!expectedOtp || expectedOtp !== otp) {
    return Response.json({ data: null, error: "Wrong test OTP" }, { status: 401 });
  }

  const testEmail = `test.${phone}@green-rides-internal.app`;
  const testPass  = `green-test-${phone}-${otp}-internal`;

  const db = getAdminClient();
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    // Step 1: Try direct sign-in (fast path — works if password was set on a prior call)
    const { data: directSignIn } = await anonClient.auth.signInWithPassword({
      email: testEmail, password: testPass,
    });
    if (directSignIn.session) {
      return Response.json({ session: toSession(directSignIn.session) });
    }

    // Step 2: Look up UUID from public.User (seed stores "+91XXXXXXXXXX", try both formats)
    let userId: string | null = null;
    for (const variant of [phone, `+91${phone}`]) {
      const { data: pu } = await db.from("User").select("id").eq("phone", variant).maybeSingle();
      if (pu?.id) { userId = pu.id; break; }
    }

    if (!userId) {
      console.error("[test-login] public.User not found for phone:", phone);
      return Response.json({ data: null, error: "Test user not found" }, { status: 404 });
    }

    // Step 3: Try to set credentials via admin update (works for normal GoTrue-created users)
    const { data: updData, error: updErr } = await db.auth.admin.updateUserById(userId!, {
      email: testEmail, email_confirm: true, password: testPass,
    });

    if (!updErr && updData?.user) {
      // updateUserById succeeded — sign in with the email on the updated user
      const signInEmail = updData.user.email || testEmail;
      const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: signInEmail, password: testPass,
      });
      if (signInErr || !signIn.session) {
        console.error("[test-login] signInWithPassword failed:", signInErr?.message);
        return Response.json({ data: null, error: signInErr?.message || "Sign in failed" }, { status: 500 });
      }
      return Response.json({ session: toSession(signIn.session) });
    }

    // Step 4: updateUserById failed (SQL-seeded user has no GoTrue record).
    // Self-heal: delete any broken auth.users row, then recreate with the SAME UUID
    // as public.User so no FK migration is needed.
    console.warn("[test-login] updateUserById failed, self-healing:", updErr?.message, "userId:", userId);

    await db.auth.admin.deleteUser(userId!).catch(() => {});

    const { data: newUser, error: createErr } = await db.auth.admin.createUser({
      id:            userId!,   // Reuse public.User.id — keeps all FK relations intact
      email:         testEmail,
      email_confirm: true,
      password:      testPass,
      phone:         `+91${phone}`,
      phone_confirm: true,
      app_metadata:  getAppMeta(phone),
      user_metadata: { email_verified: true },
    });

    if (createErr || !newUser?.user) {
      console.error("[test-login] createUser failed:", createErr?.message);
      return Response.json({ data: null, error: "Could not create test user" }, { status: 500 });
    }

    // Sign in with the fresh user
    const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail, password: testPass,
    });
    if (signInErr || !signIn.session) {
      console.error("[test-login] signInWithPassword (new user) failed:", signInErr?.message);
      return Response.json({ data: null, error: signInErr?.message || "Sign in failed" }, { status: 500 });
    }

    return Response.json({ session: toSession(signIn.session) });
  } catch (err) {
    console.error("[test-login]", err);
    return Response.json({ data: null, error: "Internal error" }, { status: 500 });
  }
}

function toSession(s: { access_token: string; refresh_token: string }) {
  return { access_token: s.access_token, refresh_token: s.refresh_token };
}

function getAppMeta(phone: string): Record<string, unknown> {
  if (phone === "9000000001") return { roles: ["driver"], fleet_status: "active", provider: "phone", providers: ["phone", "email"] };
  if (phone === "9000000002") return { roles: ["owner"],  fleet_status: "active", provider: "phone", providers: ["phone", "email"] };
  return { provider: "phone", providers: ["phone", "email"] };
}
