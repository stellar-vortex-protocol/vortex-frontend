"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { IntentTracker } from "@/components/IntentTracker";
import { JsonInspector } from "@/components/JsonInspector";
import { Nav } from "@/components/Nav";
import { SkeletonDetailCard } from "@/components/Skeleton";
import { Timeline } from "@/components/Timeline";
import { useOnChainStatus } from "@/hooks/useOnChainStatus";
import { explorerTransactionUrl } from "@/lib/chain/explorerLinks";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useIntent } from "@/hooks/useIntent";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { explorerUrl } from "@/lib/explorerLinks";
import { buildIntentSummary, intentToJson, redactForExport } from "@/lib/intentExport";
import { isIntentDetail } from "@/lib/schemas";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { buildTimeline } from "@/lib/timeline";
import { timeAgo } from "@/lib/time";
import { truncateAddress } from "@/lib/stellarAddress";
import { pushRecentIntent } from "@/lib/commands/recents";

const NETWORK = process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet";

const truncate = (value: string) => truncateAddress(value, { prefix: 6, suffix: 6 });

function deadlineLabel(deadline: string) {
  const msRemaining = new Date(deadline).getTime() - Date.now();
  if (msRemaining <= 0) retu
import { timeAgo } from "@/lib/time";
import { truncateAddress } from "@/lib/stellarAddress";
import { pushRecentIntent } from "@/lib/commands/recents";
import { sanitizeDisplayText } from "@/lib/textSafety";

const NETWORK = process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet";

const truncate = (value: string) => truncateAddress(value, { prefix: 6, suffix: 6 });

function deadlineLabel(deadline: string) {
  const msRemaining = new Date(deadline).getTime() - Date.now();
  if (msRemaining <= 0) return "Expired";
  const minutes = Math.floor(msRemaining / 60_000);
  const seconds = Math.floor((msRemaining % 60_000) / 1000);
  return minutes > 0
    ? `${minutes}m ${seconds}s remaining`
    : `${seconds}s remaining`;
}

export default function IntentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { t } = useTranslation();
  const { intent, isLoading, error, isLive } = useIntent(params.id);
  const { copy } = useCopyToClipboard();
  const [txHashCopied, setTxHashCopied] = useState(false);
  const { t } = useTranslation();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const timeline = useMemo(() => (intent ? buildTimeline(intent) : []), [intent]);
  const copyExport = async (text: string) => {
    const ok = await copy(text);
    setCopyStatus(ok ? t("intentDetail.copy.done") : t("intentDetail.copy.failed"));
  };

  // Only record intents that actually resolved, so recents skip deleted ids.
  useEffect(() => {
    if (intent) pushRecentIntent(intent.id);
  }, [intent]);

  const isExpired = useMemo(() => {
    if (!intent || intent.status !== "pending" || !intent.deadline)
      return false;
    return new Date(intent.deadline).getTime() <= Date.now();
  }, [intent]);
  const isSettled = intent?.status === "filled";
  const chainStatus = useOnChainStatus(intent?.txHash);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Intent ${params.id.slice(0, 8)}`} />

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/explore" className="text-xs text-vx-sage hover:underline print:hidden">
            ← Back to explorer
          </Link>
          <div className="flex items-center gap-3">
            {isLive && (
              <span
                aria-label="Live updates active"
                className="print:hidden flex items-center gap-1.5 text-[10px] text-vx-sage"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-vx-sage animate-pulse" aria-hidden="true" />
                Live
              </span>
            )}
            {intent && (
              <button
                type="button"
                onClick={() => window.print()}
                className="print:hidden text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-muted
                           hover:text-vx-text hover:border-vx-sage/40 transition-colors"
              >
                Print / Save as PDF
              </button>
            )}
            {intent?.status === "filled" && (
              <Link
                href={`/explore/${params.id}/receipt`}
                className="print:hidden text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-muted
                            hover:text-vx-text hover:border-vx-sage/40 transition-colors"
              >
                {t("receipt.view")}
              </Link>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="card p-8 space-y-3">
            <div className="h-6 w-2/3 bg-vx-surface rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-vx-surface rounded animate-pulse" />
          </div>
        ) : error ? (
          <div role="alert" className="card p-8 text-center text-sm text-vx-muted">
            Couldn&apos;t find that intent. It may not exist, or the relay is
            unreachable.
          </div>
        ) : !intent ? (
          <div className="card p-8 text-center text-sm text-vx-muted">
            No details found for this intent.
          </div>
        ) : (
          <div id="intent-record" className="card p-6 space-y-6 print:border print:border-black/20 print:shadow-none">
            {/* Print-only header */}
            <div className="hidden print:block border-b border-black/20 pb-3">
              <div className="text-sm font-semibold">Vortex - swap intent record</div>
              <div className="text-xs text-black/60">
                Intent {params.id} · generated {new Date().toLocaleString()}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2">Intent</div>
                <h1 className="text-2xl font-bold text-vx-text num">
                  {intent.srcAmount} {intent.srcToken} → {intent.dstAmount}{" "}
                  {intent.dstToken}
                </h1>
              </div>
              <IntentStatusBadge status={intent.status} verified={chainStatus.state === "confirmed"} />
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <button
                type="button"
                onClick={() => void copyExport(buildIntentSummary(intent))}
                className="text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
              >
                {t("intentDetail.copy.details")}
              </button>
              {isIntentDetail(intent) && (
                <button
                  type="button"
                  onClick={() => void copyExport(intentToJson(intent))}
                  className="text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                >
                  {t("intentDetail.copy.json")}
                </button>
              )}
              <span role="status" aria-live="polite" className="text-xs text-vx-muted">
                {copyStatus}
              </span>
            </div>

            {!isSettled && (
              <p
                role="note"
                className="text-xs rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-300
                           print:border-black/40 print:bg-transparent print:text-black"
              >
                This intent is <strong>{intent.status}</strong> and not yet settled - this is not a
                completed-swap record.
              </p>
            )}

            <div className="print:hidden">
              <IntentTracker intentId={intent.id} hideDetailsLink />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["Source chain", intent.srcChain],
                ["Solver", sanitizeDisplayText(intent.solver)],
                ["Minimum out", `${intent.minOut} ${intent.dstToken}`],
                ["Submitted", `${new Date(intent.createdAt).toLocaleString()} (${timeAgo(intent.createdAt)})`],
                ["Deadline", deadlineLabel(intent.deadline)],
              ].map(([k, v]) => (
                <div key={k} className="bg-vx-surface/40 rounded-lg p-3">
                  <div className="eyebrow mb-1">{k}</div>
                  <div className="text-sm text-vx-text num capitalize">{v}</div>
                </div>
              ))}
              <div className="bg-vx-surface/40 rounded-lg p-3">
                <div className="eyebrow mb-1">Destination address</div>
                <div className="flex items-center gap-2 text-sm text-vx-text num">
                  <span className="truncate">
                    {truncateAddress(intent.dstAddress)}
                  </span>
                  <CopyButton
                    value={intent.dstAddress}
                    label="Copy destination address"
                  />
                  {explorerUrl("account", intent.dstAddress) && (
                    <a
                      href={explorerUrl("account", intent.dstAddress) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-vx-sage hover:underline print:hidden"
                      aria-label={t("intentDetail.viewAccount")}
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            </div>

            {intent.txHash && (
              <div className="pt-2 border-t border-vx-line">
                <div className="eyebrow mb-1">Settlement transaction</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-vx-muted num">{truncate(intent.txHash)}</span>
                  <CopyButton
                    value={intent.txHash}
                    label="Copy transaction hash"
                  />
                  <a
                    href={`https://stellar.expert/explorer/${NETWORK}/tx/${intent.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-vx-sage hover:underline print:hidden"
                  >
                    View on stellar.expert →
                  </a>
                </div>
              </div>
            )}
            {intent.txHash && <section aria-label="On-chain verification" className="rounded-lg border border-vx-border p-4"><div className="eyebrow">On-chain verification</div><p className="mt-1 text-sm">{chainStatus.state}{chainStatus.ledger ? ` at ledger ${chainStatus.ledger}` : ""}{chainStatus.resultCode ? ` (${sanitizeDisplayText(chainStatus.resultCode)})` : ""}</p>{chainStatus.state === "confirmed" && intent.status !== "filled" && <p role="alert" className="text-xs text-amber-300">Relay and on-chain statuses disagree.</p>}<a className="text-xs text-vx-sage" href={explorerTransactionUrl(intent.txHash)} target="_blank" rel="noreferrer">View verified transaction →</a></section>}

            <section className="pt-2 border-t border-vx-line">
              <h2 className="eyebrow mb-3">{t("timeline.title")}</h2>
              <Timeline steps={timeline} />
            </section>

            <section className="pt-2 border-t border-vx-line print:hidden">
              <JsonInspector value={redactForExport(intent)} />
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
