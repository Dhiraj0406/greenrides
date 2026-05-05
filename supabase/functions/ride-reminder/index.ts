import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const INTERAKT_URL = "https://api.interakt.ai/v1/public/message/";

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now    = new Date();
  const cutoff = new Date(now.getTime() + 60 * 60 * 1000);   // +60 min
  const soon   = new Date(now.getTime() + 90 * 60 * 1000);   // +90 min

  // Find confirmed bookings whose ride departs in 60–90 min
  const { data: bookings, error } = await supabase
    .from("Booking")
    .select(`
      id,
      seats,
      pickup_point,
      rider:User!rider_id ( name, phone ),
      ride:Ride!ride_id (
        from_city, to_city, departure_time, fare_paise,
        driver:User!driver_id ( name, phone )
      )
    `)
    .eq("status", "CONFIRMED")
    .gte("ride.departure_time", cutoff.toISOString())
    .lte("ride.departure_time", soon.toISOString());

  if (error) {
    console.error("Query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    });
  }

  let sent = 0;

  for (const booking of bookings ?? []) {
    const rider  = booking.rider  as { name: string; phone: string } | null;
    const ride   = booking.ride   as {
      from_city: string; to_city: string; departure_time: string;
      driver: { name: string; phone: string } | null;
    } | null;

    if (!rider?.phone || !ride) continue;

    const depTime = new Date(ride.departure_time).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });

    await sendWhatsApp(rider.phone, "green_ride_reminder", {
      name:        rider.name ?? "Rider",
      from:        ride.from_city,
      to:          ride.to_city,
      time:        depTime,
      pickup:      booking.pickup_point,
      driver_name: ride.driver?.name  ?? "Driver",
      driver_ph:   ride.driver?.phone ?? "",
    });

    sent++;
  }

  return new Response(JSON.stringify({ sent, checked: bookings?.length ?? 0 }), {
    headers: { "Content-Type": "application/json" },
  });
});

async function sendWhatsApp(
  phone: string,
  templateName: string,
  params: Record<string, string>
): Promise<void> {
  await fetch(INTERAKT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Basic ${Deno.env.get("INTERAKT_API_KEY")}`,
    },
    body: JSON.stringify({
      countryCode:  "+91",
      phoneNumber:  phone.replace(/^\+91/, ""),
      callbackData: "green_reminder",
      type:         "Template",
      template: {
        name:         templateName,
        languageCode: "en",
        bodyValues:   Object.values(params),
      },
    }),
  });
}
