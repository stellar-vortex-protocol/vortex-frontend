"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SwapCard } from "@/components/SwapCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CHAINS } from "@/lib/marketData";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/index";

// ─── Intent Pipeline Visualization ────────────────────────────────────────────

const STAGES: { labelKey: MessageKey; subKey: MessageKey; color: string }[] = [
  { labelKey: "home.pipeline.intent.label",  subKey: "home.pipeline.intent.sub",  color: "#A78BFA" },
  { labelKey: "home.pipeline.auction.label", subKey: "home.pipeline.auction.sub", color: "#60A5FA" },
  { labelKey: "home.pipeline.relay.label",   subKey: "home.pipeline.relay.sub",   color: "#4CEBA8" },
  { labelKey: "home.pipeline.settle.label",  subKey: "home.pipeline.settle.sub",  color: "#4CEBA8" },
];

function IntentPipeline() {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-0">
      {STAGES.map((s, i) => (
        <div key={s.labelKey} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center border-2"
                 style={{ borderColor: s.color, background: `${s.color}15` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            </div>
            <div className="text-center">
              <div className="text-[11px] font-semibold text-vx-text">{t(s.labelKey)}</div>
              <div className="text-[10px] text-vx-muted">{t(s.subKey)}</div>
            </div>
          </div>
          {i < STAGES.length - 1 && (
            <div className="w-12 mb-5 mx-1">
              <svg aria-hidden="true" viewBox="0 0 48 4" className="w-full">
                <line x1="0" y1="2" x2="48" y2="2"
                      stroke="rgba(76,235,168,0.3)"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      className="intent-flow-line" />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { t } = useTranslation();

  // Values stay literal here: locale-aware number formatting is tracked separately.
  const stats: { labelKey: MessageKey; value: string }[] = [
    { labelKey: "home.stats.totalVolume", value: "$4.2M" },
    { labelKey: "home.stats.intentsFilled", value: "2,270" },
    { labelKey: "home.stats.activeSolvers", value: "3" },
    { labelKey: "home.stats.avgFillTime", value: "42s" },
  ];

  return (
    <div className="min-h-screen">
      {/* ── Nav ── */}
      <Nav variant="home" />

      {/* ── Main layout ── */}
      <main id="main-content" className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid lg:grid-cols-[1fr_420px] gap-10 items-start">

          {/* Left: copy + pipeline + feed */}
          <div className="space-y-10">
            {/* Hero text */}
            <div>
              <div className="eyebrow mb-4">{t("home.hero.eyebrow")}</div>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-vx-text mb-4">
                {t("home.hero.titleLine1")}<br />
                <span className="text-vx-sage">{t("home.hero.titleLine2")}</span>
              </h1>
              <p className="text-base text-vx-muted leading-relaxed max-w-md">
                {t("home.hero.body")}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-3">
              {stats.map(s => (
                <div key={s.labelKey} className="card-sm px-4 py-3">
                  <div className="num text-xl font-semibold text-vx-text">{s.value}</div>
                  <div className="eyebrow mt-0.5">{t(s.labelKey)}</div>
                </div>
              ))}
            </div>

            {/* Intent pipeline */}
            <div className="space-y-4">
              <div className="eyebrow">{t("home.pipeline.title")}</div>
              <IntentPipeline />
            </div>

            {/* Live feed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="eyebrow">{t("home.feed.title")}</div>
                <Link href="/explore" className="text-xs text-vx-sage hover:underline">
                  {t("home.feed.viewAll")}
                </Link>
              </div>
              <ActivityFeed />
            </div>
          </div>

          {/* Right: swap card */}
          <div className="lg:sticky lg:top-24">
            <SwapCard />

            {/* Supported chains */}
            <div className="mt-5">
              <div className="eyebrow mb-3">{t("home.chains.title")}</div>
              <div className="flex flex-wrap gap-2">
                {CHAINS.map(c => (
                  <div key={c.id}
                       className="flex items-center gap-1.5 px-2.5 py-1.5 bg-vx-surface rounded-lg border border-vx-border">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                    <span className="text-xs text-vx-muted">{c.name}</span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-vx-sage-bg rounded-lg border border-vx-sage/20">
                  <span aria-hidden="true" className="w-2 h-2 rounded-full bg-vx-sage" />
                  <span className="text-xs text-vx-sage font-medium">
                    {t("home.chains.stellarDestination")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <Footer />
    </div>
  );
}
