import { describe, expect, it } from "vitest";
import { parseSwapLink, serializeSwapLink } from "./swapLink";
describe("swap links", () => { it("round trips validated state", () => { const state = { srcChain: "base", srcToken: "USDC", amount: "100", dstToken: "XLM" }; expect(parseSwapLink(serializeSwapLink(state)).state).toEqual(state); }); it("rejects unknown and destination params", () => { const result = parseSwapLink("https://vortex.local/?srcChain=wat&amount=%00&dstAddress=GABC"); expect(result.state).toBeUndefined(); expect(result.errors.length).toBeGreaterThan(0); }); });
