"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import type { WaveMetrics, ComplexityTier, IssueStatus } from "@/lib/issuesParser";

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function ContributorsPageClient({ metrics }: { metrics: WaveMetrics }) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedComplexity, setSelectedComplexity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredIssues = metrics.issues.filter((issue) => {
    if (selectedCategory !== "all" && issue.category !== selectedCategory) return false;
    if (selectedComplexity !== "all" && issue.complexity !== selectedComplexity) return false;
    if (selectedStatus !== "all" && issue.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = issue.title.toLowerCase().includes(q);
      const matchesId = `#${issue.id}`.includes(q) || String(issue.id).includes(q);
      const matchesContrib = issue.contributor?.toLowerCase().includes(q);
      if (!matchesTitle && !matchesId && !matchesContrib) return false;
    }
    return true;
  });

  const completionPct =
    metrics.totalIssues > 0
      ? Math.round((metrics.completedIssues / metrics.totalIssues) * 100)
      : 0;

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Contributor Dashboard" />

      <main id="main-content" className="max-w-6xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="eyebrow mb-2 sm:mb-3 text-xs">Drips Wave Transparency</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-2 sm:mb-3">
            Contributor Progress & Wave Metrics
          </h1>
          <p className="text-vx-muted text-xs sm:text-sm max-w-2xl leading-relaxed">
            Real-time tracking of contributor issue distribution, complexity tiers, point allocations, and completed work across the Vortex Protocol ecosystem.
          </p>
        </div>

        {/* Top Level Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">Overall Progress</div>
            <div className="text-2xl font-bold text-vx-text mb-2">
              {metrics.completedIssues} <span className="text-xs font-normal text-vx-muted">/ {metrics.totalIssues} Issues</span>
            </div>
            <div className="w-full bg-vx-surface h-2 rounded-full overflow-hidden mb-1">
              <div
                className="bg-vx-sage h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="text-[11px] text-vx-sage font-semibold text-right">{completionPct}% Complete</div>
          </div>

          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">Wave Points Earned</div>
            <div className="text-2xl font-bold text-vx-sage mb-2">
              {metrics.earnedPoints.toLocaleString()} <span className="text-xs font-normal text-vx-muted">/ {metrics.totalPoints.toLocaleString()}</span>
            </div>
            <div className="text-xs text-vx-muted">
              {metrics.totalPoints - metrics.earnedPoints} points remaining
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">Issue Distribution</div>
            <div className="flex items-center gap-3 mt-1">
              <div>
                <span className="text-lg font-bold text-vx-sage">{metrics.completedIssues}</span>
                <span className="text-[10px] text-vx-muted block">Done</span>
              </div>
              <div className="border-r border-vx-line h-6" />
              <div>
                <span className="text-lg font-bold text-vx-amber">{metrics.inProgressIssues}</span>
                <span className="text-[10px] text-vx-muted block">In Progress</span>
              </div>
              <div className="border-r border-vx-line h-6" />
              <div>
                <span className="text-lg font-bold text-vx-text">{metrics.openIssues}</span>
                <span className="text-[10px] text-vx-muted block">Open</span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">Active Contributors</div>
            <div className="text-2xl font-bold text-vx-text mb-2">
              {metrics.leaderboard.length}
            </div>
            <div className="text-xs text-vx-muted">Verified completion authors</div>
          </div>
        </div>

        {/* Category & Complexity Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Category Breakdown */}
          <div className="lg:col-span-2 card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-vx-text mb-4">Issues by Category</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metrics.categories.map((cat) => {
                const catPct = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
                return (
                  <div key={cat.category} className="p-3.5 bg-vx-surface/40 rounded-xl border border-vx-border/60">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-vx-text truncate">{cat.category}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-vx-surface text-vx-sage border border-vx-sage/20">
                        {cat.earnedPoints} pts
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-vx-muted mb-2">
                      <span>{cat.completed} of {cat.total} completed</span>
                      <span>{catPct}%</span>
                    </div>
                    <div className="w-full bg-vx-surface h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-vx-sage h-full rounded-full transition-all"
                        style={{ width: `${catPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complexity Tiers Breakdown */}
          <div className="card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-vx-text mb-4">Complexity Tiers</h2>
            <div className="space-y-3">
              {metrics.complexities.map((tier) => (
                <div key={tier.complexity} className="p-3 bg-vx-surface/40 rounded-xl border border-vx-border/60">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold ${
                        tier.complexity === "High"
                          ? "text-vx-amber"
                          : tier.complexity === "Medium"
                          ? "text-vx-sage"
                          : "text-blue-400"
                      }`}
                    >
                      {tier.complexity} ({tier.complexity === "High" ? "200" : tier.complexity === "Medium" ? "150" : "50"} pts)
                    </span>
                    <span className="text-xs text-vx-text font-semibold">{tier.completed} / {tier.total}</span>
                  </div>
                  <div className="text-[11px] text-vx-muted">
                    Total tier value: {tier.points.toLocaleString()} points
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contributor Leaderboard */}
        <div className="card overflow-hidden mb-10">
          <div className="px-5 py-4 border-b border-vx-border bg-vx-surface/30 flex items-center justify-between">
            <h2 className="text-base font-semibold text-vx-text">Top Wave Contributors</h2>
            <span className="text-xs text-vx-muted">{metrics.leaderboard.length} Contributors</span>
          </div>

          <div className="divide-y divide-vx-line overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vx-surface/20 text-vx-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold">Rank</th>
                  <th className="px-5 py-3 font-semibold">Contributor Address</th>
                  <th className="px-5 py-3 font-semibold text-center">Completed Issues</th>
                  <th className="px-5 py-3 font-semibold text-right">Points Earned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vx-line">
                {metrics.leaderboard.map((c, idx) => (
                  <tr key={c.contributor} className="hover:bg-vx-surface/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-bold text-vx-dim">
                      #{String(idx + 1).padStart(2, "0")}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-vx-text">
                      {truncateAddress(c.contributor)}
                    </td>
                    <td className="px-5 py-3.5 text-center text-vx-muted font-medium">
                      {c.completedCount}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-vx-sage">
                      {c.pointsEarned.toLocaleString()} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Filterable Issues Table */}
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-vx-border bg-vx-surface/30 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-base font-semibold text-vx-text">Wave Issues Directory</h2>
              <span className="text-xs text-vx-muted">
                Showing {filteredIssues.length} of {metrics.issues.length} issues
              </span>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Search by ID, title, or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text placeholder-vx-dim focus:outline-none focus:border-vx-sage/50"
              />

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text focus:outline-none focus:border-vx-sage/50"
              >
                <option value="all">All Categories</option>
                {metrics.categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category}
                  </option>
                ))}
              </select>

              <select
                value={selectedComplexity}
                onChange={(e) => setSelectedComplexity(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text focus:outline-none focus:border-vx-sage/50"
              >
                <option value="all">All Complexities</option>
                <option value="Trivial">Trivial (50 pts)</option>
                <option value="Medium">Medium (150 pts)</option>
                <option value="High">High (200 pts)</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text focus:outline-none focus:border-vx-sage/50"
              >
                <option value="all">All Statuses</option>
                <option value="Completed">Completed</option>
                <option value="In Progress">In Progress</option>
                <option value="Open">Open</option>
              </select>
            </div>
          </div>

          {/* Issues table */}
          <div className="divide-y divide-vx-line overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vx-surface/20 text-vx-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold">Issue #</th>
                  <th className="px-5 py-3 font-semibold">Title</th>
                  <th className="px-5 py-3 font-semibold">Category</th>
                  <th className="px-5 py-3 font-semibold">Complexity</th>
                  <th className="px-5 py-3 font-semibold">Points</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Contributor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-vx-line">
                {filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-vx-surface/30 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-vx-sage">
                      #{issue.id}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-vx-text max-w-xs sm:max-w-md truncate">
                      {issue.title}
                    </td>
                    <td className="px-5 py-3.5 text-vx-muted">{issue.category}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          issue.complexity === "High"
                            ? "bg-amber-500/10 text-vx-amber border border-amber-500/20"
                            : issue.complexity === "Medium"
                            ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        }`}
                      >
                        {issue.complexity}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-bold text-vx-text">{issue.points}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          issue.status === "Completed"
                            ? "bg-vx-sage-bg text-vx-sage"
                            : issue.status === "In Progress"
                            ? "bg-amber-500/10 text-vx-amber"
                            : "bg-vx-surface text-vx-muted"
                        }`}
                      >
                        {issue.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-vx-muted">
                      {issue.contributor ? truncateAddress(issue.contributor) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
