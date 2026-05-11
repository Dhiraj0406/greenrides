import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface FareEstimate {
  fare: number;
  confidence: "high" | "medium" | "low";
  notes: string;
}

export async function estimateCustomFare(
  from: string,
  to: string,
  distanceKm: number,
  durationMin: number
): Promise<FareEstimate> {
  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system:
        "You are a fare calculator for Green, a ride platform in Odisha, India. " +
        "Respond ONLY with a valid JSON object — no markdown, no explanation.",
      messages: [
        {
          role: "user",
          content: `Route: ${from} → ${to}
Distance: ${distanceKm} km
Duration: ${durationMin} minutes
Region: Koraput/Jeypore hill district, Odisha

Rate card (calibrated to local market):
- Formula: max(₹500, round(km × ₹20 / 25) × 25)
- Examples: 22km=₹500, 42km=₹850, 100km=₹2000, 195km=₹3900
- Round to nearest ₹25

Return ONLY this JSON:
{"fare":<rupees>,"confidence":"high"|"medium"|"low","notes":"<1 sentence>"}`,
        },
      ],
    });

    const text = (message.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text.trim()) as FareEstimate;

    if (
      typeof parsed.fare !== "number" ||
      !["high", "medium", "low"].includes(parsed.confidence)
    ) {
      throw new Error("Invalid response shape");
    }

    return parsed;
  } catch {
    const fare = Math.max(500, Math.round((distanceKm * 20) / 25) * 25);
    return {
      fare,
      confidence: "medium",
      notes: "Calculated using standard Odisha hill rate card.",
    };
  }
}
