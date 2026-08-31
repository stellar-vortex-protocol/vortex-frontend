import { describe, it, expect } from "vitest";
import {
  isQuote,
  isFeedItem,
  isFeedItemArray,
  isIntentDetail,
  isSolver,
  isSolverArray,
  isCreateIntentResponse,
  isSubmitIntentResponse,
  isRegisterSolverResponse,
  isSubmitRegistrationResponse,
  ValidationError,
} from "./schemas";

describe("Schema Validators", () => {
  describe("isQuote", () => {
    it("should validate a correct Quote", () => {
      const valid = {
        dstAmount: "100.50",
        solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323",
        fillTimeSeconds: 30,
        priceImpactPct: 0.5,
        protocolFeePct: 0.1,
        rate: "1.005",
      };
      expect(isQuote(valid)).toBe(true);
    });

    it("should reject Quote with missing fields", () => {
      expect(isQuote({ dstAmount: "100" })).toBe(false);
    });

    it("should reject Quote with wrong types", () => {
      expect(
        isQuote({
          dstAmount: 100,
          solver: "addr",
          fillTimeSeconds: "30",
          priceImpactPct: 0.5,
          protocolFeePct: 0.1,
          rate: "1",
        })
      ).toBe(false);
    });
  });

  describe("isFeedItem", () => {
    it("should validate a correct FeedItem", () => {
      const valid = {
        id: "intent-123",
        srcChain: "stellar",
        srcToken: "USDC",
        srcAmount: "100",
        dstToken: "BTC",
        solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323",
        status: "pending" as const,
        createdAt: "2024-01-01T00:00:00Z",
      };
      expect(isFeedItem(valid)).toBe(true);
    });

    it("should validate FeedItem with optional deadline", () => {
      const valid = {
        id: "intent-123",
        srcChain: "stellar",
        srcToken: "USDC",
        srcAmount: "100",
        dstToken: "BTC",
        solver: "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323",
        status: "accepted" as const,
        createdAt: "2024-01-01T00:00:00Z",
        deadline: "2024-01-02T00:00:00Z",
      };
      expect(isFeedItem(valid)).toBe(true);
    });

    it("should reject FeedItem with invalid status", () => {
      expect(
        isFeedItem({
          id: "intent-123",
          srcChain: "stellar",
          srcToken: "USDC",
          srcAmount: "100",
          dstToken: "BTC",
          solver: "addr",
          status: "unknown",
          createdAt: "2024-01-01T00:00:00Z",
        })
      ).toBe(false);
    });

    it("should reject non-object", () => {
      expect(isFeedItem("not an object")).toBe(false);
      expect(isFeedItem(null)).toBe(false);
      expect(isFeedItem([1, 2, 3])).toBe(false);
    });
  });

  describe("isFeedItemArray", () => {
    it("should validate an array of FeedItems", () => {
      const valid = [
        {
          id: "intent-1",
          srcChain: "stellar",
          srcToken: "USDC",
          srcAmount: "100",
          dstToken: "BTC",
          solver: "addr1",
          status: "pending" as const,
          createdAt: "2024-01-01T00:00:00Z",
        },
        {
          id: "intent-2",
          srcChain: "stellar",
          srcToken: "USDC",
          srcAmount: "200",
          dstToken: "ETH",
          solver: "addr2",
          status: "filled" as const,
          createdAt: "2024-01-02T00:00:00Z",
        },
      ];
      expect(isFeedItemArray(valid)).toBe(true);
    });

    it("should validate an empty array", () => {
      expect(isFeedItemArray([])).toBe(true);
    });

    it("should reject array with invalid item", () => {
      expect(
        isFeedItemArray([
          {
            id: "intent-1",
            srcChain: "stellar",
            srcToken: "USDC",
            srcAmount: "100",
            dstToken: "BTC",
            solver: "addr",
            status: "invalid",
            createdAt: "2024-01-01T00:00:00Z",
          },
        ])
      ).toBe(false);
    });
  });

  describe("isIntentDetail", () => {
    it("should validate a correct IntentDetail", () => {
      const valid = {
        id: "intent-123",
        srcChain: "stellar",
        srcToken: "USDC",
        srcAmount: "100",
        dstToken: "BTC",
        solver: "addr",
        status: "accepted" as const,
        createdAt: "2024-01-01T00:00:00Z",
        deadline: "2024-01-02T00:00:00Z",
        dstAmount: "0.005",
        minOut: "0.004",
        dstAddress: "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323",
      };
      expect(isIntentDetail(valid)).toBe(true);
    });

    it("should validate IntentDetail with optional txHash", () => {
      const valid = {
        id: "intent-123",
        srcChain: "stellar",
        srcToken: "USDC",
        srcAmount: "100",
        dstToken: "BTC",
        solver: "addr",
        status: "filled" as const,
        createdAt: "2024-01-01T00:00:00Z",
        deadline: "2024-01-02T00:00:00Z",
        dstAmount: "0.005",
        minOut: "0.004",
        dstAddress: "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323",
        txHash: "abc123def456",
      };
      expect(isIntentDetail(valid)).toBe(true);
    });

    it("should reject IntentDetail with missing required fields", () => {
      expect(
        isIntentDetail({
          id: "intent-123",
          srcChain: "stellar",
          srcToken: "USDC",
          srcAmount: "100",
          dstToken: "BTC",
          solver: "addr",
          status: "filled" as const,
          createdAt: "2024-01-01T00:00:00Z",
          deadline: "2024-01-02T00:00:00Z",
          dstAmount: "0.005",
        })
      ).toBe(false);
    });
  });

  describe("isSolver", () => {
    it("should validate a correct Solver", () => {
      const valid = {
        name: "SolverOne",
        address: "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323",
        bondUsd: 1000,
        fills: 100,
        failed: 5,
        volumeUsd: 50000,
        avgFillTimeSeconds: 30,
        successRatePct: 95,
        chains: ["stellar", "ethereum"],
        status: "active" as const,
      };
      expect(isSolver(valid)).toBe(true);
    });

    it("should reject Solver with invalid status", () => {
      expect(
        isSolver({
          name: "SolverOne",
          address: "addr",
          bondUsd: 1000,
          fills: 100,
          failed: 5,
          volumeUsd: 50000,
          avgFillTimeSeconds: 30,
          successRatePct: 95,
          chains: ["stellar"],
          status: "unknown",
        })
      ).toBe(false);
    });

    it("should reject Solver with non-array chains", () => {
      expect(
        isSolver({
          name: "SolverOne",
          address: "addr",
          bondUsd: 1000,
          fills: 100,
          failed: 5,
          volumeUsd: 50000,
          avgFillTimeSeconds: 30,
          successRatePct: 95,
          chains: "stellar",
          status: "active",
        })
      ).toBe(false);
    });
  });

  describe("isSolverArray", () => {
    it("should validate an array of Solvers", () => {
      const valid = [
        {
          name: "Solver1",
          address: "addr1",
          bondUsd: 1000,
          fills: 100,
          failed: 5,
          volumeUsd: 50000,
          avgFillTimeSeconds: 30,
          successRatePct: 95,
          chains: ["stellar"],
          status: "active" as const,
        },
        {
          name: "Solver2",
          address: "addr2",
          bondUsd: 2000,
          fills: 200,
          failed: 10,
          volumeUsd: 100000,
          avgFillTimeSeconds: 25,
          successRatePct: 98,
          chains: ["stellar", "ethereum"],
          status: "inactive" as const,
        },
      ];
      expect(isSolverArray(valid)).toBe(true);
    });

    it("should validate an empty array", () => {
      expect(isSolverArray([])).toBe(true);
    });

    it("should reject array with invalid item", () => {
      expect(
        isSolverArray([
          {
            name: "Solver1",
            address: "addr1",
            bondUsd: "not a number",
            fills: 100,
            failed: 5,
            volumeUsd: 50000,
            avgFillTimeSeconds: 30,
            successRatePct: 95,
            chains: ["stellar"],
            status: "active",
          },
        ])
      ).toBe(false);
    });
  });

  describe("isCreateIntentResponse", () => {
    it("should validate a correct CreateIntentResponse", () => {
      const valid = {
        intentId: "intent-123",
        unsignedXdr: "AAAAAgAAAAB+Aut...",
      };
      expect(isCreateIntentResponse(valid)).toBe(true);
    });

    it("should reject with missing fields", () => {
      expect(isCreateIntentResponse({ intentId: "intent-123" })).toBe(false);
    });

    it("should reject with wrong types", () => {
      expect(
        isCreateIntentResponse({
          intentId: 123,
          unsignedXdr: "xdr",
        })
      ).toBe(false);
    });
  });

  describe("isSubmitIntentResponse", () => {
    it("should validate a correct SubmitIntentResponse", () => {
      const valid = {
        intentId: "intent-123",
        status: "pending" as const,
      };
      expect(isSubmitIntentResponse(valid)).toBe(true);
    });

    it("should reject with invalid status", () => {
      expect(
        isSubmitIntentResponse({
          intentId: "intent-123",
          status: "unknown",
        })
      ).toBe(false);
    });
  });

  describe("isRegisterSolverResponse", () => {
    it("should validate a correct RegisterSolverResponse", () => {
      const valid = {
        registrationId: "reg-123",
        unsignedXdr: "AAAAAgAAAAB+Aut...",
      };
      expect(isRegisterSolverResponse(valid)).toBe(true);
    });

    it("should reject with missing fields", () => {
      expect(isRegisterSolverResponse({ registrationId: "reg-123" })).toBe(false);
    });
  });

  describe("isSubmitRegistrationResponse", () => {
    it("should validate a correct SubmitRegistrationResponse", () => {
      const valid = {
        registrationId: "reg-123",
        status: "active" as const,
      };
      expect(isSubmitRegistrationResponse(valid)).toBe(true);
    });

    it("should validate with pending status", () => {
      const valid = {
        registrationId: "reg-123",
        status: "pending" as const,
      };
      expect(isSubmitRegistrationResponse(valid)).toBe(true);
    });

    it("should reject with invalid status", () => {
      expect(
        isSubmitRegistrationResponse({
          registrationId: "reg-123",
          status: "unknown",
        })
      ).toBe(false);
    });
  });
});
