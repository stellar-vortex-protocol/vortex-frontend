"use client";
import { useEffect, useRef, useState } from "react";
import type { ReviewModel } from "@/lib/xdrReview";

export function TransactionReviewModal({ review, open, onConfirm, onCancel }: { review: ReviewModel | null; open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) { setAcknowledged(false); cancel.current?.focus(); } }, [open]);
  if (!open || !review) return null;
  const canConfirm = !review.unknownOperation || acknowledged;
  return <div role="dialog" aria-modal="true" aria-labelledby="transaction-review-title" className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4"><div className="mx-auto max-w-lg rounded-xl border border-vx-border bg-vx-panel p-5"><h2 id="transaction-review-title" className="text-lg font-semibold">Review transaction</h2><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt>Network</dt><dd>{review.networkPassphrase}</dd><dt>Source account</dt><dd className="truncate">{review.sourceAccount}</dd><dt>Fee</dt><dd>{review.fee} stroops</dd></dl><div className="mt-4 space-y-2">{review.operations.map((operation, index) => <article key={index} className="rounded border border-vx-border p-3"><h3 className="font-medium">{operation.kind === "payment" ? "Payment" : operation.functionName === "unknown" ? "Unknown operation" : `Contract call: ${operation.functionName}`}</h3>{operation.kind === "payment" ? <p className="text-sm">{operation.amount} {operation.asset} to {operation.destination}</p> : <p className="text-sm">Contract {operation.contractId}; {operation.argCount} arguments</p>}</article>)}</div>{review.unknownOperation && <label className="mt-4 flex gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I understand this operation could not be decoded.</label>}<div className="mt-5 flex justify-end gap-2"><button type="button" ref={cancel} onClick={onCancel} className="rounded border px-3 py-2">Cancel</button><button type="button" disabled={!canConfirm} onClick={onConfirm} className="rounded bg-vx-sage px-3 py-2 disabled:opacity-50">Confirm and sign</button></div></div></div>;
}
