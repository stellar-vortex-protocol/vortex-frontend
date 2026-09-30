import { Nav } from "@/components/Nav";

/**
 * Next.js loading UI for /governance — shown while proposals are fetching.
 * Issue #469.
 */
export default function GovernanceLoading() {
  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Governance" />
      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <div className="h-3 w-24 rounded bg-vx-surface/60 animate-pulse mb-3" />
          <div className="h-8 w-64 rounded bg-vx-surface/60 animate-pulse mb-3" />
          <div className="h-4 w-80 rounded bg-vx-surface/40 animate-pulse" />
        </div>

        {/* Filter button skeletons */}
        <div className="flex gap-2 mb-6">
          {[..."allac"].map((_, i) => (
            <div
              key={i}
              className="h-7 w-16 rounded-lg bg-vx-surface/60 animate-pulse"
            />
          ))}
        </div>

        {/* Proposal card skeletons */}
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-4 w-12 rounded bg-vx-surface/60 animate-pulse" />
                <div className="h-4 w-24 rounded bg-vx-surface/40 animate-pulse" />
              </div>
              <div className="h-5 w-3/4 rounded bg-vx-surface/60 animate-pulse" />
              <div className="h-4 w-full rounded bg-vx-surface/40 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-vx-surface/30 animate-pulse" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
