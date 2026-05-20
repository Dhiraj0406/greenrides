import { Resend } from "resend";

const INTERAKT_URL = "https://api.interakt.ai/v1/public/message/";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  if (!resend || !opts.to.includes("@")) return;
  try {
    await resend.emails.send({
      from: "Green Rides <noreply@green-rides.app>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
  } catch (err) {
    console.error("[resend] email failed", err);
  }
}

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
  email?: string;
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
  await Promise.allSettled([
    sendWhatsApp(data.phone, "green_booking_confirmed", {
      name:        data.name,
      from:        data.from,
      to:          data.to,
      datetime:    `${data.date} at ${data.time}`,
      driver_name: data.driverName,
      driver_ph:   data.driverPhone,
      seats:       String(data.seats),
      amount:      `₹${data.amount}`,
    }),
    data.email
      ? sendEmail({
          to: data.email,
          subject: `Your Green Rides booking is confirmed — ${data.from} → ${data.to}`,
          html: `
            <p>Hi ${data.name},</p>
            <p>Your ride is confirmed!</p>
            <table>
              <tr><td><strong>Route</strong></td><td>${data.from} → ${data.to}</td></tr>
              <tr><td><strong>Date</strong></td><td>${data.date} at ${data.time}</td></tr>
              <tr><td><strong>Driver</strong></td><td>${data.driverName} · ${data.driverPhone}</td></tr>
              <tr><td><strong>Seats</strong></td><td>${data.seats}</td></tr>
              <tr><td><strong>Amount</strong></td><td>₹${data.amount}</td></tr>
            </table>
            <p>Have a great trip!</p>
            <p>— Green Rides Team</p>
          `,
        })
      : Promise.resolve(),
  ]);
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
