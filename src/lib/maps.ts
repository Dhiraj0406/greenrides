import { Client, TravelMode } from "@googlemaps/google-maps-services-js";

const client = new Client({});
const API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY!;

export async function getRouteData(origin: string, destination: string) {
  const response = await client.distancematrix({
    params: {
      origins: [`${origin}, Odisha, India`],
      destinations: [`${destination}, Odisha, India`],
      mode: TravelMode.driving,
      key: API_KEY,
    },
  });

  const element = response.data.rows[0]?.elements[0];
  if (!element || element.status !== "OK") {
    throw new Error(`Route not found: ${origin} → ${destination}`);
  }

  return {
    distance_m:    element.distance.value,
    distance_km:   Math.round(element.distance.value / 100) / 10,
    duration_s:    element.duration.value,
    duration_min:  Math.ceil(element.duration.value / 60),
    duration_text: element.duration.text,
    distance_text: element.distance.text,
  };
}

const KNOWN_CITIES: { name: string; lat: number; lng: number }[] = [
  { name: "Koraput",  lat: 18.8129, lng: 82.7149 },
  { name: "Jeypore",  lat: 18.8606, lng: 82.5716 },
  { name: "Sunabeda", lat: 18.7800, lng: 82.8200 },
  { name: "Malkangiri", lat: 18.3500, lng: 81.8960 },
  { name: "Rayagada", lat: 19.1714, lng: 83.4144 },
];

const CITY_ALIASES: Record<string, string> = {
  jaypore:    "Jeypore",
  jeypore:    "Jeypore",
  koraput:    "Koraput",
  sunabeda:   "Sunabeda",
  malkangiri: "Malkangiri",
  rayagada:   "Rayagada",
};

export async function detectCityFromCoords(
  lat: number,
  lng: number
): Promise<string> {
  try {
    const response = await client.reverseGeocode({
      params: { latlng: { lat, lng }, key: API_KEY },
    });

    for (const result of response.data.results) {
      for (const component of result.address_components) {
        if ((component.types as string[]).includes("locality")) {
          const key = component.long_name.toLowerCase().replace(/\s+/g, "");
          for (const [alias, city] of Object.entries(CITY_ALIASES)) {
            if (key.includes(alias)) return city;
          }
        }
      }
    }
  } catch {
    // fall through to distance-based fallback
  }

  // Distance-based fallback
  let nearest = KNOWN_CITIES[0];
  let minDist = Infinity;
  for (const city of KNOWN_CITIES) {
    const d = Math.hypot(city.lat - lat, city.lng - lng);
    if (d < minDist) {
      minDist = d;
      nearest = city;
    }
  }
  return nearest.name;
}

export function calculateFareFromDistance(km: number): number {
  const isHillRoute = km > 30;
  const perKm = isHillRoute ? 2.1 : 1.85;
  const raw = 50 + km * perKm;
  const rounded = Math.round(raw / 5) * 5;
  return Math.max(rounded, 60);
}
