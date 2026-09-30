import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Read/write URL query parameters (same pattern as the explore page). Empty
 * strings and `null` remove the key so default state keeps a clean URL.
 * `push` adds a history entry (so the browser back button steps back);
 * the default `replace` does not.
 */
export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const update = useCallback(
    (updates: Record<string, string | null>, mode: "replace" | "push" = "replace") => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      const href = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return { params: searchParams, update };
}
