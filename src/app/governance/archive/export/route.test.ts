import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("governance archive export route", () => {
  it("includes proposals whose start date equals the from boundary", async () => {
    const from = "2024-01-01";
    const to = "2024-01-01";

    const request = new Request(
      `http://localhost/governance/archive/export?from=${from}&to=${to}`,
    );

    const response = await GET(request);
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).toContain(from);
  });
});
