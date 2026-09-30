"use client";

import { useState } from "react";
import { Nav } from "@/components/Nav";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useWalletStore } from "@/store/wallet";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import {
  getSupportRequests,
  JUSTIFICATION_MAX_LENGTH,
  NAME_MAX_LENGTH,
  submitSupportRequest,
  upvoteSupportRequest,
  type SubmitError,
  type SupportRequestKind,
} from "@/lib/supportRequestStore";

const SUBMIT_ERROR_KEY: Record<SubmitError, MessageKey> = {
  "name-length": "requests.error.nameLength",
  "justification-length": "requests.error.justificationLength",
  "already-supported": "requests.error.alreadySupported",
  duplicate: "requests.error.duplicate",
};

export default function RequestsPageClient() {
  const { t } = useTranslation();
  const { isConnected, address } = useWalletStore();
  const [requests, setRequests] = useState(getSupportRequests);
  const [kind, setKind] = useState<SupportRequestKind>("chain");
  const [name, setName] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => setRequests(getSupportRequests());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    const result = submitSupportRequest(address, { kind, name, justification });
    if (!result.ok) {
      setError(t(SUBMIT_ERROR_KEY[result.error], { name: name.trim() }));
      return;
    }
    setError(null);
    setName("");
    setJustification("");
    refresh();
  };

  const handleUpvote = (id: string) => {
    if (!address) return;
    upvoteSupportRequest(id, address);
    refresh();
  };

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("requests.nav")} />

      <main id="main-content" className="max-w-3xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-8">
        <header>
          <div className="eyebrow mb-2 text-xs">{t("requests.eyebrow")}</div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-2">{t("requests.title")}</h1>
          <p className="text-vx-muted text-xs sm:text-sm leading-relaxed">{t("requests.description")}</p>
          <p className="text-[11px] text-vx-dim mt-2">{t("requests.mockNotice")}</p>
        </header>

        <section aria-labelledby="request-form-heading" className="card p-5 sm:p-6">
          <h2 id="request-form-heading" className="text-sm font-semibold text-vx-text mb-4">
            {t("requests.form.heading")}
          </h2>
          {!isConnected || !address ? (
            <div className="text-center space-y-3">
              <p className="text-xs sm:text-sm text-vx-muted">{t("requests.connectToSubmit")}</p>
              <div className="flex justify-center">
                <ConnectWalletButton />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-3">
              <fieldset className="flex gap-4 text-xs text-vx-text">
                <legend className="sr-only">{t("requests.form.kind")}</legend>
                {(["chain", "token"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="request-kind"
                      value={k}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                      className="accent-vx-sage"
                    />
                    {t(k === "chain" ? "requests.kind.chain" : "requests.kind.token")}
                  </label>
                ))}
              </fieldset>
              <div>
                <label htmlFor="request-name" className="block text-xs text-vx-muted mb-1">
                  {t("requests.form.name")}
                </label>
                <input
                  id="request-name"
                  value={name}
                  maxLength={NAME_MAX_LENGTH}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-vx-surface border border-vx-border rounded-md px-3 py-2 text-sm text-vx-text focus:outline-none focus:border-vx-sage/50"
                />
              </div>
              <div>
                <label htmlFor="request-justification" className="block text-xs text-vx-muted mb-1">
                  {t("requests.form.justification")}
                </label>
                <textarea
                  id="request-justification"
                  value={justification}
                  maxLength={JUSTIFICATION_MAX_LENGTH}
                  rows={3}
                  onChange={(e) => setJustification(e.target.value)}
                  aria-describedby="request-justification-count"
                  className="w-full bg-vx-surface border border-vx-border rounded-md px-3 py-2 text-sm text-vx-text focus:outline-none focus:border-vx-sage/50"
                />
                <p id="request-justification-count" className="text-[10px] text-vx-dim text-right">
                  {t("requests.form.count", { current: justification.length, max: JUSTIFICATION_MAX_LENGTH })}
                </p>
              </div>
              {error && (
                <p role="alert" className="text-xs text-red-400">
                  {error}
                </p>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg border border-vx-sage/40 bg-vx-sage-bg text-xs font-semibold text-vx-sage hover:bg-vx-sage/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
              >
                {t("requests.form.submit")}
              </button>
            </form>
          )}
        </section>

        <section aria-labelledby="request-list-heading">
          <h2 id="request-list-heading" className="text-sm font-semibold text-vx-text mb-3">
            {t("requests.list.heading")}
          </h2>
          {requests.length === 0 ? (
            <p className="text-xs text-vx-muted">{t("requests.list.empty")}</p>
          ) : (
            <ol className="space-y-2">
              {requests.map((request) => {
                const upvoted = Boolean(address && request.upvoters.includes(address));
                return (
                  <li key={request.id} className="card p-4 flex items-start gap-4">
                    <button
                      type="button"
                      onClick={() => handleUpvote(request.id)}
                      disabled={!isConnected || !address || upvoted}
                      aria-pressed={upvoted}
                      aria-label={t("requests.list.upvote", { name: request.name, count: request.upvoters.length })}
                      className="flex flex-col items-center min-w-12 px-2 py-1.5 rounded-lg border border-vx-border text-vx-text disabled:opacity-60 enabled:hover:border-vx-sage/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage aria-pressed:border-vx-sage/50 aria-pressed:text-vx-sage"
                    >
                      <span aria-hidden="true">▲</span>
                      <span className="text-sm font-semibold num">{request.upvoters.length}</span>
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-vx-text">{request.name}</span>
                        <span className="chip bg-vx-surface text-vx-muted text-[10px]">
                          {t(request.kind === "chain" ? "requests.kind.chain" : "requests.kind.token")}
                        </span>
                      </div>
                      <p className="text-xs text-vx-muted mt-1 break-words">{request.justification}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
