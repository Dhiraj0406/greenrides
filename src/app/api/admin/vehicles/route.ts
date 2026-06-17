import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const BUCKET = "kyc-documents";
const SIGNED_URL_TTL = 3600;

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getAdminClient();
    const { data: vehicles, error } = await db
      .from("Vehicle")
      .select("*, owner:owner_id(name, phone, user:user_id(name, phone)), driver:driver_id(user:user_id(name, phone))")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = await Promise.all(
      (vehicles ?? []).map(async (v) => {
        const photoUrls = v.photos?.length
          ? await Promise.all(
              (v.photos as string[]).map((path: string) =>
                db.storage
                  .from(BUCKET)
                  .createSignedUrl(path, SIGNED_URL_TTL)
                  .then((r) => r.data?.signedUrl ?? null),
              ),
            )
          : [];

        return {
          id:         v.id,
          make:       v.make,
          model_name: v.model_name,
          number:     v.number,
          seats:      v.seats,
          active:     v.active,
          photos:     photoUrls.filter(Boolean),
          owner:      v.owner ? { name: (v.owner as { user?: { name?: string; phone?: string } })?.user?.name ?? null, phone: (v.owner as { user?: { name?: string; phone?: string } })?.user?.phone ?? null } : null,
          driver:     v.driver ? { name: (v.driver as { user?: { name?: string; phone?: string } })?.user?.name ?? null, phone: (v.driver as { user?: { name?: string; phone?: string } })?.user?.phone ?? null } : null,
          created_at: v.created_at,
        };
      }),
    );

    return Response.json({ data: rows, error: null });
  } catch (err) {
    console.error("[admin/vehicles GET]", err);
    return Response.json({ data: null, error: "Failed to fetch vehicles" }, { status: 500 });
  }
}
