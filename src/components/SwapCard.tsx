"use client";

import { useEffect, useState } from "react";
import { useQuote } from "@/hooks/useQuote";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSwapSubmission } from "@/hooks/useSwapSubmission";
import { useToastStore } from "@/store/toast";
import { CHAINS, SRC_TOKENS, DST_TOKENS } from "@/lib/marketData";
import { formatCurrency, formatTokenAmount } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { Combobox } from "@/components/Combobox";
import type { MessageKey } from "@/lib/i18n";
import type { Quote, QuoteRequest } from "@/lib/types";

export const DEFAULT_SLIPPAGE_PCT = 0.5;
export const HIGH_PRICE_IMPACT_THRESHOLD_PCT = 3;
export const SLIPPAGE_PRESETS_PCT = [0.5, 1, 3];
export const STALE_QUOTE_THRESHOLD_MS = 25_000;

const SUBMISSION_LABEL_KEY: Record<string, MessageKey> = {
  connecting: "swap.submit.connecting",
  building: "swap.submit.building",
  "awaiting-signature": "swap.submit.awaitingSignature",
  submitting: "swap.submit.submitting",
};

export type SwapCardProps = {
  initialAmount?: string;
  previewQuote?: Quote;
  onPreviewSubmit?: (request: QuoteRequest) => void;
};

export function SwapCard({
  initialAmount = "",
  previewQuote,
  onPreviewSubmit,
}: SwapCardProps = {}) {
  const { t } = useTranslation();

  const [srcChain, setSrcChain] = useState("ethereum");
  const [srcToken, setSrcToken] = useState(SRC_TOKENS["ethereum"][0]);
  const [dstToken, setDstToken] = useState(DST_TOKENS[0]);
  const [srcAmount, setSrcAmount] = useState(initialAmount);
  const [dstAddress, setDstAddress] = useState("");
  const [slippagePct, setSlippagePct] = useState(String(DEFAULT_SLIPPAGE_PCT));

  const chain = CHAINS.find(c => c.id === srcChain)!;

  const debouncedAmount = useDebouncedValue(srcAmount, 500);
  const hasAmount = Boolean(debouncedAmount) && parseFloat(debouncedAmount) > 0;
  const {
    quote: fetchedQuote,
    quoteFetchedAt,
    isLoading: quoteIsLoading,
    error: quoteError,
    errorType: quoteErrorType,
    refresh: refreshQuote,
  } = useQuote(
    hasAmount && !previewQuote
      ? { srcChain, srcToken: srcToken.symbol, srcAmount: debouncedAmount, dstToken: dstToken.symbol }
      : null
  );
  const quote = previewQuote ?? fetchedQuote;
  const quoting = previewQuote ? false : quoteIsLoading;

  // Re-render once a second so the stale-quote countdown/expiry stays accurate,
  // but stop ticking while the tab is hidden to avoid wasted work in the background.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!quoteFetchedAt || previewQuote) return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(() => {
      if (!document.hidden) tick();
    }, 1000);
    const onVisibilityChange = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [quoteFetchedAt, previewQuote]);

  const quoteAgeMs = quoteFetchedAt ? now - quoteFetchedAt : 0;
  const quoteIsStale = Boolean(quoteFetchedAt) && quoteAgeMs >= STALE_QUOTE_THRESHOLD_MS;
  const quoteExpiresInSeconds = quoteFetchedAt
    ? Math.max(0, Math.ceil((STALE_QUOTE_THRESHOLD_MS - quoteAgeMs) / 1000))
    : null;

  const dstAddressError = dstAddress && !isValidStellarPublicKey(dstAddress)
    ? t("swap.destination.invalidAddress")
    : null;

  const dstAmount = quote
    ? parseFloat(quote.dstAmount)
    : srcAmount
      ? (parseFloat(srcAmount) * srcToken.priceUSD) / dstToken.priceUSD * 0.998
      : 0;

  const srcValueUSD = srcAmount ? parseFloat(srcAmount) * srcToken.priceUSD : 0;
  const parsedSlippagePct = Math.max(0, Math.min(50, parseFloat(slippagePct) || 0));
  const minOut = dstAmount > 0
    ? (dstAmount * (1 - parsedSlippagePct / 100)).toFixed(dstToken.symbol === "XLM" ? 2 : 4)
    : "0";
  const hasHighPriceImpact = quote
    ? quote.priceImpactPct > HIGH_PRICE_IMPACT_THRESHOLD_PCT
    : false;

  const submission = useSwapSubmission();
  const isSubmitting = submission.status in SUBMISSION_LABEL_KEY;
  const canSwap = Boolean(srcAmount) && parseFloat(srcAmount) > 0 && !quoting && !isSubmitting && !dstAddressError && !quoteIsStale;

  /** Truncate a raw amount string to at most `decimals` decimal places. */
  function truncateToDecimals(value: string, decimals: number): string {
    const dotIndex = value.indexOf(".");
    if (dotIndex === -1 || decimals === 0) return value.split(".")[0];
    return value.slice(0, dotIndex + 1 + decimals);
  }

  const handleAmountChange = (raw: string) => {
    setSrcAmount(truncateToDecimals(raw, srcToken.decimals));
  };

  const handleSubmit = () => {
    if (onPreviewSubmit) {
      onPreviewSubmit({
        srcChain,
        srcToken: srcToken.symbol,
        srcAmount,
        dstToken: dstToken.symbol,
      });
      return;
    }
    if (submission.status === "success") {
      submission.reset();
      setSrcAmount("");
      return;
    }

    if (quoteIsStale) {
      useToastStore.getState().addToast(t("swap.quote.staleWarning"), "error");
      return;
    }

    submission.submit({ srcChain, srcToken: srcToken.symbol, srcAmount, dstToken: dstToken.symbol, minOut });
  };

  const chainItems = CHAINS.map(c => ({ ...c, key: c.id, label: c.name }));
  const tokenItems = (SRC_TOKENS[srcChain] ?? []).map(tok => ({ ...tok, key: tok.symbol, label: tok.symbol }));

  return (
    <div className="relative">
      <div className="card p-5 space-y-2">

        {/* ── From ── */}
        <div className="bg-vx-surface/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{t("swap.from.label")}</span>
            <Combobox
              items={chainItems}
              value={{ ...chain, key: chain.id, label: chain.name }}
              onChange={(item) => {
                setSrcChain(item.id);
                setSrcToken(SRC_TOKENS[item.id][0]);
              }}
              ariaLabel={t("swap.chainPicker.title")}
              triggerAriaLabel={t("swap.from.selectChain", { name: chain.name })}
              noMatchesLabel={t("swap.chainPicker.title")}
              triggerClassName="chain-badge cursor-pointer hover:bg-vx-lav/15 transition-colors"
              renderTrigger={(item) => (
                <>
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: item.color }} />
                  {item.name}
                  <svg aria-hidden="true" className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </>
              )}
              renderOption={(item, { selected }) => (
                <div
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium
                    ${selected ? "text-vx-sage" : "text-vx-muted"}`}
                >
                  <span aria-hidden="true" className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  {item.name}
                </div>
              )}
            />
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="src-amount" className="sr-only">{t("swap.from.amountLabel")}</label>
            <input
              id="src-amount"
              type="number"
              value={srcAmount}
              onChange={e => handleAmountChange(e.target.value)}
              placeholder={t("swap.from.amountPlaceholder")}
              className="input-swap flex-1"
            />
            <Combobox
              items={tokenItems}
              value={{ ...srcToken, key: srcToken.symbol, label: srcToken.symbol }}
              onChange={(item) => setSrcToken(item)}
              ariaLabel={t("swap.from.selectToken", { symbol: srcToken.symbol })}
              noMatchesLabel={t("swap.from.selectToken", { symbol: srcToken.symbol })}
              triggerClassName="token-btn"
              renderTrigger={(item) => (
                <>
                  <span aria-hidden="true" className="w-6 h-6 rounded-full bg-vx-lav/20 flex items-center justify-center text-xs font-bold text-vx-lav">
                    {item.symbol[0]}
                  </span>
                  <span className="font-semibold text-sm text-vx-text">{item.symbol}</span>
                  <svg aria-hidden="true" className="w-3.5 h-3.5 text-vx-muted" viewBox="0 0 14 14" fill="none">
                    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </>
              )}
              renderOption={(item, { selected }) => (
                <div
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm
                    ${selected ? "bg-vx-lav-bg text-vx-lav" : "text-vx-muted"}`}
                >
                  <span className="font-medium">{item.symbol}</span>
                  <span className="num text-xs">${item.priceUSD.toLocaleString()}</span>
                </div>
              )}
            />
          </div>

          {srcValueUSD > 0 && (
            <div className="num text-xs text-vx-muted">
              {/* Number formatting stays locale-hardcoded here; issue #63 owns making it locale-aware. */}
              {t("swap.from.approxValue", {
                value: srcValueUSD.toLocaleString("en-US", { maximumFractionDigits: 2 }),
              })}
            </div>
          )}
        </div>

        {/* Swap direction arrow */}
        <div className="flex justify-center">
          <div aria-hidden="true" className="w-8 h-8 rounded-full bg-vx-surface border border-vx-border flex items-center justify-center z-10">
            <svg className="w-4 h-4 text-vx-sage" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M5 10l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* ── To (always Stellar) ── */}
        <div className="bg-vx-surface/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{t("swap.to.label")}</span>
            <span className="stellar-badge">
              <svg aria-hidden="true" className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="currentColor">
                <circle cx="5" cy="5" r="2" />
              </svg>
              Stellar
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              {quoting ? (
                <div className="h-9 flex items-center">
                  <div aria-hidden="true" className="w-24 h-6 bg-vx-surface rounded animate-pulse" />
                  <span className="sr-only">{t("swap.to.quoteLoading")}</span>
                </div>
              ) : (
                <div className="text-3xl font-light text-vx-text num">
                  {dstAmount > 0
                    ? formatTokenAmount(dstAmount, undefined, {
                        maximumFractionDigits: dstToken.symbol === "XLM" ? 2 : 4,
                      })
                    : "0"}
                </div>
              )}
            </div>
            <div role="group" aria-label={t("swap.to.tokenGroup")} className="flex gap-2">
              {DST_TOKENS.map(token => (
                <button
                  key={token.symbol}
                  type="button"
                  onClick={() => setDstToken(token)}
                  aria-pressed={dstToken.symbol === token.symbol}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all
                    ${dstToken.symbol === token.symbol
                      ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                      : "border-vx-border text-vx-muted hover:text-vx-text"
                    }`}
                >
                  {token.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Destination address */}
        <div className="bg-vx-surface/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{t("swap.destination.label")}</span>
          </div>
          <label htmlFor="dst-address" className="sr-only">{t("swap.destination.label")}</label>
          <input
            id="dst-address"
            type="text"
            value={dstAddress}
            onChange={e => setDstAddress(e.target.value.trim())}
            placeholder={t("swap.destination.placeholder")}
            aria-invalid={Boolean(dstAddressError)}
            aria-describedby={dstAddressError ? "dst-address-error" : undefined}
            className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:border-vx-sage/50 transition-colors"
          />
          {dstAddressError && (
            <p id="dst-address-error" role="alert" className="text-[11px] text-red-400">{dstAddressError}</p>
          )}
        </div>

        {/* Slippage tolerance */}
        <div className="bg-vx-surface/50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="eyebrow">{t("swap.slippage.label")}</span>
            <span className="num text-xs text-vx-muted">
              {t("swap.slippage.minOut", { amount: minOut, token: dstToken.symbol })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {SLIPPAGE_PRESETS_PCT.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setSlippagePct(String(preset))}
                aria-pressed={parseFloat(slippagePct) === preset}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all
                  ${parseFloat(slippagePct) === preset
                    ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                    : "border-vx-border text-vx-muted hover:text-vx-text"
                  }`}
              >
                {preset}%
              </button>
            ))}
            <label htmlFor="slippage-custom" className="sr-only">{t("swap.slippage.inputLabel")}</label>
            <input
              id="slippage-custom"
              type="number"
              min={0}
              max={50}
              step={0.1}
              value={slippagePct}
              onChange={e => setSlippagePct(e.target.value)}
              className="w-16 bg-vx-surface border border-vx-border rounded-lg px-2 py-1.5 text-xs text-vx-text text-right focus:outline-none focus:border-vx-sage/50 transition-colors"
            />
          </div>
          {parsedSlippagePct === 0 && (
            <p role="alert" className="text-[11px] text-amber-300">{t("swap.slippage.zeroWarning")}</p>
          )}
        </div>

        {/* Quote details */}
        {quote && srcAmount && (
          <div
            className={`rounded-xl p-3.5 space-y-2.5 animate-fade-up border ${
              hasHighPriceImpact
                ? "bg-amber-500/10 border-amber-400/30"
                : "bg-vx-surface/40 border-transparent"
            }`}
          >
            {([
              ["swap.quote.solver",       quote.solver],
              ["swap.quote.fillTime",     t("swap.quote.fillTimeValue", { seconds: quote.fillTimeSeconds })],
              ["swap.quote.priceImpact",  t("swap.quote.priceImpactValue", {
                                            percent: quote.priceImpactPct < 0.01
                                              ? t("swap.quote.priceImpactBelowMin")
                                              : quote.priceImpactPct.toFixed(2),
                                          })],
              ["swap.quote.protocolFee",  t("swap.quote.protocolFeeValue", { percent: quote.protocolFeePct.toFixed(2) })],
              ["swap.quote.rate",         quote.rate],
            ] as const).map(([labelKey, value]) => (
              <div key={labelKey} className="flex items-center justify-between">
                <span className="text-xs text-vx-muted">{t(labelKey)}</span>
                <span
                  className={`num text-xs font-medium ${
                    labelKey === "swap.quote.priceImpact" && hasHighPriceImpact
                      ? "text-amber-300"
                      : "text-vx-text"
                  }`}
                >
                  {value}
                </span>
              </div>
            ))}
            {hasHighPriceImpact && (
              <p role="alert" className="text-xs text-amber-300">
                {t("swap.quote.highPriceImpactWarning", {
                  threshold: HIGH_PRICE_IMPACT_THRESHOLD_PCT,
                })}
              </p>
            )}
            {quoteFetchedAt && !quoteIsStale && quoteExpiresInSeconds !== null && quoteExpiresInSeconds <= 5 && (
              <p role="status" className="text-xs text-amber-300">
                {t("swap.quote.expiresIn", { seconds: quoteExpiresInSeconds })}
              </p>
            )}
            {quoteIsStale && (
              <div className="flex items-center justify-between gap-2">
                <p role="alert" className="text-xs text-amber-300">{t("swap.quote.expired")}</p>
                <button
                  type="button"
                  onClick={() => refreshQuote()}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-vx-sage/30 bg-vx-sage-bg text-vx-sage hover:bg-vx-sage/15 transition-colors"
                >
                  {t("swap.quote.refreshCta")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quote error — falls back to an estimated rate above */}
        {quoteError && hasAmount && !quoting && (
          <p role="status" className="text-center text-[11px] text-amber-400/90 px-1">
            {quoteErrorType?.kind === "no-solver"
              ? t("swap.quote.noSolver")
              : t("swap.quote.unavailable")}
          </p>
        )}

        {/* Submission error */}
        {submission.status === "error" && (
          <p role="alert" className="text-center text-[11px] text-red-400 px-1">{submission.error}</p>
        )}

        {/* Submit */}
        <button
          type="button"
          className="btn-swap"
          disabled={!canSwap && submission.status !== "success"}
          aria-busy={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg aria-hidden="true" className="w-4 h-4 animate-spin-slow" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
              </svg>
              {t(SUBMISSION_LABEL_KEY[submission.status]!)}
            </span>
          ) : submission.status === "success" ? (
            t("swap.submit.success")
          ) : quoting ? (
            <span className="flex items-center justify-center gap-2">
              <svg aria-hidden="true" className="w-4 h-4 animate-spin-slow" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
              </svg>
              {t("swap.submit.findingRoute")}
            </span>
          ) : quoteIsStale ? (
            t("swap.quote.expired")
          ) : canSwap ? (
            t(submission.status === "error" ? "swap.submit.retryCta" : "swap.submit.cta", {
              amount: srcAmount,
              srcToken: srcToken.symbol,
              dstToken: dstToken.symbol,
            })
          ) : (
            t("swap.submit.enterAmount")
          )}
        </button>

        <p className="text-center text-[11px] text-vx-muted/70">
          {t("swap.disclaimer")}
        </p>
      </div>
    </div>
  );
}
