"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// ─── Chain / Token Data ───────────────────────────────────────────────────────

const CHAINS = [
  { id: "ethereum", name: "Ethereum",  short: "ETH",  color: "#627EEA" },
  { id: "base",     name: "Base",      short: "BASE", color: "#0052FF" },
  { id: "polygon",  name: "Polygon",   short: "POL",  color: "#8247E5" },
  { id: "arbitrum", name: "Arbitrum",  short: "ARB",  color: "#12AAFF" },
  { id: "optimism", name: "Optimism",  short: "OP",   color: "#FF0420" },
  { id: "avalanche",name: "Avalanche", short: "AVAX", color: "#E84142" },
];

const SRC_TOKENS: Record<string, { symbol: string; decimals: number; priceUSD: number }[]> = {
  ethereum: [
    { symbol: "USDC", decimals: 6,  priceUSD: 1.0 },
    { symbol: "WETH", decimals: 18, priceUSD: 3512.80 },
    { symbol: "WBTC", decimals: 8,  priceUSD: 67420.50 },
    { symbol: "USDT", decimals: 6,  priceUSD: 1.0 },
  ],
  base:     [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  polygon:  [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "MATIC", decimals: 18, priceUSD: 0.58 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  arbitrum: [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  optimism: [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  avalanche:[{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "AVAX", decimals: 18, priceUSD: 35.40 }],
};

const DST_TOKENS = [
  { symbol: "USDC", priceUSD: 1.0,    contract: "CBIELTK6..." },
  { symbol: "XLM",  priceUSD: 0.1182, contract: "native" },
  { symbol: "yXLM", priceUSD: 0.1180, contract: "CCZX67..." },
];

// ─── Recent Intents Feed ──────────────────────────────────────────────────────

const FEED_ITEMS = [
  { chain: "ethereum", token: "USDC", amount: "500", dst: "USDC", solver: "Alpha", time: "12s ago", status: "filled" },
  { chain: "base",     token: "WETH", amount: "0.14", dst: "USDC", solver: "Beta",  time: "47s ago", status: "filled" },
  { chain: "polygon",  token: "USDC", amount: "200", dst: "XLM",  solver: "Beta",  time: "1m ago",  status: "accepted" },
  { chain: "arbitrum", token: "WETH", amount: "1.00", dst: "USDC", solver: "Alpha", time: "2m ago",  status: "filled" },
  { chain: "ethereum", token: "USDC", amount: "2000", dst: "USDC", solver: "Beta",  time: "3m ago",  status: "filled" },
  { chain: "optimism", token: "USDC", amount: "150", dst: "XLM",  solver: "Gamma", time: "5m ago",  status: "filled" },
];

// ─── Swap Card ────────────────────────────────────────────────────────────────

function SwapCard() {
  const [srcChain, setSrcChain] = useState("ethereum");
  const [srcToken, setSrcToken] = useState(SRC_TOKENS["ethereum"][0]);
  const [dstToken, setDstToken] = useState(DST_TOKENS[0]);
  const [srcAmount, setSrcAmount] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<{
    dstAmount: string;
    solver: string;
    fillTime: number;
    priceImpact: number;
  } | null>(null);
  const [showChainPicker, setShowChainPicker] = useState(false);
  const [showTokenPicker, setShowTokenPicker] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const chain = CHAINS.find(c => c.id === srcChain)!;

  const dstAmount = quote
    ? parseFloat(quote.dstAmount)
    : srcAmount
      ? (parseFloat(srcAmount) * srcToken.priceUSD) / dstToken.priceUSD * 0.998
      : 0;

  useEffect(() => {
    clearTimeout(debounce.current);
    if (!srcAmount || parseFloat(srcAmount) <= 0) {
      setQuote(null);
      return;
    }
    setQuoting(true);
    debounce.current = setTimeout(() => {
      // Simulate quote fetch
      setTimeout(() => {
        const rawDst = (parseFloat(srcAmount) * srcToken.priceUSD) / dstToken.priceUSD;
        const impact = Math.min(parseFloat(srcAmount) * srcToken.priceUSD / 500_000, 0.005);
        const dstAmt = rawDst * (1 - 0.0005 - impact);
        setQuote({
          dstAmount: dstAmt.toFixed(dstToken.symbol === "XLM" ? 2 : 4),
          solver: parseFloat(srcAmount) > 500 ? "Beta Liquidity Co" : "Alpha Market Making",
          fillTime: parseFloat(srcAmount) > 1000 ? 55 : 32,
          priceImpact: impact * 100,
        });
        setQuoting(false);
      }, 600);
    }, 500);
  }, [srcAmount, srcToken, dstToken]);

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
              ["Est. fill time",   `~${quote.fillTime}s`],
              ["Price impact",     `${quote.priceImpact < 0.01 ? "<0.01" : quote.priceImpact.toFixed(2)}%`],
              ["Protocol fee",     "0.05%"],
              ["Rate",             `1 ${srcToken.symbol} = ${(srcToken.priceUSD / dstToken.priceUSD).toFixed(4)} ${dstToken.symbol}`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-xs text-vx-muted">{k}</span>
                <span className="num text-xs text-vx-text font-medium">{v}</span>
              </div>
            ))}
          </div>
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

// ─── Intent Pipeline Visualization ────────────────────────────────────────────

function IntentPipeline() {
  const stages = [
    { label: "Intent", sub: "You submit",  color: "#A78BFA" },
    { label: "Auction", sub: "Solvers bid", color: "#60A5FA" },
    { label: "Relay",  sub: "Best fills",  color: "#4CEBA8" },
    { label: "Settle", sub: "On Stellar",  color: "#4CEBA8" },
  ];

  return (
    <div className="flex items-center gap-0">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                 style={{ borderColor: s.color, background: `${s.color}15` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            </div>
            <div className="text-center">
              <div className="text-[11px] font-semibold text-vx-text">{s.label}</div>
              <div className="text-[10px] text-vx-muted">{s.sub}</div>
            </div>
          </div>
          {i < stages.length - 1 && (
            <div className="w-12 mb-5 mx-1">
              <svg viewBox="0 0 48 4" className="w-full">
                <line x1="0" y1="2" x2="48" y2="2"
                      stroke="rgba(76,235,168,0.3)"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      className="intent-flow-line" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Activity Feed ────────────────────────────────────────────────────────────

function ActivityFeed() {
  const [items, setItems] = useState(FEED_ITEMS);

  useEffect(() => {
    const id = setInterval(() => {
      const chains = ["ethereum", "base", "polygon", "arbitrum"];
      const tokens = ["USDC", "WETH"];
      const solvers = ["Alpha", "Beta", "Gamma"];
      const newItem = {
        chain: chains[Math.floor(Math.random() * chains.length)],
        token: tokens[Math.floor(Math.random() * tokens.length)],
        amount: (Math.random() * 900 + 100).toFixed(0),
        dst: "USDC",
        solver: solvers[Math.floor(Math.random() * solvers.length)],
        time: "just now",
        status: "filled" as const,
      };
      setItems(prev => [newItem, ...prev.slice(0, 7)]);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const chainColor: Record<string, string> = {
    ethereum: "#627EEA", base: "#0052FF", polygon: "#8247E5",
    arbitrum: "#12AAFF", optimism: "#FF0420", avalanche: "#E84142",
  };

  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((item, i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-vx-surface/40 rounded-lg
                                border border-vx-line hover:border-vx-border transition-colors">
          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
               style={{ background: `${chainColor[item.chain]}20`, border: `1px solid ${chainColor[item.chain]}30` }}>
            <div className="w-2 h-2 rounded-full" style={{ background: chainColor[item.chain] }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-vx-text truncate">
              {item.amount} {item.token} → {item.dst}
            </div>
            <div className="text-[10px] text-vx-muted capitalize">
              {item.chain} · via {item.solver}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="state-dot bg-vx-sage" />
            <span className="text-[10px] text-vx-muted">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const stats = [
    { label: "Total Volume", value: "$4.2M" },
    { label: "Intents Filled", value: "2,270" },
    { label: "Active Solvers", value: "3" },
    { label: "Avg Fill Time", value: "42s" },
  ];

  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b border-vx-border bg-vx-ink/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <svg className="w-6 h-6 text-vx-sage" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-semibold text-sm tracking-tight text-vx-text">Vortex</span>
            </div>
            <div className="hidden md:flex items-center gap-5 text-sm text-vx-muted">
              <Link href="/explore" className="hover:text-vx-text transition-colors">Explore</Link>
              <Link href="/solve" className="hover:text-vx-text transition-colors">Become a Solver</Link>
              <a href="https://github.com/vortex-protocol" className="hover:text-vx-text transition-colors">
                Docs
              </a>
            </div>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-vx-border
                             text-sm text-vx-muted hover:text-vx-text hover:border-vx-sage/30
                             transition-all duration-150">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Connect Freighter
          </button>
        </div>
      </nav>

      {/* ── Main layout ── */}
      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 items-start">

          {/* Left: copy + pipeline + feed */}
          <div className="space-y-10">
            {/* Hero text */}
            <div>
              <div className="eyebrow mb-4">Stellar Agentic Hackathon 2025</div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-vx-text mb-4">
                Swap from any chain<br />
                <span className="text-vx-sage">directly to Stellar.</span>
              </h1>
              <p className="text-base text-vx-muted leading-relaxed max-w-md">
                Vortex is an intent-based cross-chain protocol. Express what you want,
                and competing solvers race to fill it — no bridges, no wrapped assets, no
                trust assumptions beyond the solver bond.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {stats.map(s => (
                <div key={s.label} className="card-sm px-4 py-3">
                  <div className="num text-xl font-semibold text-vx-text">{s.value}</div>
                  <div className="eyebrow mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Intent pipeline */}
            <div className="space-y-4">
              <div className="eyebrow">How it works</div>
              <IntentPipeline />
            </div>

            {/* Live feed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="eyebrow">Live Fills</div>
                <Link href="/explore" className="text-xs text-vx-sage hover:underline">
                  View all →
                </Link>
              </div>
              <ActivityFeed />
            </div>
          </div>

          {/* Right: swap card */}
          <div className="lg:sticky lg:top-24">
            <SwapCard />

            {/* Supported chains */}
            <div className="mt-5">
              <div className="eyebrow mb-3">Supported chains</div>
              <div className="flex flex-wrap gap-2">
                {CHAINS.map(c => (
                  <div key={c.id}
                       className="flex items-center gap-1.5 px-2.5 py-1.5 bg-vx-surface rounded-lg border border-vx-border">
                    <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs text-vx-muted">{c.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-vx-sage-bg rounded-lg border border-vx-sage/20">
                  <span className="w-2 h-2 rounded-full bg-vx-sage" />
                  <span className="text-xs text-vx-sage font-medium">Stellar (dest.)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="mt-20 border-t border-vx-border px-5 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-vx-muted">
          <span>© 2025 Vortex Protocol · MIT License</span>
          <div className="flex gap-5">
            <a href="https://github.com/vortex-protocol" className="hover:text-vx-text transition-colors">GitHub</a>
            <a href="https://discord.gg/vortex" className="hover:text-vx-text transition-colors">Discord</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
