"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { useSolvers } from "@/hooks/useSolvers";

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const OPEN_INTENTS = [
  { id: "a1b2...",  chain: "Ethereum",  token: "USDC", amount: "500",   dst: "USDC", minOut: "495",   deadline: "18m" },
  { id: "c3d4...",  chain: "Base",      token: "WETH", amount: "0.14",  dst: "USDC", minOut: "480",   deadline: "12m" },
  { id: "e5f6...",  chain: "Optimism",  token: "USDC", amount: "200",   dst: "XLM",  minOut: "1,960", deadline: "26m" },
];

export default function SolvePage() {
  const [tab, setTab] = useState<"leaderboard" | "intents" | "register">("leaderboard");
  const { solvers, isLoading: solversLoading, error: solversError } = useSolvers();

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <Nav variant="breadcrumb" label="Solver Portal" />

      <div className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-10">
          <div className="eyebrow mb-3">Solver Network</div>
          <h1 className="text-3xl font-bold text-vx-text mb-3">Become a Vortex Solver</h1>
          <p className="text-vx-muted text-sm max-w-lg leading-relaxed">
            Solvers are competitive market makers who fill user swap intents. Deposit a USDC bond,
            watch the open intent feed, and earn fees on every fill you complete.
          </p>
        </div>

        {/* How solver earns */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {[
            {
              n: "01",
              title: "Register + Bond",
              body: "Deposit ≥50 USDC as a bond into the Vortex settlement contract. Your bond backs your reliability — failing to fill after accepting slashes 10%.",
            },
            {
              n: "02",
              title: "Watch the intent feed",
              body: "Monitor the open intents API or WebSocket. When you see a profitable opportunity, claim exclusive fill rights for a 5-minute window.",
            },
            {
              n: "03",
              title: "Fill and earn",
              body: "Execute the source-chain leg, relay to Stellar, transfer dst tokens to the user. Earn the spread between your fill cost and the user's minimum.",
            },
          ].map(item => (
            <div key={item.n} className="card p-5">
              <div className="font-mono text-xs text-vx-sage mb-3">{item.n}</div>
              <h3 className="text-sm font-semibold text-vx-text mb-2">{item.title}</h3>
              <p className="text-xs text-vx-muted leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-vx-surface/50 p-1 rounded-lg w-fit">
          {(["leaderboard", "intents", "register"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-all
                ${tab === t ? "bg-vx-card text-vx-text border border-vx-border" : "text-vx-muted hover:text-vx-text"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        {tab === "leaderboard" && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-vx-border bg-vx-surface/30">
              <span className="text-sm font-semibold text-vx-text">Active Solvers</span>
            </div>
            {solversLoading && solvers.length === 0 ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 bg-vx-surface/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : solversError ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                Couldn&apos;t load the solver leaderboard right now. Try again shortly.
              </div>
            ) : solvers.length === 0 ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                No active solvers yet.
              </div>
            ) : (
              <div className="divide-y divide-vx-line">
                {solvers.map((s, i) => (
                  <div key={s.address} className="px-5 py-4 hover:bg-vx-surface/30 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <span className="num text-lg font-bold text-vx-dim w-6 flex-shrink-0">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-vx-text">{s.name}</div>
                          <div className="num text-xs text-vx-muted">{s.address}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {s.chains.map(c => (
                              <span key={c} className="text-[10px] px-1.5 py-0.5 bg-vx-surface rounded text-vx-muted">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-6 flex-shrink-0 text-right">
                        <div>
                          <div className="num text-sm font-semibold text-vx-text">{s.fills}</div>
                          <div className="eyebrow">Fills</div>
                        </div>
                        <div>
                          <div className="num text-sm font-semibold text-vx-text">{usdCompact.format(s.volumeUsd)}</div>
                          <div className="eyebrow">Volume</div>
                        </div>
                        <div>
                          <div className="num text-sm font-semibold text-vx-text">{s.avgFillTimeSeconds}s</div>
                          <div className="eyebrow">Avg Time</div>
                        </div>
                        <div>
                          <div className={`num text-sm font-semibold ${s.successRatePct > 99 ? "text-vx-sage" : "text-vx-amber"}`}>
                            {s.successRatePct}%
                          </div>
                          <div className="eyebrow">Success</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Open intents */}
        {tab === "intents" && (
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-vx-border bg-vx-surface/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-vx-text">Open Intents</span>
              <span className="chip bg-vx-sage-bg text-vx-sage text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-vx-sage animate-pulse" />
                {OPEN_INTENTS.length} available
              </span>
            </div>
            <div className="divide-y divide-vx-line">
              {OPEN_INTENTS.map(intent => (
                <div key={intent.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-vx-surface/30">
                  <div>
                    <div className="num text-xs text-vx-muted mb-1">ID: {intent.id}</div>
                    <div className="text-sm font-medium text-vx-text">
                      {intent.amount} {intent.token} on {intent.chain}
                    </div>
                    <div className="text-xs text-vx-muted">
                      Min out: {intent.minOut} {intent.dst} · Expires in {intent.deadline}
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg
                                     border border-vx-sage/30 hover:bg-vx-sage/15 transition-colors flex-shrink-0">
                    Accept Intent →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Register form */}
        {tab === "register" && (
          <div className="max-w-md">
            <div className="card p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-vx-text mb-1">Register as Solver</h3>
                <p className="text-xs text-vx-muted">Deposit a USDC bond to start filling intents.</p>
              </div>
              {[
                { label: "Stellar Address",  placeholder: "G...", type: "text" },
                { label: "Bond Amount (USDC)", placeholder: "Minimum 50 USDC", type: "number" },
              ].map(field => (
                <div key={field.label}>
                  <label className="eyebrow block mb-2">{field.label}</label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5
                               text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none
                               focus:border-vx-sage/50 transition-colors"
                  />
                </div>
              ))}
              <div className="bg-vx-surface/50 rounded-lg p-3 text-xs text-vx-muted space-y-1">
                <div>• Minimum bond: 50 USDC</div>
                <div>• Slash on failed fill: 10% of bond</div>
                <div>• Withdraw bond anytime when inactive</div>
              </div>
              <button className="btn-swap">Connect Freighter to Register</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
