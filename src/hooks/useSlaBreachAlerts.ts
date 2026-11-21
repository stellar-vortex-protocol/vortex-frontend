import { useCallback, useEffect, useRef } from "react";
import { SLA_THRESHOLDS, type SlaPanelData } from "@/lib/analytics";
import { dispatchNotification } from "@/lib/notifications/dispatcher";
import {
  buildSlaBreachIntent,
  detectSlaBreachTransitions,
  type SlaPassState,
} from "@/lib/notifications/slaBreach";
import { useNotificationPreferences } from "@/store/notificationPreferences";

/**
 * Emit one in-app notification per pass→fail SLA percentile transition.
 * Sustained failures are suppressed; quiet hours and channel preferences are
 * honoured by the dispatcher's `decideChannels`.
 */
export function useSlaBreachAlerts(data: SlaPanelData | null | undefined): void {
  const prefs = useNotificationPreferences();
  const previousRef = useRef<SlaPassState | null>(null);

  const check = useCallback(
    (sla: SlaPassState) => {
      const transitions = detectSlaBreachTransitions(previousRef.current, sla);
      previousRef.current = { ...sla };
      if (transitions.length === 0) return;
      const intent = buildSlaBreachIntent(
        transitions,
        data?.percentiles ?? { p50: 0, p90: 0, p99: 0 },
        {
          p50: SLA_THRESHOLDS.p50MaxSeconds,
          p90: SLA_THRESHOLDS.p90MaxSeconds,
          p99: SLA_THRESHOLDS.p99MaxSeconds,
        },
      );
      if (intent) dispatchNotification(prefs, intent);
    },
    [data?.percentiles, prefs],
  );

  const sla = data?.sla;
  useEffect(() => {
    if (!sla) return;
    check(sla);
  }, [sla, check]);
}
