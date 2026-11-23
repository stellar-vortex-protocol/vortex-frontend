import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const checkDatabase = vi.fn();
const checkCache = vi.fn();

vi.mock("@/lib/health/dependencies", () => ({
  checkDatabase: (...args: unknown[]) => checkDatabase(...args),
  checkCache: (...args: unknown[]) => checkCache(...args),
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    checkDatabase.mockReset();
    checkCache.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 200 when all dependencies are healthy", async () => {
    checkDatabase.mockResolvedValue({ ok: true });
    checkCache.mockResolvedValue({ ok: true });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.dependencies).toEqual({
      database: { ok: true },
      cache: { ok: true },
    });
  });

  it("returns 503 and names the failing dependency when a check fails", async () => {
    checkDatabase.mockResolvedValue({ ok: false, error: "connection refused" });
    checkCache.mockResolvedValue({ ok: true });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.failed).toContain("database");
    expect(body.dependencies.database.ok).toBe(false);
    expect(body.dependencies.cache.ok).toBe(true);
  });
});
