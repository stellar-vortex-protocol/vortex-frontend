"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import type { ComplexityTier, IssueStatus, WaveMetrics } from "@/lib/issuesParser";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";

const STATUS_LABEL_KEY: Record<IssueStatus, MessageKey> = {
  Completed: "wave.status.completed",
  "In Progress": "wave.status.inProgress",
  Open: "wave.status.open",
};
const TIER_NAME_KEY: Record<ComplexityTier, MessageKey> = {
  Trivial: "wave.tierName.trivial",
  Medium: "wave.tierName.medium",
  High: "wave.tierName.high",
};
const TIER_LABEL_KEY: Record<ComplexityTier, MessageKey> = {
  Trivial: "wave.tier.trivial",
  Medium: "wave.tier.medium",
  High: "wave.tier.high",
};

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function ContributorsPageClient({ metrics }: { metrics: WaveMetrics }) {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedComplexity, setSelectedComplexity] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [goodFirstOnly, setGoodFirstOnly] = useState(false);

  const filteredIssues = metrics.issues.filter((issue) => {
    if (selectedCategory !== "all" && issue.category !== selectedCategory) return false;
    if (selectedComplexity !== "all" && issue.complexity !== selectedComplexity) return false;
    if (selectedStatus !== "all" && issue.status !== selectedStatus) return false;
    if (goodFirstOnly && !issue.goodFirstIssue) return false;
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
      <Nav variant="breadcrumb" label={t("wave.breadcrumb")} />

      <main id="main-content" className="max-w-6xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="eyebrow mb-2 sm:mb-3 text-xs">{t("wave.eyebrow")}</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-2 sm:mb-3">
            {t("wave.title")}
          </h1>
          <p className="text-vx-muted text-xs sm:text-sm max-w-2xl leading-relaxed">
            {t("wave.description")}
          </p>
        </div>

        {/* Top Level Metrics Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">{t("wave.progress")}</div>
            <div className="text-2xl font-bold text-vx-text mb-2">
              {metrics.completedIssues} <span className="text-xs font-normal text-vx-muted">{t("wave.progress.issues", { total: metrics.totalIssues })}</span>
            </div>
            <div className="w-full bg-vx-surface h-2 rounded-full overflow-hidden mb-1">
              <div
                className="bg-vx-sage h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <div className="text-[11px] text-vx-sage font-semibold text-right">{t("wave.progress.complete", { percent: completionPct })}</div>
          </div>

          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">{t("wave.points")}</div>
            <div className="text-2xl font-bold text-vx-sage mb-2">
              {metrics.earnedPoints.toLocaleString()} <span className="text-xs font-normal text-vx-muted">/ {metrics.totalPoints.toLocaleString()}</span>
            </div>
            <div className="text-xs text-vx-muted">
              {t("wave.points.remaining", { count: metrics.totalPoints - metrics.earnedPoints })}
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">{t("wave.distribution")}</div>
            <div className="flex items-center gap-3 mt-1">
              <div>
                <span className="text-lg font-bold text-vx-sage">{metrics.completedIssues}</span>
                <span className="text-[10px] text-vx-muted block">{t("wave.status.done")}</span>
              </div>
              <div className="border-r border-vx-line h-6" />
              <div>
                <span className="text-lg font-bold text-vx-amber">{metrics.inProgressIssues}</span>
                <span className="text-[10px] text-vx-muted block">{t("wave.status.inProgress")}</span>
              </div>
              <div className="border-r border-vx-line h-6" />
              <div>
                <span className="text-lg font-bold text-vx-text">{metrics.openIssues}</span>
                <span className="text-[10px] text-vx-muted block">{t("wave.status.open")}</span>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow text-[10px] sm:text-xs mb-1">{t("wave.activeContributors")}</div>
            <div className="text-2xl font-bold text-vx-text mb-2">
              {metrics.leaderboard.length}
            </div>
            <div className="text-xs text-vx-muted">{t("wave.activeContributors.note")}</div>
          </div>
        </div>

        {/* Category & Complexity Breakdown Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
          {/* Category Breakdown */}
          <div className="lg:col-span-2 card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-vx-text mb-4">{t("wave.categories")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {metrics.categories.map((cat) => {
                const catPct = cat.total > 0 ? Math.round((cat.completed / cat.total) * 100) : 0;
                return (
                  <div key={cat.category} className="p-3.5 bg-vx-surface/40 rounded-xl border border-vx-border/60">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold text-vx-text truncate">{cat.category}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-vx-surface text-vx-sage border border-vx-sage/20">
                        {t("wave.points.short", { count: cat.earnedPoints })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-vx-muted mb-2">
                      <span>{t("wave.categories.completed", { completed: cat.completed, total: cat.total })}</span>
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
            <h2 className="text-base font-semibold text-vx-text mb-4">{t("wave.tiers")}</h2>
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
                      {t(TIER_LABEL_KEY[tier.complexity])}
                    </span>
                    <span className="text-xs text-vx-text font-semibold">{tier.completed} / {tier.total}</span>
                  </div>
                  <div className="text-[11px] text-vx-muted">
                    {t("wave.tiers.total", { count: tier.points.toLocaleString() })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contributor Leaderboard */}
        <div className="card overflow-hidden mb-10">
          <div className="px-5 py-4 border-b border-vx-border bg-vx-surface/30 flex items-center justify-between">
            <h2 className="text-base font-semibold text-vx-text">{t("wave.leaderboard")}</h2>
            <span className="text-xs text-vx-muted">{t("wave.leaderboard.count", { count: metrics.leaderboard.length })}</span>
          </div>

          <div className="divide-y divide-vx-line overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vx-surface/20 text-vx-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t("wave.leaderboard.rank")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.leaderboard.address")}</th>
                  <th className="px-5 py-3 font-semibold text-center">{t("wave.leaderboard.completed")}</th>
                  <th className="px-5 py-3 font-semibold text-right">{t("wave.leaderboard.points")}</th>
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
                      {t("wave.points.short", { count: c.pointsEarned.toLocaleString() })}
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
              <h2 className="text-base font-semibold text-vx-text">{t("wave.issues")}</h2>
              <span className="text-xs text-vx-muted">
                {t("wave.issues.showing", { shown: filteredIssues.length, total: metrics.issues.length })}
              </span>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder={t("wave.issues.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text placeholder-vx-dim focus:outline-none focus:border-vx-sage/50"
              />

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text focus:outline-none focus:border-vx-sage/50"
              >
                <option value="all">{t("wave.issues.allCategories")}</option>
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
                <option value="all">{t("wave.issues.allComplexities")}</option>
                <option value="Trivial">{t("wave.tier.trivial")}</option>
                <option value="Medium">{t("wave.tier.medium")}</option>
                <option value="High">{t("wave.tier.high")}</option>
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-xs text-vx-text focus:outline-none focus:border-vx-sage/50"
              >
                <option value="all">{t("wave.issues.allStatuses")}</option>
                <option value="Completed">{t("wave.status.completed")}</option>
                <option value="In Progress">{t("wave.status.inProgress")}</option>
                <option value="Open">{t("wave.status.open")}</option>
              </select>

              <label className="flex items-center gap-2 text-xs text-vx-text">
                <input
                  type="checkbox"
                  checked={goodFirstOnly}
                  onChange={(e) => setGoodFirstOnly(e.target.checked)}
                  className="accent-vx-sage focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
                />
                Good first issues only
              </label>
            </div>
          </div>

          {/* Issues table */}
          <div className="divide-y divide-vx-line overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-vx-surface/20 text-vx-muted uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.id")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.title")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.category")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.complexity")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.points")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.status")}</th>
                  <th className="px-5 py-3 font-semibold">{t("wave.issues.col.contributor")}</th>
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
                      {issue.goodFirstIssue && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-vx-sage-bg text-vx-sage border border-vx-sage/20">
                          Good first issue
                        </span>
                      )}
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
                        {t(TIER_NAME_KEY[issue.complexity])}
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
                        {t(STATUS_LABEL_KEY[issue.status])}
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
