import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = (req.headers.get("authorization") ?? "").replace("Bearer ", "");
  if (!token) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const sb = getAdminClient();

  const { data: userData } = await sb.auth.getUser(token);
  if (!userData.user) return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });

  const { data: dispatches, error } = await sb
    .from("DriverDispatch")
    .select("id, responded_at, created_at, request:RideRequest(id, from_city, to_city, fare_paise, travel_date, status)")
    .eq("driver_id", userData.user.id)
    .eq("status", "ACCEPTED")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return Response.json({ data: null, error: error.message }, { status: 500 });

  interface DispatchRow {
    id: string;
    responded_at: string | null;
    created_at: string;
    request: {
      id: string;
      from_city: string;
      to_city: string;
      fare_paise: number;
      travel_date: string;
      status: string;
    } | null;
  }

  const completed = (dispatches as unknown as DispatchRow[]).filter(
    (d) => d.request?.status === "COMPLETED"
  );

  return Response.json({ data: completed, error: null });
}
