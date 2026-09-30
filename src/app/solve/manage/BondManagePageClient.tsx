"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useBondManagement } from "@/hooks/useBondManagement";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { checkBondAmount, MAX_TOP_UP, thresholdStatus, type BondAmountError } from "@/lib/bond/validation";
import type { BondOperationKind, BondState } from "@/lib/bond/types";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { useWalletStore } from "@/store/wallet";

const ERROR_KEY: Record<BondAmountError, MessageKey> = {
  invalid: "bond.error.invalid",
  zero: "bond.error.zero",
  tooLarge: "bond.error.tooLarge",
  exceedsAvailable: "bond.error.exceedsAvailable",
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function AmountForm({
  kind,
  bond,
  busy,
  onSubmit,
}: {
  kind: BondOperationKind;
  bond: BondState;
  busy: boolean;
  onSubmit: (amount: string) => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const id = `bond-${kind}`;
  const check = amount ? checkBondAmount(kind, amount, bond) : null;
  const needsConfirm = Boolean(check?.dropsBelowMinimum);
  const canSubmit = Boolean(check && !check.error && (!needsConfirm || confirmed)) && !busy;

  return (
    <form
      className="card p-4 sm:p-5 space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!canSubmit) return;
        if (await onSubmit(amount.trim())) {
          setAmount("");
          setConfirmed(false);
        }
      }}
    >
      <h2 className="text-sm font-semibold text-vx-text">
        {t(kind === "top-up" ? "bond.topUp.title" : "bond.withdraw.title")}
      </h2>
      <label htmlFor={id} className="eyebrow block text-xs">
        {t("bond.amountLabel")}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={amount}
        onChange={(e) => {
          setAmount(e.target.value);
          setConfirmed(false);
        }}
        placeholder={kind === "top-up" ? `≤ ${MAX_TOP_UP}` : `≤ ${bond.available}`}
        aria-invalid={Boolean(check?.error)}
        aria-describedby={check?.error ? `${id}-error` : undefined}
        className="w-full bg-vx-surface border border-vx-border rounded-lg px-3 py-2.5 text-sm text-vx-text focus:outline-none focus:ring-2 focus:ring-vx-sage"
      />
      {check?.error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-red-400">
          {t(ERROR_KEY[check.error], { max: MAX_TOP_UP, available: bond.available })}
        </p>
      )}
      {needsConfirm && (
        <div role="alert" className="rounded-lg border border-vx-amber/40 bg-vx-amber/10 p-3 text-xs text-vx-amber space-y-2">
          <p>{t("bond.withdraw.belowMinWarning", { minimum: bond.minimumBond })}</p>
          <label className="flex items-center gap-2 text-vx-text">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {t("bond.withdraw.confirmBelowMin")}
          </label>
        </div>
      )}
      {kind === "withdrawal" && (
        <p className="text-xs text-vx-muted">
          {t("bond.withdraw.cooldownNote", { minutes: Math.ceil(bond.cooldownSeconds / 60) })}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSubmit}
        aria-busy={busy}
        className="w-full py-2.5 bg-vx-sage-bg text-vx-sage text-xs font-semibold rounded-lg border border-vx-sage/30 hover:bg-vx-sage/15 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t(kind === "top-up" ? "bond.topUp.submit" : "bond.withdraw.submit")}
      </button>
    </form>
  );
}

export default function BondManagePageClient() {
  const { t } = useTranslation();
  const address = useWalletStore((s) => s.address);
  const connect = useWalletStore((s) => s.connect);
  const networkMismatch = useWalletStore((s) => s.networkMismatch);
  const manager = useBondManagement(address);
  // Ticks each second so cooldowns count down and flip to "ready" while the page is open.
  const now = useLiveRelativeTime(1000);
  const busy = !["idle", "success", "error"].includes(manager.status);
  const bond = manager.bond;

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("bond.nav.label")} />
      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12 space-y-6">
        <h1 className="text-2xl font-bold text-vx-text">{t("bond.title")}</h1>

        {!address ? (
          <div className="card p-6 text-sm text-vx-muted space-y-3">
            <p>{t("bond.connectPrompt")}</p>
            <button type="button" onClick={() => void connect()} className="text-vx-sage hover:underline">
              {t("commands.wallet.connect")}
            </button>
          </div>
        ) : manager.loadError ? (
          <div role="alert" className="card p-6 text-sm text-vx-muted">
            {t("bond.loadError")}
          </div>
        ) : !bond ? (
          <div className="card p-6 h-32 animate-pulse" aria-busy="true" />
        ) : (
          <>
            {networkMismatch && (
              <p role="alert" className="text-xs text-vx-amber">
                {t("bond.networkMismatch")}
              </p>
            )}
            <dl className="card p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {(
                [
                  ["bond.stat.bond", bond.bond],
                  ["bond.stat.locked", bond.locked],
                  ["bond.stat.available", bond.available],
                  ["bond.stat.minimum", bond.minimumBond],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="eyebrow text-[10px]">{t(label)}</dt>
                  <dd className="num text-sm font-semibold text-vx-text">{value} USDC</dd>
                </div>
              ))}
              <div className="col-span-full">
                <span
                  className={`chip text-[11px] ${
                    thresholdStatus(bond) === "ok" ? "bg-vx-sage-bg text-vx-sage" : "bg-vx-amber/10 text-vx-amber"
                  }`}
                >
                  {t(thresholdStatus(bond) === "ok" ? "bond.status.ok" : "bond.status.belowMin")}
                </span>
              </div>
            </dl>

            <section className="card p-5 space-y-2" aria-labelledby="pending-withdrawals">
              <h2 id="pending-withdrawals" className="text-sm font-semibold text-vx-text">
                {t("bond.pending.title")}
              </h2>
              {bond.pendingWithdrawals.length === 0 ? (
                <p className="text-xs text-vx-muted">{t("bond.pending.empty")}</p>
              ) : (
                <ul className="divide-y divide-vx-line">
                  {bond.pendingWithdrawals.map((w) => {
                    const remaining = new Date(w.availableAt).getTime() - now;
                    return (
                      <li key={w.id} className="flex items-center justify-between py-2 text-xs">
                        <span className="num text-vx-text">{w.amount} USDC</span>
                        <span className={remaining > 0 ? "text-vx-muted" : "text-vx-sage"}>
                          {remaining > 0
                            ? t("bond.pending.cooldown", { time: formatCountdown(remaining) })
                            : t("bond.pending.ready")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {manager.error && (
              <p role="alert" className="text-xs text-red-400">
                {manager.error}
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <AmountForm kind="top-up" bond={bond} busy={busy || networkMismatch} onSubmit={manager.topUp} />
              <AmountForm kind="withdrawal" bond={bond} busy={busy || networkMismatch} onSubmit={manager.requestWithdrawal} />
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
