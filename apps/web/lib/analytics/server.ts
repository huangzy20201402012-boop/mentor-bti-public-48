import "server-only";

import { NextResponse } from "next/server";

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

/** A best-effort beta safeguard; it stores no identifier in the database. */
export function takeRateLimit(scope: string, key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucketKey = `${scope}:${key}`;
  const current = rateBuckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

export function requestRateKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const candidate = forwarded || realIp;
  // Never turn a missing proxy header into a single shared global rate bucket.
  return candidate && candidate.length <= 64 ? candidate : `unidentified-${crypto.randomUUID()}`;
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let source: URL;
  try {
    source = new URL(origin);
  } catch {
    return false;
  }
  if ((source.protocol !== "https:" && source.protocol !== "http:") || source.origin !== origin) return false;

  if (source.origin === new URL(request.url).origin) return true;
  // Netlify can give the handler an internal URL while preserving the public Host.
  const host = request.headers.get("host");
  return Boolean(host && source.host.toLowerCase() === host.toLowerCase());
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

export function rateLimitedResponse(): NextResponse {
  return NextResponse.json({ error: "rate_limited" }, { status: 429 });
}

export async function readJson(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function noContentResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
