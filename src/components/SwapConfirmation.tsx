"use client";

import { useEffect, useRef, useState } from "react";
import { SolverBadge } from "@/components/SolverBadge";
import { formatTokenAmount } from "@/lib/format";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { Quote, Token } from "@/lib/types";
import { computeMinOut } from "@/lib/slippage";

// Warn when the quote has this many seconds (or fewer) left before it expires.
export const QUOTE_NEAR_EXPIRY_SECONDS = 10;

const KNOWN_DESTINATIONS_KEY = "vortex.knownDestinations";
const FOCUSABLE_SELECTOR =
  "button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])";

function readKnownDestinations(): string[] {
  try {
    const raw = window.localStorage.getItem(KNOWN_DESTINATIONS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function rememberDestination(address: string) {
  try {
    const known = readKnownDestinations();
    if (known.includes(address)) return;
    window.localStorage.setItem(KNOWN_DESTINATIONS_KEY, JSON.stringify([...known, address].slice(-50)));
  } catch {
    // localStorage may be unavailable (private browsing, quota) — fail silently.
  }
}

/** Minimum received for a quote after applying the user's slippage tolerance. */
// Same precision-safe, round-down floor the swap is submitted with (#418).
export function computeMinReceived(quote: Quote, slippagePct: number, decimals: number): string {
  return computeMinOut(quote.dstAmount, slippagePct, decimals);
}

export type SwapConfirmationProps = {
  /** Latest quote from useQuote; the panel freezes the one it opened with. */
  quote: Quote;
  srcChainName: string;
  srcAmount: string;
  srcToken: Token;
  dstToken: Token;
  dstAddress: string;
  slippagePct: number;
  highPriceImpactThresholdPct: number;
  /** Epoch ms when the quote goes stale, or null if unknown. */
  quoteExpiresAt: number | null;
  /** True while a fresh quote is being fetched. */
  isRefreshing: boolean;
  /** From solverVerification; undefined while the registry is still loading. */
  solverVerified?: boolean | undefined;
  solverDisplayName?: string | undefined;
  onConfirm: (confirmed: { quote: Quote; minOut: string }) => void;
  onCancel: () => void;
};

/**
 * Pre-sign review step (#419): summarises pay/receive, minimum received, rate,
 * fees, solver and timing before the wallet is asked to sign. Rendered as a
 * bottom sheet on mobile and a centred modal from `md` up. Dismissing it has no
 * side effects; focus is trapped while open and restored on close.
 */
export function SwapConfirmation({
  quote,
  srcChainName,
  srcAmount,
  srcToken,
  dstToken,
  dstAddress,
  slippagePct,
  highPriceImpactThresholdPct,
  quoteExpiresAt,
  isRefreshing,
  solverVerified,
  solverDisplayName,
  onConfirm,
  onCancel,
}: SwapConfirmationProps) {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDivElement>(null);

  // Freeze the quote the user is reviewing; a newer one is only adopted on
  // explicit acceptance so the numbers never change under the user's cursor.
  const [shownQuote, setShownQuote] = useState(quote);
  const priceChanged = quote !== shownQuote &&
    (quote.dstAmount !== shownQuote.dstAmount || quote.rate !== shownQuote.rate ||
      quote.priceImpactPct !== shownQuote.priceImpactPct || quote.protocolFeePct !== shownQuote.protocolFeePct ||
      quote.solver !== shownQuote.solver);

  const [isFirstTimeDestination] = useState(
    () => Boolean(dstAddress) && !readKnownDestinations().includes(dstAddress),
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (quoteExpiresAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quoteExpiresAt]);
  const secondsLeft = quoteExpiresAt === null ? null : Math.max(0, Math.ceil((quoteExpiresAt - now) / 1000));
  const isExpired = secondsLeft === 0;

  // Focus trap + Escape to dismiss; focus returns to the opener on unmount.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  const dstDigits = dstToken.symbol === "XLM" ? 2 : 4;
  const fmt = (n: number) => formatTokenAmount(n, undefined, { maximumFractionDigits: dstDigits });
  const usd = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const receiveAmount = parseFloat(shownQuote.dstAmount) || 0;
  const minOut = computeMinReceived(shownQuote, slippagePct, dstToken.decimals);
  const payUsd = (parseFloat(srcAmount) || 0) * srcToken.priceUsd;

  const hasHighPriceImpact = shownQuote.priceImpactPct >= highPriceImpactThresholdPct;
  const nearExpiry = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= QUOTE_NEAR_EXPIRY_SECONDS;
  const isUnverified = solverVerified === false;
  const confirmDisabled = isRefreshing || isExpired || priceChanged;

  const rows: Array<[string, string, boolean?]> = [
    [t("swap.confirm.pay"), `${srcAmount} ${srcToken.symbol} (≈ $${usd(payUsd)})`],
    [t("swap.confirm.receive"), `${fmt(receiveAmount)} ${dstToken.symbol} (≈ $${usd(receiveAmount * dstToken.priceUsd)})`],
    [t("swap.confirm.minReceived"), `${minOut} ${dstToken.symbol} (≈ $${usd(parseFloat(minOut) * dstToken.priceUsd)})`],
    [t("swap.confirm.route"), `${srcChainName} → Stellar`],
    [t("swap.quote.rate"), shownQuote.rate],
    [
      t("swap.quote.priceImpact"),
      t("swap.quote.priceImpactValue", {
        percent: shownQuote.priceImpactPct < 0.01 ? t("swap.quote.priceImpactBelowMin") : shownQuote.priceImpactPct.toFixed(2),
      }),
      hasHighPriceImpact,
    ],
    [t("swap.quote.protocolFee"), t("swap.quote.protocolFeeValue", { percent: shownQuote.protocolFeePct.toFixed(2) })],
    [t("swap.confirm.slippage"), `${slippagePct}%`],
    [t("swap.quote.fillTime"), t("swap.quote.fillTimeValue", { seconds: shownQuote.fillTimeSeconds })],
    [t("swap.destination.label"), dstAddress || "—"],
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end md:items-center justify-center bg-black/60 animate-fade-up">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="swap-confirmation-title"
        className="w-full md:max-w-md max-h-[90vh] overflow-y-auto bg-vx-card border border-vx-border rounded-t-2xl md:rounded-2xl p-5 space-y-4 shadow-2xl"
      >
        <h2 id="swap-confirmation-title" className="text-base font-semibold text-vx-text">
          {t("swap.confirm.title")}
        </h2>

        <dl className="space-y-2">
          {rows.map(([label, value, warn]) => (
            <div key={label} className="flex items-start justify-between gap-3">
              <dt className="text-xs text-vx-muted flex-shrink-0">{label}</dt>
              <dd className={`num text-xs font-medium text-end break-all ${warn ? "text-amber-300" : "text-vx-text"}`}>
                {value}
              </dd>
            </div>
          ))}
          <div className="flex items-start justify-between gap-3">
            <dt className="text-xs text-vx-muted flex-shrink-0">{t("swap.quote.solver")}</dt>
            <dd className="min-w-0 text-end break-all">
              <SolverBadge
                solverAddress={shownQuote.solver}
                isVerified={solverVerified !== false}
                displayName={solverDisplayName ?? shownQuote.solver}
                showWarning={false}
              />
            </dd>
          </div>
        </dl>

        <div className="space-y-1.5">
          {hasHighPriceImpact && (
            <p role="alert" className="text-xs text-amber-300">
              {t("swap.quote.highPriceImpactWarning", { threshold: highPriceImpactThresholdPct })}
            </p>
          )}
          {nearExpiry && (
            <p role="status" className="text-xs text-amber-300">
              {t("swap.confirm.nearExpiry", { seconds: secondsLeft })}
            </p>
          )}
          {isExpired && (
            <p role="alert" className="text-xs text-amber-300">{t("swap.confirm.expired")}</p>
          )}
          {isUnverified && (
            <p role="alert" className="text-xs text-amber-300">{t("swap.confirm.unverifiedSolver")}</p>
          )}
          {isFirstTimeDestination && (
            <p role="status" className="text-xs text-amber-300">{t("swap.confirm.newDestination")}</p>
          )}
          {priceChanged && (
            <div className="flex items-center justify-between gap-2">
              <p role="alert" className="text-xs text-amber-300">{t("swap.confirm.priceChanged")}</p>
              <button
                type="button"
                onClick={() => setShownQuote(quote)}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-vx-sage/30 bg-vx-sage-bg text-vx-sage hover:bg-vx-sage/15 transition-colors"
              >
                {t("swap.confirm.acceptNewPrice")}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse md:flex-row gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-vx-border text-vx-muted hover:text-vx-text transition-colors"
          >
            {t("swap.confirm.cancel")}
          </button>
          <button
            type="button"
            className="btn-swap flex-1"
            disabled={confirmDisabled}
            aria-busy={isRefreshing}
            onClick={() => {
              if (dstAddress) rememberDestination(dstAddress);
              onConfirm({ quote: shownQuote, minOut });
            }}
          >
            {isRefreshing
              ? t("swap.confirm.refreshing")
              : secondsLeft !== null
                ? t("swap.confirm.ctaWithSeconds", { seconds: secondsLeft })
                : t("swap.confirm.cta")}
          </button>
        </div>
      </div>
    </div>
  );
}
