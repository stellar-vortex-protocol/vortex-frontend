"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";

export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="mt-20 border-t border-vx-border px-5 py-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-vx-muted">
        <span>{t("footer.copyright")}</span>
        <div className="flex gap-5">
          <a href="https://github.com/vortex-protocol" className="hover:text-vx-text transition-colors">
            {t("footer.github")}
          </a>
          <a href="https://discord.gg/vortex" className="hover:text-vx-text transition-colors">
            {t("footer.discord")}
          </a>
        </div>
      </div>
    </footer>
  );
}
