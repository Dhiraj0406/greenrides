import { NextRequest } from "next/server";
import { z } from "zod";
import { notifyRideReminder } from "@/lib/notifications";

const schema = z.object({
  secret: z.string(),
  phone:  z.string(),
  name:   z.string(),
  from:   z.string(),
  to:     z.string(),
  time:   z.string(),
  pickup: z.string(),
  driver_name:  z.string(),
  driver_phone: z.string(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ data: null, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { data: null, error: "Invalid payload" },
      { status: 400 }
    );
  }

  if (parsed.data.secret !== process.env.CRON_SECRET) {
    return Response.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await notifyRideReminder({
      phone:       parsed.data.phone,
      name:        parsed.data.name,
      from:        parsed.data.from,
      to:          parsed.data.to,
      time:        parsed.data.time,
      pickup:      parsed.data.pickup,
      driverName:  parsed.data.driver_name,
      driverPhone: parsed.data.driver_phone,
    });
    return Response.json({ data: { sent: true }, error: null });
  } catch (err) {
    console.error("[notify]", err);
    return Response.json(
      { data: null, error: "Notification failed" },
      { status: 500 }
    );
  }
}
