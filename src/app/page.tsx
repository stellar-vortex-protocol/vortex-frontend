"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SwapCard } from "@/components/SwapCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CHAINS } from "@/lib/marketData";

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
            <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center border-2"
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
      <Nav variant="home" />

      {/* ── Main layout ── */}
      <main id="main-content" className="max-w-6xl mx-auto px-5 py-14">
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
                    <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs text-vx-muted">{c.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-vx-sage-bg rounded-lg border border-vx-sage/20">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-vx-sage" />
                  <span className="text-xs text-vx-sage font-medium">Stellar (dest.)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
