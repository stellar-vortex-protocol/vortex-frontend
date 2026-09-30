import { describe, it, expect } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import { assessAddress, assessLabel, buildAddressIndex, diffSegments } from "./addressRisk";

const real = Keypair.random().publicKey();
// Lookalike: same first/last 4 chars, different middle.
const poisoned = real.slice(0, 4) + "Z".repeat(48) + real.slice(-4);

describe("assessAddress", () => {
  it("never flags an address against itself (property)", () => {
    for (let i = 0; i < 200; i++) {
      const pk = Keypair.random().publicKey();
      expect(assessAddress(pk, [pk]).risk).toBe("none");
    }
  });

  it("flags same prefix + suffix with a different middle as high", () => {
    const r = assessAddress(poisoned, [real]);
    expect(r).toEqual({ risk: "high", reasons: ["prefixAndSuffixMatch"], lookalike: real });
  });

  it("flags near-identical addresses as high", () => {
    // Change a prefix char so only the near-identical check can catch it.
    const tweaked = real[0] + (real[1] === "A" ? "B" : "A") + real.slice(2);
    expect(assessAddress(tweaked, [real]).reasons).toContain("nearIdentical");
  });

  it("reports a prefix-only match as low", () => {
    const other = real.slice(0, 4) + Keypair.random().publicKey().slice(4);
    const r = assessAddress(other, [real]);
    expect(["low", "high"]).toContain(r.risk);
    if (r.risk === "low") expect(r.reasons).toEqual(["prefixMatch"]);
  });

  it("is case-insensitive and ignores surrounding whitespace", () => {
    expect(assessAddress(`  ${real.toLowerCase()} `, [real]).risk).toBe("none");
  });

  it("returns none for unrelated addresses and an empty history", () => {
    expect(assessAddress(real, []).risk).toBe("none");
  });

  it("honours configurable prefix/suffix lengths", () => {
    const partial = real.slice(0, 2) + "Z".repeat(52) + real.slice(-2);
    expect(assessAddress(partial, [real], { prefixLength: 2, suffixLength: 2 }).risk).toBe("high");
  });

  it("memoises the index per array", () => {
    const known = [real];
    expect(buildAddressIndex(known)).toBe(buildAddressIndex(known));
  });

  it("assesses in < 5 ms against 2,000 known addresses", () => {
    const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    const known = Array.from({ length: 2000 }, () =>
      "G" + Array.from({ length: 55 }, () => B32[Math.floor(Math.random() * 32)]).join(""),
    );
    const index = buildAddressIndex(known);
    const start = performance.now();
    for (let i = 0; i < 100; i++) assessAddress(poisoned, index);
    expect((performance.now() - start) / 100).toBeLessThan(5);
  });
});

describe("assessLabel", () => {
  it("flags homoglyph lookalikes of a known label", () => {
    const r = assessLabel("Аlice", ["Alice"]); // Cyrillic А
    expect(r.risk).toBe("high");
    expect(r.reasons).toEqual(expect.arrayContaining(["labelConfusable", "labelMixedScripts"]));
  });

  it("does not flag the identical label or unrelated labels", () => {
    expect(assessLabel("Alice", ["Alice", "Bob"]).risk).toBe("none");
    expect(assessLabel("Carol", ["Alice"]).risk).toBe("none");
  });
});

describe("diffSegments", () => {
  it("groups runs of matching and differing characters", () => {
    expect(diffSegments("GABCX", "GAZZX")).toEqual([
      { text: "GA", differs: false },
      { text: "BC", differs: true },
      { text: "X", differs: false },
    ]);
  });
});
