const BASE       = "https://api.vercel.com";
const TOKEN      = process.env.VERCEL_TOKEN!;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID!;
// No teamId — VERCEL_TOKEN is a personal access token (vcp_), queries personal scope

export interface VercelDeployment {
  uid:        string;
  url:        string;
  readyState: "QUEUED" | "BUILDING" | "READY" | "ERROR" | "CANCELED";
  createdAt:  number;
}

async function vercelFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...opts.headers },
  });
}

export async function getLatestProductionDeployment(): Promise<VercelDeployment | null> {
  const res  = await vercelFetch(`/v13/deployments?projectId=${PROJECT_ID}&limit=1&target=production`);
  const json = await res.json() as { deployments: VercelDeployment[] };
  return json.deployments?.[0] ?? null;
}

export async function pollDeploymentReady(
  pushedAfterMs: number,
  maxWaitMs  = 600_000,
  intervalMs = 15_000,
): Promise<VercelDeployment> {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const deploy = await getLatestProductionDeployment();
    if (!deploy) continue;
    if (deploy.createdAt < pushedAfterMs) continue;
    if (deploy.readyState === "READY" || deploy.readyState === "ERROR") return deploy;
  }
  throw new Error("Deployment timed out after 10 minutes");
}

export async function getPreviousProductionDeployment(): Promise<VercelDeployment | null> {
  const res  = await vercelFetch(`/v13/deployments?projectId=${PROJECT_ID}&limit=2&target=production`);
  const json = await res.json() as { deployments: VercelDeployment[] };
  return json.deployments?.[1] ?? null;
}

export async function rollbackToPreviousDeployment(): Promise<string> {
  const previous = await getPreviousProductionDeployment();
  if (!previous) throw new Error("No previous deployment found");
  const res = await vercelFetch(`/v9/projects/${PROJECT_ID}/rollback/${previous.uid}`, { method: "POST" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vercel rollback failed ${res.status}: ${body}`);
  }
  return previous.uid;
}
