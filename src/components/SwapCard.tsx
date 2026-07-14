"use client";

import { useState } from "react";
import { useQuote } from "@/hooks/useQuote";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CHAINS, SRC_TOKENS, DST_TOKENS } from "@/lib/marketData";

export function SwapCard() {
  const [srcChain, setSrcChain] = useState("ethereum");
  const [srcToken, setSrcToken] = useState(SRC_TOKENS["ethereum"][0]);
  const [dstToken, setDstToken] = useState(DST_TOKENS[0]);
  const [srcAmount, setSrcAmount] = useState("");
  const [showChainPicker, setShowChainPicker] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);

  const chain = CHAINS.find(c => c.id === srcChain)!;

  const debouncedAmount = useDebouncedValue(srcAmount, 500);
  const hasAmount = Boolean(debouncedAmount) && parseFloat(debouncedAmount) > 0;
  const { quote, isLoading: quoting, error: quoteError } = useQuote(
    hasAmount
      ? { srcChain, srcToken: srcToken.symbol, srcAmount: debouncedAmount, dstToken: dstToken.symbol }
      : null
  );

  const dstAmount = quote
    ? parseFloat(quote.dstAmount)
    : srcAmount
      ? (parseFloat(srcAmount) * srcToken.priceUSD) / dstToken.priceUSD * 0.998
      : 0;

  const srcValueUSD = srcAmount ? parseFloat(srcAmount) * srcToken.priceUSD : 0;
  const canSwap = srcAmount && parseFloat(srcAmount) > 0 && !quoting;

  return (
    <div className="relative">
      {/* Chain picker dropdown */}
      {showChainPicker && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-vx-card border border-vx-border rounded-xl p-3 shadow-2xl animate-fade-up">
          <div className="eyebrow mb-3 px-1">Select source chain</div>
          <div className="grid grid-cols-2 gap-2">
            {CHAINS.map(c => (
              <button
                key={c.id}
                onClick={() => {
                  setSrcChain(c.id);
                  setSrcToken(SRC_TOKENS[c.id][0]);
                  setShowChainPicker(false);
                }}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all
                  ${srcChain === c.id
                    ? "border-vx-sage/40 bg-vx-sage-bg text-vx-sage"
                    : "border-vx-border hover:border-vx-border text-vx-muted hover:text-vx-text bg-vx-surface/50"
                  }`}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: c.color }}
                />
                <span className="text-sm font-medium">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main card */}
      <div className={`card p-5 space-y-2 ${showChainPicker ? "opacity-0 pointer-events-none" : ""}`}>

        {/* ── From ── */}
        <div className="bg-vx-surface/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">From</span>
            <button
              onClick={() => setShowChainPicker(true)}
              className="chain-badge cursor-pointer hover:bg-vx-lav/15 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: chain.color }} />
              {chain.name}
              <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              value={srcAmount}
              onChange={e => setSrcAmount(e.target.value)}
              placeholder="0"
              className="input-swap flex-1"
            />
            <div className="token-btn" onClick={() => setShowTokenPicker(!showTokenPicker)}>
              <div className="w-6 h-6 rounded-full bg-vx-lav/20 flex items-center justify-center text-xs font-bold text-vx-lav">
                {srcToken.symbol[0]}
              </div>
              <span className="font-semibold text-sm text-vx-text">{srcToken.symbol}</span>
              <svg className="w-3.5 h-3.5 text-vx-muted" viewBox="0 0 14 14" fill="none">
                <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {showTokenPicker && (
            <div className="pt-2 border-t border-vx-line space-y-1">
              {SRC_TOKENS[srcChain].map(t => (
                <button
                  key={t.symbol}
                  onClick={() => { setSrcToken(t); setShowTokenPicker(false); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors
                    ${t.symbol === srcToken.symbol ? "bg-vx-lav-bg text-vx-lav" : "hover:bg-vx-surface text-vx-muted hover:text-vx-text"}`}
                >
                  <span className="font-medium">{t.symbol}</span>
                  <span className="num text-xs">${t.priceUSD.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}

          {srcValueUSD > 0 && (
            <div className="num text-xs text-vx-muted">
              ≈ ${srcValueUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
          )}
        </div>

        {/* Swap direction arrow */}
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full bg-vx-surface border border-vx-border flex items-center justify-center z-10">
            <svg className="w-4 h-4 text-vx-sage" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ── To (always Stellar) ── */}
        <div className="bg-vx-surface/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">To</span>
            <span className="stellar-badge">
              <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
                <circle cx="5" cy="5" r="2" />
              </svg>
              Stellar
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              {quoting ? (
                <div className="h-9 flex items-center">
                  <div className="w-24 h-6 bg-vx-surface rounded animate-pulse" />
                </div>
              ) : (
                <div className="text-3xl font-light text-vx-text num">
                  {dstAmount > 0 ? dstAmount.toFixed(dstToken.symbol === "XLM" ? 2 : 4) : "0"}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {DST_TOKENS.map(t => (
                <button
                  key={t.symbol}
                  onClick={() => setDstToken(t)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${dstToken.symbol === t.symbol
                      ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                      : "border-vx-border text-vx-muted hover:text-vx-text"
                    }`}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Quote details */}
        {quote && srcAmount && (
          <div className="bg-vx-surface/40 rounded-xl p-3.5 space-y-2.5 animate-fade-up">
            {[
              ["Best solver",      quote.solver],
              ["Est. fill time",   `~${quote.fillTimeSeconds}s`],
              ["Price impact",     `${quote.priceImpactPct < 0.01 ? "<0.01" : quote.priceImpactPct.toFixed(2)}%`],
              ["Protocol fee",     `${quote.protocolFeePct.toFixed(2)}%`],
              ["Rate",             quote.rate],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-xs text-vx-muted">{k}</span>
                <span className="num text-xs text-vx-text font-medium">{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quote error — falls back to an estimated rate above */}
        {quoteError && hasAmount && !quoting && (
          <p className="text-center text-[11px] text-amber-400/90 px-1">
            Live quote unavailable — showing an estimated rate.
          </p>
        )}

        {/* Submit */}
        <button className="btn-swap" disabled={!canSwap}>
          {quoting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin-slow" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
              </svg>
              Finding best route…
            </span>
          ) : canSwap ? (
            `Swap ${srcAmount} ${srcToken.symbol} → ${dstToken.symbol}`
          ) : (
            "Enter an amount"
          )}
        </button>

        <p className="text-center text-[11px] text-vx-muted/70">
          Swap settles directly on Stellar · No wrapped tokens · Protected by solver bonds
        </p>
      </div>
    </div>
  );
}
