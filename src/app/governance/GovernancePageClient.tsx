"use client";

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { getGovernanceProposals } from "@/lib/governanceStore";
import { timeRemaining } from "@/lib/time";
import { getMessage } from "@/i18n/messages";

export default function GovernancePageClient() {
  const proposals = getGovernanceProposals();
  const [filter, setFilter] = useState<"all" | "active" | "passed" | "rejected">("all");

  const filteredProposals = proposals.filter((p) => {
    if (filter === "all") return true;
    return p.status === filter;
  });

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Governance" />

      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="eyebrow mb-2 sm:mb-3 text-xs">Community Protocol</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-2 sm:mb-3">
            {getMessage("solve.governance.title")}
          </h1>
          <p className="text-vx-muted text-xs sm:text-sm max-w-lg leading-relaxed">
            {getMessage("solve.governance.description")}
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {(["all", "active", "passed", "rejected"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                  : "bg-vx-surface/50 text-vx-muted hover:text-vx-text border border-vx-border"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Proposal list */}
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
            <div
              key={proposal.id}
              className="card p-5 sm:p-6 hover:border-vx-sage/40 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-vx-sage font-bold">{proposal.id}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-vx-surface text-vx-muted border border-vx-border">
                    {proposal.category}
                  </span>
                </div>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium w-fit ${
                    proposal.status === "active"
                      ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                      : proposal.status === "passed"
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                      : "bg-red-500/10 text-red-400 border border-red-500/30"
                  }`}
                >
                  {proposal.status}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-vx-text mb-2">
                <Link
                  href={`/governance/${proposal.id}`}
                  className="hover:text-vx-sage transition-colors"
                >
                  {proposal.title}
                </Link>
              </h2>

              <p className="text-xs sm:text-sm text-vx-muted mb-4 line-clamp-2 leading-relaxed">
                {proposal.description}
              </p>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-vx-line text-xs text-vx-muted">
                <div className="flex gap-4">
                  <span>
                    For: <strong className="text-vx-text">{proposal.votesFor.toLocaleString()}</strong>
                  </span>
                  <span>
                    Against: <strong className="text-vx-text">{proposal.votesAgainst.toLocaleString()}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span>Deadline: {timeRemaining(proposal.deadline)}</span>
                  <Link
                    href={`/governance/${proposal.id}`}
                    className="text-vx-sage hover:underline font-semibold"
                  >
                    View Proposal & Discussion →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
