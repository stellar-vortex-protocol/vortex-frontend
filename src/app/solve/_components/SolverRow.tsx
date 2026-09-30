import Link from "next/link";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { usdCompact } from "@/lib/format";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { Solver } from "@/lib/types";

function Stat({ value, label, className = "text-vx-text" }: { value: string; label: string; className?: string }) {
  return (
    <div>
      <div className={`num text-xs sm:text-sm font-semibold ${className}`}>{value}</div>
      <div className="eyebrow text-[10px] sm:text-xs">{label}</div>
    </div>
  );
}

export function SolverRow({ solver, rank }: { solver: Solver; rank: number }) {
  const { t } = useTranslation();
  return (
    <Link
      href={`/solve/${solver.address}`}
      className="block px-3 sm:px-5 py-4 hover:bg-vx-surface/30 transition-colors"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="num text-base sm:text-lg font-bold text-vx-dim flex-shrink-0">
            {String(rank).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-vx-text truncate">{sanitizeDisplayText(solver.name)}</div>
            <div className="num text-xs text-vx-muted truncate">{solver.address}</div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {solver.chains.map((chain) => (
                <span key={chain} className="text-[10px] px-1.5 py-0.5 bg-vx-surface rounded text-vx-muted">
                  {chain}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-6">
          <Stat value={String(solver.fills)} label={t("solve.leaderboard.fills")} />
          <Stat value={usdCompact(solver.volumeUsd)} label={t("solve.leaderboard.volume")} />
          <Stat value={`${solver.avgFillTimeSeconds}s`} label={t("solve.leaderboard.avgTime")} />
          <Stat
            value={`${solver.successRatePct}%`}
            label={t("solve.leaderboard.success")}
            className={solver.successRatePct > 99 ? "text-vx-sage" : "text-vx-amber"}
          />
        </div>
      </div>
    </Link>
  );
}
