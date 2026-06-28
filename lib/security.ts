import { NextRequest, NextResponse } from "next/server";

type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const BLOCKED_TAGS =
  /<\s*\/?\s*(script|style|iframe|object|embed|meta|link|form|input|button|svg|math)[^>]*>/gi;
const EVENT_ATTRIBUTES = /\s+on[a-z]+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const STYLE_ATTRIBUTES = /\s+style\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi;
const DANGEROUS_URLS = /\s+(href|src)\s*=\s*(['"]?)\s*(javascript:|data:text\/html|vbscript:)[^'"\s>]*/gi;

export const API_BODY_LIMIT = 280_000;

export function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const userAgent = request.headers.get("user-agent")?.slice(0, 80) ?? "unknown-agent";

  return `${forwardedFor || realIp || "local"}:${userAgent}`;
}

export function enforceRateLimit(
  request: NextRequest,
  scope: string,
  config: RateLimitConfig
) {
  const now = Date.now();
  const key = `${scope}:${getClientKey(request)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return null;
  }

  existing.count += 1;

  if (existing.count <= config.max) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return NextResponse.json(
    {
      success: false,
      message: "Too many requests. Please wait a moment and try again.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
      },
    }
  );
}

export async function readLimitedJson<T = unknown>(
  request: NextRequest,
  maxBytes = API_BODY_LIMIT
): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > maxBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  const raw = await request.text();

  if (new TextEncoder().encode(raw).length > maxBytes) {
    throw new Error("REQUEST_TOO_LARGE");
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

export function sanitizeDocumentHtml(value: string) {
  return value
    .replace(BLOCKED_TAGS, "")
    .replace(EVENT_ATTRIBUTES, "")
    .replace(STYLE_ATTRIBUTES, "")
    .replace(DANGEROUS_URLS, "");
}

export function normalizeDocumentInput(input: {
  title?: string;
  content?: string;
}) {
  return {
    title: input.title?.trim(),
    content:
      typeof input.content === "string"
        ? sanitizeDocumentHtml(input.content)
        : undefined,
  };
}
