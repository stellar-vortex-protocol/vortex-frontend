"use client";

import { useEffect, useState } from "react";
import { getRealtimeDebugInfo, type RealtimeDebugInfo } from "@/lib/realtime/manager";

/**
 * Dev-only overlay listing realtime connections and per-topic subscriber
 * counts. Enabled with `?debug=realtime`; renders nothing in production.
 * Developer tooling only, so its text is intentionally not localised.
 */
export function RealtimeDebugOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [info, setInfo] = useState<RealtimeDebugInfo[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    setEnabled(new URLSearchParams(window.location.search).get("debug") === "realtime");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const tick = () => setInfo(getRealtimeDebugInfo());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <aside
      aria-label="Realtime debug"
      className="fixed bottom-2 left-2 z-[300] max-w-sm rounded-lg border border-vx-sage/40 bg-vx-card p-3 text-xs text-vx-text shadow-lg"
    >
      <p className="mb-1 font-semibold">realtime ({info.length} connection{info.length === 1 ? "" : "s"})</p>
      {info.map((c) => (
        <div key={c.url} className="num break-all">
          <div>
            {c.url} — <strong>{c.state}</strong>
          </div>
          <ul className="pl-3">
            {Object.entries(c.subscribers).map(([topic, n]) => (
              <li key={topic}>
                {topic}: {n}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
}
