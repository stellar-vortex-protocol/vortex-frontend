/**
 * /explore — dynamically imported to keep it out of the initial homepage
 * bundle. The skeleton fallback renders immediately while the chunk loads,
 * matching the in-page loading skeleton used once the data hook resolves.
 */
import dynamic from "next/dynamic";
import { SkeletonCard } from "@/components/Skeleton";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

const ExplorePageClient = dynamic(() => import("./ExplorePageClient"), {
  loading: () => (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Explore" />
      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8">
          <div className="h-3 w-24 bg-vx-surface/40 rounded animate-pulse mb-3" />
          <div className="h-8 w-52 bg-vx-surface/40 rounded animate-pulse mb-3" />
          <div className="h-4 w-80 bg-vx-surface/40 rounded animate-pulse" />
        </div>
        <SkeletonCard rows={6} rowHeight="h-14" />
      </main>
      <Footer />
    </div>
  ),
  ssr: false,
});

export default function ExplorePage() {
  return <ExplorePageClient />;
}
