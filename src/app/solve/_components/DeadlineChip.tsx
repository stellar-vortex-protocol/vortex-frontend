"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function DeadlineChip({ deadline }: { deadline: number }) {
  const t = useTranslations("solve");
  const [now, setNow] = useState(() => Date.now());

  const expired = deadline <= now;

  useEffect(() => {
    if (deadline <= Date.now()) return;

    const id = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (deadline <= current) clearInterval(id);
    }, 1000);

    return () => clearInterval(id);
  }, [deadline]);

  if (expired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
        {t("deadline.expired")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
      {formatRemaining(deadline - now)}
    </span>
  );
}
