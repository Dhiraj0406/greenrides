import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase";

function isAdmin(req: NextRequest) {
  return req.headers.get("x-admin-token") === process.env.ADMIN_SECRET;
}

const VALID_STATUSES = new Set(["PENDING", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]);

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  const rawStatus = req.nextUrl.searchParams.get("status");
  const status    = rawStatus && VALID_STATUSES.has(rawStatus) ? rawStatus : null;
  const format    = req.nextUrl.searchParams.get("format");

  try {
    const db = getAdminClient();
    let query = db
      .from("RideRequest")
      .select("id, from_city, to_city, fare_paise, travel_date, status, driver_name, driver_phone, created_at, rider:rider_id(name, phone)")
      .order("created_at", { ascending: false });

    if (status && format !== "csv") query = query.eq("status", status);

    const { data, error } = await query;
    if (error) throw error;

    if (format === "csv") {
      const rows = data ?? [];
      const header = ["ID", "Rider Name", "Rider Phone", "From", "To", "Fare (INR)", "Travel Date", "Status", "Driver", "Driver Phone", "Booked At"];
      const lines  = rows.map((r) => {
        const rider = r.rider as { name: string | null; phone: string } | null;
        return [
          r.id,
          rider?.name ?? "",
          rider?.phone ?? "",
          r.from_city,
          r.to_city,
          (r.fare_paise / 100).toFixed(0),
          r.travel_date ? new Date(r.travel_date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "",
          r.status,
          r.driver_name ?? "",
          r.driver_phone ?? "",
          new Date(r.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });
      const csv = [header.join(","), ...lines].join("\n");
      const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="green-rides-bookings-${today}.csv"`,
        },
      });
    }

    return Response.json({ data, error: null });
  } catch (err) {
    console.error("[admin/requests GET]", err);
    return Response.json({ data: null, error: "Failed to fetch requests" }, { status: 500 });
  }
}
