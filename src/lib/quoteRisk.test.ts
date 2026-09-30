import { describe, expect, it } from "vitest";
import { assessQuote } from "./quoteRisk";
describe("quote risk", () => { it.each([[0.99, "none"], [1, "caution"], [3, "warning"], [10, "severe"]] as const)("classifies %s", (impact, level) => expect(assessQuote({ priceImpactPct: impact }).level).toBe(level)); it("requires confirmation for severe risk", () => expect(assessQuote({ priceImpactPct: 12 }).requiresConfirmation).toBe(true)); });
