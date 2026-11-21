import { describe, expect, it } from "vitest";
import { GET } from "./route";

const req = (query = "") => new Request(`http://localhost/governance/archive/export${query}`);

describe("GET /governance/archive/export", () => {
  it("returns 400 for a reversed date range", async () => {
    const res = await GET(req("?from=2026-06-01&to=2026-01-01"));
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBeTruthy();
  });

  it("returns 400 for unparseable dates", async () => {
    for (const query of ["?from=not-a-date", "?to=not-a-date"]) {
      const res = await GET(req(query));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error?: string }).error).toBeTruthy();
    }
  });

  it("returns the CSV for a valid range", async () => {
    const res = await GET(req("?from=2026-01-01&to=2026-12-31"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(await res.text()).toContain("id,title,category,status");
  });

  it("keeps default behaviour when params are missing", async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
  });
});
