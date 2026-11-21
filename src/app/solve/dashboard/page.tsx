"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { EmptyState } from "@/components/EmptyState";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useSolver } from "@/hooks/useSolver";
import { useIntentFeed } from "@/hooks/useIntentFeed";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { ApiError } from "@/lib/api";
import { timeRemaining } from "@/lib/time";
import { downloadCsv } from "@/lib/csv";
import { computeSolverStats, estimateEarnings, formatDecimal, parseDecimal, SOLVER_FEE_BPS } from "@/lib/solverStats";
import {
  MIN_BOND_USD,
  activeIntents,
  bondHealth,
  bondShortfall,
  buildSolverDashboardExport,
  expiringSoon,
  fillCounts,
  inactiveReasons,
  solverDashboardCsv,
} from "@/lib/solverDashboard";
import { BarChart } from "@/components/charts";

const HIDE_BALANCES_KEY = "vortex:solver-dashboard:hide-balances";
const NOTIFY_EXPIRY_KEY = "vortex:solver-dashboard:notify-expiry";
const FOCUS_RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

/** Renders a chart value with the same 7-dp digits the earnings list shows. */
function formatEarning(value: number): string {
  return formatDecimal(parseDecimal(value.toFixed(7))!);
}

/** Boolean preference persisted in localStorage (falls back to in-memory). */
function usePersistedFlag(key: string): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(false);
  useEffect(() => {
    try {
      setValue(window.localStorage.getItem(key) === "true");
    } catch {
      // Storage unavailable (private mode) — keep the default.
    }
  }, [key]);
  const update = (v: boolean) => {
    setValue(v);
    try {
      window.localStorage.setItem(key, String(v));
    } catch {
      // Ignore persistence failures; the in-memory value still applies.
    }
  };
  return [value, update];
}

function Panel({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-4 sm:p-5" aria-label={title}>
      <h2 className="eyebrow text-xs mb-3 flex items-center gap-2">
        {title}
        {badge}
      </h2>
      {children}
    </section>
  );
}

export default function SolverDashboardPage() {
  const { t } = useTranslation();
  const address = useWalletStore((s) => s.address);
  const { solver, isLoading, error } = useSolver(address);
  const { items } = useIntentFeed();
  const addToast = useToastStore((s) => s.addToast);
  const [hideBalances, setHideBalances] = usePersistedFlag(HIDE_BALANCES_KEY);
  const [notifyExpiry, setNotifyExpiry] = usePersistedFlag(NOTIFY_EXPIRY_KEY);
  const [now, setNow] = useState(() => Date.now());
  const notified = useRef(new Set<string>());
  const hiddenHintId = useId();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const active = useMemo(() => (address ? activeIntents(items, address) : []), [items, address]);
  const counts = useMemo(() => (address ? fillCounts(items, address, now) : null), [items, address, now]);
  const myFills = useMemo(() => items.filter((i) => i.solver === solver?.address), [items, solver?.address]);
  const stats30 = useMemo(() => computeSolverStats(myFills, 30, now), [myFills, now]);
  const earnings = useMemo(() => estimateEarnings(myFills), [myFills]);
  const expiring = useMemo(() => expiringSoon(active, now), [active, now]);

  const exportStats = (format: "csv" | "json") => {
    if (!solver || !counts) return;
    const data = buildSolverDashboardExport(
      {
        address: solver.address,
        bondUsd: solver.bondUsd,
        fills: counts,
        successRatePct: stats30.successRatePct,
        earnings,
      },
      new Date().toISOString(),
    );
    const stamp = data.generatedAt.slice(0, 10);
    if (format === "csv") {
      downloadCsv(`vortex-solver-dashboard-${stamp}.csv`, solverDashboardCsv(data));
    } else {
      downloadCsv(`vortex-solver-dashboard-${stamp}.json`, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
    }
  };

  useEffect(() => {
    if (!notifyExpiry) return;
    for (const intent of expiring) {
      if (notified.current.has(intent.id)) continue;
      notified.current.add(intent.id);
      addToast(t("solverDashboard.notify.expiring", { id: intent.id }), "info");
    }
  }, [expiring, notifyExpiry, addToast, t]);

  const blur = hideBalances ? "blur-sm select-none" : "";
  const notSolver = error instanceof ApiError && error.status === 404;

  let body: React.ReactNode;
  if (!address) {
    body = (
      <EmptyState
        title={t("solverDashboard.gate.connectTitle")}
        message={t("solverDashboard.gate.connectMessage")}
        action={<ConnectWalletButton />}
      />
    );
  } else if (isLoading) {
    body = <div className="card p-6 h-32 animate-pulse" aria-busy="true" />;
  } else if (notSolver || (!error && !solver)) {
    body = (
      <EmptyState
        title={t("solverDashboard.gate.notSolverTitle")}
        message={t("solverDashboard.gate.notSolverMessage")}
        action={
          <Link href="/solve" className={`text-sm text-vx-sage hover:underline rounded ${FOCUS_RING}`}>
            {t("solverDashboard.gate.register")}
          </Link>
        }
      />
    );
  } else if (error || !solver) {
    body = <EmptyState variant="error" message={t("solverDashboard.error")} />;
  } else {
    const bond = bondHealth(solver.bondUsd);
    const reasons = inactiveReasons(solver);
    body = (
      <div className="space-y-4">
        {reasons.length > 0 && (
          <div role="alert" className="card p-4 border border-vx-amber/40 text-sm text-vx-text">
            <p className="font-semibold mb-1">{t("solverDashboard.inactive.title")}</p>
            <ul className="list-disc ml-5 text-xs text-vx-muted">
              {reasons.map((r) => (
                <li key={r}>
                  {t(`solverDashboard.inactive.${r}`, { minBond: MIN_BOND_USD })}
                  {r === "bondBelowMinimum" && (
                    <Link
                      href={`/solve/manage?topUp=${bondShortfall(solver)}`}
                      className={`ml-2 font-semibold text-vx-sage hover:underline rounded ${FOCUS_RING}`}
                    >
                      {t("solverDashboard.inactive.topUpBond", { shortfall: bondShortfall(solver) })}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-4 text-xs text-vx-muted">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={hideBalances} onChange={(e) => setHideBalances(e.target.checked)} className={FOCUS_RING} />
            {t("solverDashboard.hideBalances")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notifyExpiry} onChange={(e) => setNotifyExpiry(e.target.checked)} className={FOCUS_RING} />
            {t("solverDashboard.notifyExpiry")}
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-vx-muted">
          {(["csv", "json"] as const).map((format) => (
            <button
              key={format}
              type="button"
              onClick={() => exportStats(format)}
              disabled={hideBalances}
              aria-describedby={hideBalances ? hiddenHintId : undefined}
              className={`px-3 py-2 rounded-lg border border-vx-border font-semibold hover:text-vx-text hover:border-vx-sage/40 transition-colors disabled:opacity-50 ${FOCUS_RING}`}
            >
              {t(`solverDashboard.export.${format}`)}
            </button>
          ))}
          {hideBalances && (
            <p id={hiddenHintId} className="text-vx-dim">
              {t("solverDashboard.export.hiddenHint")}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Panel title={t("solverDashboard.bond.title")}>
            <p className={`num text-lg font-semibold text-vx-text ${blur}`}>${solver.bondUsd.toLocaleString("en-US")}</p>
            <p className="text-xs text-vx-muted">
              {t(`solverDashboard.bond.${bond.level}`, { minBond: MIN_BOND_USD, ratio: bond.ratio.toFixed(2) })}
            </p>
          </Panel>

          <Panel title={t("solverDashboard.fills.title")}>
            <dl className="grid grid-cols-3 gap-2 text-center">
              {([
                ["24h", counts?.last24h],
                ["7d", counts?.last7d],
                ["30d", counts?.last30d],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-[10px] text-vx-muted">{label}</dt>
                  <dd className="num text-sm font-semibold text-vx-text">{value ?? 0}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-vx-muted mt-2">
              {t("solverDashboard.successRate", {
                rate: stats30.successRatePct === null ? "—" : `${stats30.successRatePct}%`,
              })}
            </p>
          </Panel>

          <Panel title={t("solverDashboard.earnings.title")}>
            {earnings.length === 0 ? (
              <p className="text-xs text-vx-muted">{t("solverDashboard.earnings.empty")}</p>
            ) : (
              <>
                <div className={blur}>
                  <BarChart
                    title={t("solverDashboard.earnings.chartTitle")}
                    valueLabel={t("solverDashboard.earnings.valueLabel")}
                    data={earnings.map((e) => ({ label: e.token, value: Number(e.amount) }))}
                    formatValue={formatEarning}
                    showTableLabel={t("chart.showTable")}
                    hideTableLabel={t("chart.hideTable")}
                    emptyLabel={t("chart.empty")}
                  />
                </div>
                <ul className={`space-y-1 mt-3 ${blur}`}>
                  {earnings.map((e) => (
                    <li key={e.token} className="num text-sm text-vx-text">
                      {e.amount} {e.token}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="text-[10px] text-vx-muted mt-2">{t("solverDashboard.earnings.formula", { bps: SOLVER_FEE_BPS })}</p>
          </Panel>

          <Panel
            title={t("solverDashboard.active.title")}
            badge={
              expiring.length > 0 && (
                <span className="chip bg-vx-amber/15 text-vx-amber num">
                  {t("solverDashboard.active.expiringBadge", { count: expiring.length })}
                </span>
              )
            }
          >
            {active.length === 0 ? (
              <p className="text-xs text-vx-muted">{t("solverDashboard.active.empty")}</p>
            ) : (
              <ul className="divide-y divide-vx-line">
                {active.map((i) => (
                  <li key={i.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <Link href={`/explore/${encodeURIComponent(i.id)}`} className={`text-vx-text hover:underline truncate rounded ${FOCUS_RING}`}>
                      {i.srcAmount} {i.srcToken} → {i.dstToken}
                    </Link>
                    <span className="num text-vx-muted flex-shrink-0">
                      {i.deadline ? timeRemaining(i.deadline, now) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("solverDashboard.title")} />
      <main id="main-content" className="max-w-3xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-6">
        <h1 className="text-lg sm:text-2xl font-bold text-vx-text">{t("solverDashboard.title")}</h1>
        {body}
      </main>
      <Footer />
    </div>
  );
}
