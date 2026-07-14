import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Not Found" />

      <main id="main-content" className="max-w-2xl mx-auto px-5 py-24 text-center">
        <div className="eyebrow mb-3">404</div>
        <h1 className="text-3xl font-bold text-vx-text mb-3">Page not found</h1>
        <p className="text-vx-muted text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist, or may have moved.
        </p>
        <Link href="/" className="text-sm text-vx-sage hover:underline">
          ← Back to Vortex
        </Link>
      </main>

      <Footer />
    </div>
  );
}
