import { afterEach, describe, expect, it } from "vitest";
import {
  ValidationError,
  feedItemListSchema,
  feedItemSchema,
  intentDetailSchema,
  intentsPageSchema,
  openIntentListSchema,
  quoteSchema,
  setStrictValidation,
  solverListSchema,
  solverSchema,
  type Validator,
} from "./schemas";
import { feedItem, intentDetail, openIntent, quote, solver } from "@/test/fixtures/api";

afterEach(() => setStrictValidation(false));

const cases: Array<[string, Validator<unknown>, unknown]> = [
  ["FeedItem", feedItemSchema, feedItem],
  ["IntentDetail", intentDetailSchema, intentDetail],
  ["Solver", solverSchema, solver],
  ["Quote", quoteSchema, quote],
];

describe("endpoint schemas", () => {
  it.each(cases)("%s accepts its fixture and unknown extra fields", (_n, v, fixture) => {
    expect(() => v(fixture)).not.toThrow();
    expect(() => v({ ...(fixture as object), futureField: 1 })).not.toThrow();
  });

  it.each([
    ["srcAmount", "1e5", "$.srcAmount"],
    ["srcAmount", "-1", "$.srcAmount"],
    ["createdAt", "yesterday", "$.createdAt"],
    ["status", "unknown", "$.status"],
    ["id", "", "$.id"],
  ])("FeedItem rejects bad %s=%j with path", (field, value, path) => {
    try {
      feedItemSchema({ ...feedItem, [field]: value });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).path).toBe(path);
    }
  });

  it("Solver requires a strkey address", () => {
    expect(() => solverSchema({ ...solver, address: "GABC123" })).toThrow(ValidationError);
  });

  it("lists drop invalid items, or throw in strict mode", () => {
    const list = [feedItem, { ...feedItem, id: 5 }];
    expect(feedItemListSchema(list)).toEqual([feedItem]);
    setStrictValidation(true);
    expect(() => feedItemListSchema(list)).toThrow(/\$\[1\]\.id/);
  });

  it("list schemas reject non-arrays", () => {
    expect(() => openIntentListSchema({})).toThrow(ValidationError);
    expect(() => solverListSchema(null)).toThrow(ValidationError);
    expect(openIntentListSchema([openIntent])).toEqual([openIntent]);
  });

  it("intentsPageSchema accepts paginated and legacy array responses", () => {
    expect(intentsPageSchema({ items: [feedItem], nextCursor: "c1" })).toEqual({ items: [feedItem], nextCursor: "c1" });
    expect(intentsPageSchema({ items: [], nextCursor: null })).toEqual({ items: [], nextCursor: null });
    expect(intentsPageSchema([feedItem])).toEqual({ items: [feedItem], nextCursor: null });
  });

  it("never throws anything but ValidationError on arbitrary input (fuzz)", () => {
    const samples: unknown[] = [null, undefined, 0, NaN, "", "x", [], {}, [null], { items: 1 }, true, Symbol("s")];
    for (let i = 0; i < 200; i++) {
      samples.push({ ...feedItem, [Object.keys(feedItem)[i % 8]!]: samples[i % 12] });
    }
    const all = [feedItemSchema, intentDetailSchema, solverSchema, quoteSchema, feedItemListSchema, intentsPageSchema];
    for (const v of all) {
      for (const s of samples) {
        try {
          v(s);
        } catch (err) {
          expect(err).toBeInstanceOf(ValidationError);
        }
      }
    }
  });
});
