import { Suspense } from "react";
import { ComparePageClient } from "./ComparePageClient";

// useSearchParams requires a Suspense boundary for static rendering.
export default function SolverComparePage() {
  return (
    <Suspense fallback={null}>
      <ComparePageClient />
    </Suspense>
  );
}
