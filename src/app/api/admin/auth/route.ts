import { NextRequest } from "next/server";
import { z } from "zod";

const body = z.object({ pin: z.string().min(1) });

export async function POST(req: NextRequest) {
  let parsed: { pin: string };
  try {
    parsed = body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    return Response.json({ error: "Admin not configured" }, { status: 500 });
  }

  if (parsed.pin !== secret) {
    return Response.json({ error: "Wrong PIN" }, { status: 401 });
  }

  return Response.json({ token: secret });
}
