import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { useQuote } from "./useQuote";
import type { Quote } from "@/lib/types";

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
);

describe("useQuote", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not fetch when params are null", () => {
    renderHook(() => useQuote(null), { wrapper });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not fetch when the amount is zero or missing", () => {
    renderHook(
      () => useQuote({ srcChain: "ethereum", srcToken: "USDC", srcAmount: "0", dstToken: "XLM" }),
      { wrapper }
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches a quote once a positive amount is provided", async () => {
    const quote: Quote = {
      dstAmount: "497.12",
      solver: "Beta Liquidity Co",
      fillTimeSeconds: 32,
      priceImpactPct: 0.05,
      protocolFeePct: 0.05,
      rate: "1 USDC = 8.46 XLM",
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => quote,
    });

    const { result } = renderHook(
      () => useQuote({ srcChain: "ethereum", srcToken: "USDC", srcAmount: "500", dstToken: "XLM" }),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.quote).toEqual(quote);
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/quote?srcChain=ethereum&srcToken=USDC&srcAmount=500&dstToken=XLM"),
      expect.anything()
    );
  });
});
