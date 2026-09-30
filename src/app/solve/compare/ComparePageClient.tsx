"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { EmptyState } from "@/components/EmptyState";
import { useSolvers } from "@/hooks/useSolvers";
import { useIntentFeed } from "@/hooks/useIntentFeed";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { sanitizeDisplayText } from "@/lib/textSafety";
import {
  COMPARE_METRICS,
  COMPARE_PARAMS,
  compareSolvers,
  coverageOverlap,
  groupByWeek,
  normalizeAddress,
  parseCompareParams,
  type CompareMetric,
} from "@/lib/solverStats";
import type { Solver } from "@/lib/types";

const DASHES = ["", "4 3", "1 3"];
const W = 280;
const H = 56;

function formatMetric(s: Solver, key: CompareMetric): string {
  switch (key) {
    case "successRatePct":
      return `${s.successRatePct}%`;
    case "avgFillTimeSeconds":
      return `${s.avgFillTimeSeconds}s`;
    case "volumeUsd":
    case "bondUsd":
      return `$${s[key].toLocaleString("en-US")}`;
    case "chains":
      return String(s.chains.length);
    default:
      return String(s[key]);
  }
}

export function ComparePageClient() {
  const { t } = useTranslation();
  const params = useSearchParams();
  const { addresses, invalid } = useMemo(
    () => parseCompareParams(COMPARE_PARAMS.map((k) => params.get(k))),
    [params],
  );
  const { solvers: all, isLoading, error } = useSolvers();
  const { items } = useIntentFeed();

  const solvers: Array<Solver | null> = useMemo(
    () => addresses.map((a) => all.find((s) => normalizeAddress(s.address) === a) ?? null),
    [addresses, all],
  );
  const result = useMemo(() => compareSolvers(solvers), [solvers]);
  const overlap = useMemo(() => coverageOverlap(solvers), [solvers]);

  const weekly = useMemo(() => {
    const series = addresses.map((a) => groupByWeek(items.filter((i) => normalizeAddress(i.solver) === a)));
    const weeks = Array.from(new Set(series.flatMap((s) => s.map((b) => b.week)))).sort();
    const max = Math.max(1, ...series.flatMap((s) => s.map((b) => b.count)));
    return { series, weeks, max };
  }, [addresses, items]);

  const cue = (key: CompareMetric, index: number) => {
    if (result[key].best.includes(index)) return <span className="text-vx-sage"> ▲ {t("compare.best")}</span>;
    if (result[key].worst.includes(index)) return <span className="text-vx-amber"> ▼ {t("compare.worst")}</span>;
    return null;
  };

  let body: React.ReactNode;
  if (addresses.length === 0) {
    body = <EmptyState variant={invalid.length ? "error" : "empty"} message={t("compare.noSelection")} />;
  } else if (isLoading && all.length === 0) {
    body = <div className="card p-6 h-40 animate-pulse" aria-busy="true" />;
  } else if (error) {
    body = <EmptyState variant="error" message={t("compare.error")} />;
  } else {
    body = (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {solvers.map((s, i) => (
            <section key={addresses[i]} className="card p-4 space-y-3" aria-label={s ? sanitizeDisplayText(s.name) : t("compare.notFound")}>
              <div className="flex items-center gap-2">
                <svg aria-hidden="true" width="24" height="6">
                  <line x1="0" y1="3" x2="24" y2="3" stroke="var(--color-vx-sage, #4ade80)" strokeWidth="2" strokeDasharray={DASHES[i]} />
                </svg>
                {s ? (
                  <Link href={`/solve/${s.address}`} className="text-sm font-semibold text-vx-text hover:underline truncate rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
                    {sanitizeDisplayText(s.name)}
                  </Link>
                ) : (
                  <span className="text-sm font-semibold text-vx-muted">{t("compare.notFound")}</span>
                )}
              </div>
              <div className="num text-[10px] text-vx-muted break-all">{addresses[i]}</div>
              {s && (
                <dl className="space-y-1 text-xs">
                  {COMPARE_METRICS.map(({ key }) => (
                    <div key={key} className="flex justify-between gap-2">
                      <dt className="text-vx-muted">{t(`compare.metric.${key}`)}</dt>
                      <dd className="num text-vx-text text-right">
                        {formatMetric(s, key)}
                        {cue(key, i)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          ))}
        </div>

        <section className="card p-4 space-y-2" aria-labelledby="compare-trend">
          <h2 id="compare-trend" className="eyebrow text-xs">{t("compare.weeklyFills")}</h2>
          {weekly.weeks.length < 2 ? (
            <p className="text-xs text-vx-muted">{t("compare.trendInsufficient")}</p>
          ) : (
            <>
              <svg aria-hidden="true" viewBox={`0 0 ${W} ${H}`} className="w-full h-16">
                {weekly.series.map((series, i) => {
                  const step = W / (weekly.weeks.length - 1);
                  const points = weekly.weeks
                    .map((wk, x) => {
                      const count = series.find((b) => b.week === wk)?.count ?? 0;
                      return `${(x * step).toFixed(1)},${(H - 2 - (count / weekly.max) * (H - 4)).toFixed(1)}`;
                    })
                    .join(" ");
                  return (
                    <polyline key={addresses[i]} points={points} fill="none" stroke="var(--color-vx-sage, #4ade80)" strokeWidth="1.5" strokeDasharray={DASHES[i]} />
                  );
                })}
              </svg>
              <table className="sr-only">
                <caption>{t("compare.weeklyFills")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t("compare.week")}</th>
                    {addresses.map((a, i) => (
                      <th key={a} scope="col">{solvers[i] ? sanitizeDisplayText(solvers[i]!.name) : a}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weekly.weeks.map((wk) => (
                    <tr key={wk}>
                      <th scope="row">{wk}</th>
                      {weekly.series.map((s, i) => (
                        <td key={addresses[i]}>{s.find((b) => b.week === wk)?.count ?? 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="card p-4" aria-labelledby="compare-overlap">
          <h2 id="compare-overlap" className="eyebrow text-xs mb-2">{t("compare.overlap")}</h2>
          <p className="text-xs text-vx-text">
            {overlap.length > 0 ? overlap.map(sanitizeDisplayText).join(", ") : t("compare.noOverlap")}
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("compare.title")} />
      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-6">
        <Link href="/solve" className="text-xs text-vx-sage hover:underline inline-block rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage">
          ← {t("compare.back")}
        </Link>
        <h1 className="text-lg sm:text-2xl font-bold text-vx-text">{t("compare.title")}</h1>
        {invalid.length > 0 && (
          <p role="alert" className="text-xs text-vx-amber">
            {t("compare.invalid", { count: invalid.length })}
          </p>
        )}
        {body}
      </main>
      <Footer />
    </div>
  );
}
