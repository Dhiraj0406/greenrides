const INTERAKT_URL = "https://api.interakt.ai/v1/public/message/";

function makeHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
  };
}

async function sendWhatsApp(
  phone: string,
  templateName: string,
  params: Record<string, string>
): Promise<void> {
  const res = await fetch(INTERAKT_URL, {
    method: "POST",
    headers: makeHeaders(),
    body: JSON.stringify({
      countryCode: "+91",
      phoneNumber: phone.replace(/^\+91/, ""),
      callbackData: "green_notification",
      type: "Template",
      template: {
        name:         templateName,
        languageCode: "en",
        bodyValues:   Object.values(params),
      },
    }),
  });

  if (!res.ok) {
    console.error(
      `[WhatsApp] Failed to send ${templateName} to ${phone}:`,
      await res.text()
    );
  }
}

export async function notifyRiderBookingConfirmed(data: {
  phone: string;
  name: string;
  from: string;
  to: string;
  date: string;
  time: string;
  driverName: string;
  driverPhone: string;
  seats: number;
  amount: number;
}): Promise<void> {
  await sendWhatsApp(data.phone, "green_booking_confirmed", {
    name:        data.name,
    from:        data.from,
    to:          data.to,
    datetime:    `${data.date} at ${data.time}`,
    driver_name: data.driverName,
    driver_ph:   data.driverPhone,
    seats:       String(data.seats),
    amount:      `₹${data.amount}`,
  });
}

export async function notifyDriverNewBooking(data: {
  phone: string;
  riderName: string;
  riderPhone: string;
  from: string;
  to: string;
  seats: number;
  pickup: string;
  amount: number;
}): Promise<void> {
  await sendWhatsApp(data.phone, "green_driver_booking", {
    rider_name:  data.riderName,
    rider_phone: data.riderPhone,
    from:        data.from,
    to:          data.to,
    seats:       String(data.seats),
    pickup:      data.pickup,
    amount:      `₹${data.amount}`,
  });
}

export async function notifyRideReminder(data: {
  phone: string;
  name: string;
  from: string;
  to: string;
  time: string;
  pickup: string;
  driverName: string;
  driverPhone: string;
}): Promise<void> {
  await sendWhatsApp(data.phone, "green_ride_reminder", {
    name:        data.name,
    from:        data.from,
    to:          data.to,
    time:        data.time,
    pickup:      data.pickup,
    driver_name: data.driverName,
    driver_ph:   data.driverPhone,
  });
}

export async function notifyCancellation(
  phone: string,
  name: string,
  bookingId: string,
  amount: number
): Promise<void> {
  await sendWhatsApp(phone, "green_cancellation", {
    name,
    booking_id: bookingId.slice(-8).toUpperCase(),
    amount:     `₹${amount}`,
  });
}
