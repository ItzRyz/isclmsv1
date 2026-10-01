const url = process.env["UPSTASH_REDIS_REST_URL"];
const token = process.env["UPSTASH_REDIS_REST_TOKEN"];

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
};

/** Jendela statis per proses — fallback dev/bila Upstash tidak di-set. */
const memory = new Map<string, { count: number; resetAt: number }>();

function inMemory(
  key: string,
  limit: number,
  windowSec: number,
): RateLimitResult {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSec * 1000 });
    return { ok: true, remaining: limit - 1 };
  }
  entry.count += 1;
  if (memory.size > 5000) memory.clear();
  return {
    ok: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
  };
}

/**
 * Fixed-window rate limit per key (IP + aksi). Upstash Redis bila di-set
 * (berlaku lintas instance Vercel); fallback memori per-proses untuk dev.
 * Best-effort pertahanan — bukan sumber kebenaran authorization.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number,
): Promise<RateLimitResult> {
  if (!url || !token) return inMemory(key, limit, windowSec);
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSec), "NX"],
      ]),
    });
    if (!res.ok) return inMemory(key, limit, windowSec);
    const data = (await res.json()) as { result?: number }[];
    const count = Number(data[0]?.result ?? 1);
    return { ok: count <= limit, remaining: Math.max(0, limit - count) };
  } catch {
    return inMemory(key, limit, windowSec);
  }
}
