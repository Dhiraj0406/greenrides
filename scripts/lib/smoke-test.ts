const CRITICAL_URLS = [
  "https://greenrides.co.in/",
  "https://greenrides.co.in/rides",
  "https://greenrides.co.in/fleet/login",
  "https://greenrides.co.in/drivers",
  "https://greenrides.co.in/admin",
];

export interface SmokeResult {
  url:    string;
  status: number;
  ok:     boolean;
}

export interface SmokeTestSummary {
  passed:  boolean;
  results: SmokeResult[];
}

export async function runSmokeTests(): Promise<SmokeTestSummary> {
  const results = await Promise.all(
    CRITICAL_URLS.map(async (url): Promise<SmokeResult> => {
      try {
        const res = await fetch(url, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(15_000) });
        return { url, status: res.status, ok: res.status === 200 };
      } catch (err) {
        console.error(`Smoke test failed for ${url}:`, err);
        return { url, status: 0, ok: false };
      }
    }),
  );
  return { passed: results.every((r) => r.ok), results };
}
