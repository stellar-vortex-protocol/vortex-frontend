import { Suspense } from "react";
import SolvePageClient from "./SolvePageClient";

// Suspense is required because the solver portal syncs its state to the URL
// via useSearchParams (Next.js 14).
export default function SolvePage() {
  return (
    <Suspense fallback={null}>
      <SolvePageClient />
    </Suspense>
  );
}
