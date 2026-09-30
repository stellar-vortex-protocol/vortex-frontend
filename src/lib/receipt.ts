import type { IntentDetail } from "@/lib/types";

export type ReceiptLine = { label: string; value: string };

export type Receipt = {
  intentId: string;
  network: string;
  explorerUrl: string | null;
  lines: ReceiptLine[];
  disclaimer: string;
};

export const RECEIPT_DISCLAIMER =
  "This receipt is a convenience summary. On-chain data is authoritative; verify the transaction on the Stellar network explorer.";

export function explorerTxUrl(network: string, txHash: string): string {
  return `https://stellar.expert/explorer/${encodeURIComponent(network)}/tx/${encodeURIComponent(txHash)}`;
}

function formatAmount(value: string | undefined, token: string, locale: string): string {
  if (value === undefined || value === "") return "—";
  const n = Number(value);
  const formatted = Number.isFinite(n)
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 7 }).format(n)
    : value;
  return `${formatted} ${token}`;
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const local = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "long" }).format(d);
  return `${d.toISOString().replace(".000Z", "Z")} UTC (${local})`;
}

/**
 * Pure receipt builder shared by the printable page and "Copy receipt".
 * Only public, non-sensitive fields are included (never signed XDR).
 */
export function buildReceipt(intent: IntentDetail, locale: string, network: string): Receipt {
  const explorerUrl = intent.txHash ? explorerTxUrl(network, intent.txHash) : null;
  const srcAmount = Number(intent.srcAmount);
  const minOut = Number(intent.minOut);
  const dstAmount = Number(intent.dstAmount);
  // Fees are not reported by the relay; surface price improvement over the
  // minimum instead of inventing a fee figure.
  const improvement =
    Number.isFinite(dstAmount) && Number.isFinite(minOut) && intent.dstAmount
      ? formatAmount(String(dstAmount - minOut), intent.dstToken, locale)
      : "—";

  const lines: ReceiptLine[] = [
    { label: "Intent ID", value: intent.id },
    { label: "Status", value: intent.status },
    { label: "Network", value: network },
    { label: "Source chain", value: intent.srcChain },
    { label: "Sent", value: formatAmount(Number.isFinite(srcAmount) ? intent.srcAmount : undefined, intent.srcToken, locale) },
    { label: "Received", value: formatAmount(intent.dstAmount, intent.dstToken, locale) },
    { label: "Minimum out", value: formatAmount(intent.minOut, intent.dstToken, locale) },
    { label: "Improvement over minimum", value: improvement },
    { label: "Solver", value: intent.solver },
    { label: "Destination address", value: intent.dstAddress },
    { label: "Submitted", value: formatDate(intent.createdAt, locale) },
    { label: "Transaction hash", value: intent.txHash ?? "—" },
  ];
  if (explorerUrl) lines.push({ label: "Explorer", value: explorerUrl });

  return { intentId: intent.id, network, explorerUrl, lines, disclaimer: RECEIPT_DISCLAIMER };
}

export function receiptToText(receipt: Receipt): string {
  const width = Math.max(...receipt.lines.map((l) => l.label.length));
  return [
    "Vortex swap receipt",
    "===================",
    ...receipt.lines.map((l) => `${l.label.padEnd(width)}  ${l.value}`),
    "",
    receipt.disclaimer,
  ].join("\n");
}
