/**
 * Server-side GitHub contributors fetcher used by `/api/contributors`.
 *
 * The browser never talks to api.github.com: the strict CSP blocks it, the
 * unauthenticated rate limit is 60 req/h per visitor IP, and it would leak
 * visitors' IPs to a third party. Instead the route handler fetches once per
 * revalidation window (optionally authenticated with the server-only
 * `GITHUB_TOKEN`), validates and normalises the payload, and falls back to the
 * last good response or a bundled snapshot when GitHub is unavailable.
 */

import fallbackSnapshot from "./contributors.fallback.json";

export interface Contributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
}

export type ContributorsSource = "live" | "cache" | "fallback";

export interface ContributorsResponse {
  contributors: Contributor[];
  source: ContributorsSource;
}

export const REPO_OWNER = "stellar-vortex-protocol";
export const REPO_NAME = "vortex-frontend";
export const GITHUB_CONTRIBUTORS_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors?per_page=100`;

/** Cache window for the route (seconds). */
export const CONTRIBUTORS_REVALIDATE_SECONDS = 3600;

const FETCH_TIMEOUT_MS = 5000;
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_CONTRIBUTORS = 100;

// GitHub login rules: alphanumerics and single hyphens, max 39 chars.
const LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

/** Avatars are always derived from the login, never from the upstream URL. */
export function avatarUrlFor(login: string): string {
  return `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=160`;
}

function toContributor(login: string, contributions: number): Contributor {
  return {
    login,
    avatarUrl: avatarUrlFor(login),
    profileUrl: `https://github.com/${encodeURIComponent(login)}`,
    contributions,
  };
}

/** Validates an untrusted GitHub payload; drops bots and malformed entries. */
export function normalizeContributors(payload: unknown): Contributor[] {
  if (!Array.isArray(payload)) throw new Error("Malformed contributors payload");
  const out: Contributor[] = [];
  for (const item of payload.slice(0, MAX_CONTRIBUTORS)) {
    if (!item || typeof item !== "object") continue;
    const { login, contributions, type } = item as Record<string, unknown>;
    if (typeof login !== "string" || !LOGIN_RE.test(login)) continue;
    if (typeof contributions !== "number" || !Number.isFinite(contributions) || contributions < 0) continue;
    if (type !== undefined && type !== "User") continue;
    out.push(toContributor(login, Math.floor(contributions)));
  }
  return out;
}

export function fallbackContributors(): Contributor[] {
  return normalizeContributors(fallbackSnapshot);
}

let lastGood: Contributor[] | null = null;

/** Test helper. */
export function __resetContributorsCache(): void {
  lastGood = null;
}

export async function getContributors(
  fetchImpl: typeof fetch = fetch,
  token: string | null = process.env["GITHUB_TOKEN"] ?? null,
): Promise<ContributorsResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${REPO_OWNER}-${REPO_NAME}`,
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetchImpl(GITHUB_CONTRIBUTORS_URL, {
      headers,
      signal: controller.signal,
      next: { revalidate: CONTRIBUTORS_REVALIDATE_SECONDS },
    } as RequestInit);
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);

    const body = await res.text();
    if (body.length > MAX_BODY_BYTES) throw new Error("GitHub response too large");

    const contributors = normalizeContributors(JSON.parse(body));
    lastGood = contributors;
    return { contributors, source: "live" };
  } catch {
    // Stale-while-error: serve the last good list, else the bundled snapshot.
    if (lastGood) return { contributors: lastGood, source: "cache" };
    return { contributors: fallbackContributors(), source: "fallback" };
  } finally {
    clearTimeout(timer);
  }
}
