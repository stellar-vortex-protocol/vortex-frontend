import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const post = (body: string) => POST(new Request("http://x/api/csp-report", { method: "POST", body }));

describe("POST /api/csp-report", () => {
  it("accepts the legacy format and redacts query strings", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(
      JSON.stringify({ "csp-report": { "violated-directive": "script-src", "blocked-uri": "https://evil.example/a?token=abc" } }),
    );
    expect(res.status).toBe(204);
    expect(JSON.stringify(warn.mock.calls)).not.toContain("token=abc");
    warn.mockRestore();
  });

  it("accepts Reporting API bodies", async () => {
    expect((await post(JSON.stringify([{ type: "csp-violation", body: { effectiveDirective: "img-src" } }]))).status).toBe(204);
  });

  it("returns 204 for garbage and oversized bodies", async () => {
    expect((await post("{nope")).status).toBe(204);
    expect((await post("x".repeat(100_000))).status).toBe(204);
  });
});
