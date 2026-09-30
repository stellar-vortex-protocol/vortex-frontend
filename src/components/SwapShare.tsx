"use client";
import { useMemo, useState } from "react";
import { serializeSwapLink, type SwapLinkState } from "@/lib/swapLink";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import QrCode from "@/components/QrCode";
export function SwapShare({ state }: { state: SwapLinkState }) { const { copy } = useCopyToClipboard(); const [open, setOpen] = useState(false); const [copied, setCopied] = useState(false); const link = useMemo(() => serializeSwapLink(state), [state]); return <div><button type="button" onClick={() => setOpen((value) => !value)}>Share swap</button>{open && <div role="dialog" className="rounded border p-3"><button type="button" onClick={async () => setCopied(await copy(link))}>{copied ? "Copied" : "Copy link"}</button><QrCode value={link} label="QR code for this swap" size={160} /><code className="block max-w-xs break-all text-xs">{link}</code></div>}</div>; }
