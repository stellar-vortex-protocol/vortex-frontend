import type { Solver } from "@/lib/types";
import { formatCurrency, toBCP47 } from "@/lib/format";
import { useLocale } from "@/lib/i18n/I18nProvider";

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

export function SolverHeaderCard({ solver }: { solver: Solver }) {
  const locale = useLocale();
  const usdCompact = (value: number) =>
    formatCurrency(value, toBCP47(locale), {
      notation: "compact",
      maximumFractionDigits: 1,
    });

  return (
    <div className="card p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div>
          <div className="eyebrow mb-1 sm:mb-2 text-xs">Solver</div>
          <h1 className="text-lg sm:text-2xl font-bold text-vx-text break-words">
            {solver.name}
          </h1>
        </div>
        <div
          className={`flex-shrink-0 px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${
            solver.status === "active"
              ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
              : "bg-vx-surface text-vx-muted border-vx-border"
          }`}
          aria-label={`Solver status: ${solver.status}`}
        >
          {solver.status === "active" ? "Active" : "Inactive"}
        </div>
      </div>

      <div className="text-xs sm:text-sm text-vx-muted font-mono break-all">
        Address: {truncateAddress(solver.address)}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-vx-surface/40 rounded-lg p-3">
          <div className="eyebrow text-[10px] sm:text-xs mb-1">Bond</div>
          <div className="num text-xs sm:text-sm font-semibold text-vx-text">
            {usdCompact(solver.bondUsd)}
          </div>
        </div>
        <div className="bg-vx-surface/40 rounded-lg p-3">
          <div className="eyebrow text-[10px] sm:text-xs mb-1">Status</div>
          <div className="flex items-center">
            <div
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                solver.status === "active"
                  ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                  : "bg-red-500/10 text-red-300 border-red-500/30"
              }`}
            >
              {solver.status}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
