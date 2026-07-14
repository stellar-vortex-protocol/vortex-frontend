"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { useSolvers } from "@/hooks/useSolvers";
import { useOpenIntents } from "@/hooks/useOpenIntents";
import { useAcceptIntent } from "@/hooks/useAcceptIntent";
import { useSolverRegistration } from "@/hooks/useSolverRegistration";
import { timeRemaining } from "@/lib/time";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const MIN_BOND_USD = 50;

const REGISTRATION_LABEL: Record<string, string> = {
  connecting: "Connecting wallet…",
  building: "Preparing registration…",
  "awaiting-signature": "Confirm in Freighter…",
  submitting: "Submitting…",
};

export default function SolvePage() {
  const [tab, setTab] = useState<"leaderboard" | "intents" | "register">("leaderboard");
  const { solvers, isLoading: solversLoading, error: solversError } = useSolvers();
  const { intents: openIntents, isLoading: intentsLoading, error: intentsError } = useOpenIntents();
  const { accept, acceptingId, error: acceptError } = useAcceptIntent();

  const [address, setAddress] = useState("");
  const [bond, setBond] = useState("");
  const registration = useSolverRegistration();
  const isRegistering = registration.status in REGISTRATION_LABEL;

  const addressError = address && !isValidStellarPublicKey(address)
    ? "Enter a valid Stellar address (starts with G)."
    : null;
  const bondError = bond && (isNaN(parseFloat(bond)) || parseFloat(bond) < MIN_BOND_USD)
    ? `Minimum bond is ${MIN_BOND_USD} USDC.`
    : null;
  const canRegister = Boolean(address) && Boolean(bond) && !addressError && !bondError && !isRegistering;

  const handleRegister = () => {
    if (registration.status === "success") {
      registration.reset();
      setAddress("");
      setBond("");
      return;
    }
    if (!canRegister) return;
    registration.register(address, parseFloat(bond));
  };

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
                {openIntents.length} available
              </span>
            </div>

            {acceptError && (
              <div className="px-5 py-2.5 text-xs text-red-400 border-b border-vx-line">{acceptError}</div>
            )}

            {intentsLoading && openIntents.length === 0 ? (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-14 bg-vx-surface/40 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : intentsError ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                Couldn&apos;t load open intents right now. Try again shortly.
              </div>
            ) : openIntents.length === 0 ? (
              <div className="p-8 text-center text-sm text-vx-muted">
                No open intents right now — check back soon.
              </div>
            ) : (
              <div className="divide-y divide-vx-line">
                {openIntents.map(intent => (
                  <div key={intent.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-vx-surface/30">
                    <div>
                      <div className="num text-xs text-vx-muted mb-1 capitalize">ID: {intent.id}</div>
                      <div className="text-sm font-medium text-vx-text capitalize">
                        {intent.srcAmount} {intent.srcToken} on {intent.srcChain}
                      </div>
                      <div className="text-xs text-vx-muted">
                        Min out: {intent.minOut} {intent.dstToken} · Expires in {timeRemaining(intent.deadline)}
                      </div>
                    </div>
                    <button
                      onClick={() => accept(intent.id)}
                      disabled={acceptingId === intent.id}
                      className="px-4 py-2 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg
                                 border border-vx-sage/30 hover:bg-vx-sage/15 transition-colors flex-shrink-0
                                 disabled:opacity-60 disabled:cursor-wait"
                    >
                      {acceptingId === intent.id ? "Accepting…" : "Accept Intent →"}
                    </button>
                  </div>
                ))}
              </div>
            )}
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

              <div>
                <label className="eyebrow block mb-2">Stellar Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value.trim())}
                  placeholder="G..."
                  className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5
                             text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none
                             focus:border-vx-sage/50 transition-colors"
                />
                {addressError && <p className="text-xs text-red-400 mt-1.5">{addressError}</p>}
              </div>

              <div>
                <label className="eyebrow block mb-2">Bond Amount (USDC)</label>
                <input
                  type="number"
                  value={bond}
                  onChange={(e) => setBond(e.target.value)}
                  placeholder="Minimum 50 USDC"
                  className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5
                             text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none
                             focus:border-vx-sage/50 transition-colors"
                />
                {bondError && <p className="text-xs text-red-400 mt-1.5">{bondError}</p>}
              </div>

              <div className="bg-vx-surface/50 rounded-lg p-3 text-xs text-vx-muted space-y-1">
                <div>• Minimum bond: 50 USDC</div>
                <div>• Slash on failed fill: 10% of bond</div>
                <div>• Withdraw bond anytime when inactive</div>
              </div>

              {registration.status === "error" && (
                <p className="text-xs text-red-400">{registration.error}</p>
              )}

              <button
                onClick={handleRegister}
                disabled={!canRegister && registration.status !== "success"}
                className="btn-swap"
              >
                {isRegistering
                  ? REGISTRATION_LABEL[registration.status]
                  : registration.status === "success"
                    ? "Registered ✓ — register another"
                    : "Connect Freighter to Register"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
