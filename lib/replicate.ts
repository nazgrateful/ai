// Minimal server-side client for the Replicate HTTP API.
// Docs: https://replicate.com/docs/reference/http

const API = "https://api.replicate.com/v1";

export type Prediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  logs?: string | null;
};

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN;
  if (!t) {
    throw new ConfigError(
      "REPLICATE_API_TOKEN is not set. Add it in your hosting dashboard (Vercel: Settings → Environment Variables), or in .env.local when running locally. Get one at replicate.com/account/api-tokens.",
    );
  }
  return t;
}

export class ConfigError extends Error {}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = (body as { detail?: string }).detail ?? res.statusText;
    throw new Error(`Replicate error (${res.status}): ${detail}`);
  }
  return body as T;
}

export function createPrediction(model: string, input: Record<string, unknown>) {
  return call<Prediction>(`/models/${model}/predictions`, {
    method: "POST",
    body: JSON.stringify({ input }),
  });
}

export function getPrediction(id: string) {
  return call<Prediction>(`/predictions/${encodeURIComponent(id)}`);
}

export function videoUrl(p: Prediction): string | null {
  if (!p.output) return null;
  return Array.isArray(p.output) ? (p.output[0] ?? null) : p.output;
}
