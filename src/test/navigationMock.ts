import { useSyncExternalStore } from "react";

/**
 * In-memory stand-in for `next/navigation` so URL-synced UI (filters, tabs,
 * wizard steps) re-renders in tests. Usage:
 *
 *   vi.mock("next/navigation", async () => (await import("@/test/navigationMock")).navigationMock);
 */
const listeners = new Set<() => void>();
let current = new URLSearchParams();
export const history: string[] = [];

function apply(href: string) {
  const qs = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
  current = new URLSearchParams(qs);
  history.push(href);
  listeners.forEach((l) => l());
}

export function setSearch(qs: string) {
  current = new URLSearchParams(qs);
  history.length = 0;
  listeners.forEach((l) => l());
}

export function getSearch(): URLSearchParams {
  return current;
}

const router = { replace: apply, push: apply, back: () => {}, refresh: () => {}, prefetch: () => {} };

export const navigationMock = {
  useRouter: () => router,
  usePathname: () => "/solve",
  useSearchParams: () =>
    useSyncExternalStore(
      (l) => {
        listeners.add(l);
        return () => listeners.delete(l);
      },
      () => current,
      () => current,
    ),
};
