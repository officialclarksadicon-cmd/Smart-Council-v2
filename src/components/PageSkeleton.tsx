import { PageRoute } from '../siteConfig';

interface PageSkeletonProps {
  page: PageRoute;
}

/**
 * THEME-AWARE ARCHITECTURAL LOADING SKELETONS (ALL ROUTES)
 * Uses CSS variables (--bg-card, --bg-recessed, --border-subtle) so light and dark
 * themes never leak hardcoded dark hex colors, and mirrors each route's exact layout
 * geometry to prevent cumulative layout shift (CLS).
 */
export function PageSkeleton({ page }: PageSkeletonProps) {
  if (page === 'home') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading Smart Council home page"
        className="w-full"
      >
        {/* 1. Hero Stage Silhouette (Matches h-[650px] sm:h-[680px] lg:h-[690px]) */}
        <div className="relative w-full h-[650px] sm:h-[680px] lg:h-[690px] border-b border-[var(--border-subtle)] bg-[var(--bg-recessed)] overflow-hidden">
          <div className="mx-auto max-w-[1440px] h-full px-4 sm:px-8 lg:px-12 pt-16 pb-7 sm:pb-9 lg:py-20 flex flex-col lg:flex-row items-end lg:items-center justify-between gap-8">
            <div className="w-full max-w-[445px] space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-3.5 w-36 rounded-md skeleton-shimmer" />
                <div className="h-3.5 w-24 rounded-md skeleton-shimmer" />
              </div>
              <div className="space-y-2.5">
                <div className="h-9 sm:h-11 w-11/12 rounded-xl skeleton-shimmer" />
                <div className="h-9 sm:h-11 w-4/5 rounded-xl skeleton-shimmer" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-4 w-full rounded-md skeleton-shimmer" />
                <div className="h-4 w-3/4 rounded-md skeleton-shimmer" />
              </div>
              <div className="pt-2 flex items-center gap-2.5">
                <div className="h-[42px] w-40 rounded-lg skeleton-shimmer" />
                <div className="h-[42px] w-28 rounded-lg skeleton-shimmer" />
              </div>
            </div>

            <div className="hidden lg:flex flex-1 items-center justify-center">
              <div className="h-[380px] w-[440px] rounded-3xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/60 p-6 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-28 rounded-md skeleton-shimmer" />
                  <div className="h-6 w-6 rounded-full skeleton-shimmer" />
                </div>
                <div className="h-52 w-full rounded-2xl skeleton-shimmer" />
                <div className="h-3.5 w-48 rounded-md skeleton-shimmer mx-auto" />
              </div>
            </div>
          </div>
        </div>

        {/* 2. Campus Highlights 3-Column Boxy Grid Silhouette */}
        <div className="mx-auto max-w-[1440px] border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <div className="border-b border-[var(--border-subtle)] px-6 sm:px-10 lg:px-12 py-5 sm:py-6">
            <div className="h-7 w-48 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--border-subtle)]">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="p-6 sm:p-8 flex flex-col justify-between gap-5"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-28 rounded-md skeleton-shimmer" />
                    <div className="h-4 w-4 rounded-md skeleton-shimmer" />
                  </div>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-4 sm:p-5 space-y-2.5">
                    <div className="h-3 w-20 rounded-md skeleton-shimmer" />
                    <div className="h-5 w-11/12 rounded-md skeleton-shimmer" />
                    <div className="h-3.5 w-full rounded-md skeleton-shimmer" />
                    <div className="h-3.5 w-2/3 rounded-md skeleton-shimmer" />
                  </div>
                </div>
                <div className="pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="h-3.5 w-20 rounded-md skeleton-shimmer" />
                  <div className="h-3.5 w-24 rounded-md skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Current Officers Section Silhouette */}
        <div className="mx-auto max-w-[1440px] border-x border-b border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 sm:px-10 lg:px-12 py-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-3.5 w-28 rounded-md skeleton-shimmer" />
              <div className="h-8 w-64 rounded-lg skeleton-shimmer" />
            </div>
            <div className="h-9 w-32 rounded-lg skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-4 space-y-3"
              >
                <div className="aspect-[4/5] w-full rounded-xl skeleton-shimmer" />
                <div className="h-4 w-3/4 rounded-md skeleton-shimmer" />
                <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (page === 'admin') {
    return (
      <section
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label="Loading SSC Suite administration panel"
        className="w-full min-h-[80vh] bg-[var(--bg-canvas)] px-4 sm:px-8 lg:px-12 py-6 space-y-6"
      >
        <div className="mx-auto max-w-[1440px] space-y-6">
          <div className="h-12 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 flex items-center gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-7 w-24 rounded-lg skeleton-shimmer" />
            ))}
          </div>
          <div className="space-y-2">
            <div className="h-8 w-48 rounded-lg skeleton-shimmer" />
            <div className="h-4 w-72 rounded-md skeleton-shimmer" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 space-y-4"
              >
                <div className="h-10 w-10 rounded-xl skeleton-shimmer" />
                <div className="h-5 w-40 rounded-md skeleton-shimmer" />
                <div className="h-14 w-full rounded-xl skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={`Loading ${page} page`}
      className="w-full border-b border-[var(--border-subtle)]"
    >
      <div className="mx-auto max-w-[1440px] border-x border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        {/* Sub-Nav Bar Silhouette */}
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div className="h-8 w-28 rounded-lg skeleton-shimmer" />
          <div className="hidden sm:flex items-center gap-2">
            <div className="h-7 w-24 rounded-md skeleton-shimmer" />
            <div className="h-7 w-20 rounded-md skeleton-shimmer" />
            <div className="h-7 w-20 rounded-md skeleton-shimmer" />
          </div>
        </div>

        {/* Section Header Silhouette */}
        <div className="pb-6 border-b border-[var(--border-subtle)] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-3 w-full max-w-xl">
            <div className="h-9 sm:h-11 w-64 sm:w-80 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-full rounded-md skeleton-shimmer" />
            <div className="h-4 w-4/5 rounded-md skeleton-shimmer" />
          </div>
          <div className="h-10 w-36 rounded-lg skeleton-shimmer shrink-0" />
        </div>

        {/* Filter Bar Silhouette */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-9 w-20 rounded-lg skeleton-shimmer" />
            <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
            <div className="h-9 w-24 rounded-lg skeleton-shimmer" />
            <div className="h-9 w-28 rounded-lg skeleton-shimmer" />
          </div>
          <div className="h-10 w-full sm:w-64 rounded-xl skeleton-shimmer" />
        </div>

        {/* Route-Specific Content Grid Silhouette */}
        {page === 'officers' ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-recessed)] overflow-hidden p-4 space-y-3"
              >
                <div className="aspect-[4/5] w-full rounded-xl skeleton-shimmer" />
                <div className="h-5 w-3/4 rounded-md skeleton-shimmer" />
                <div className="h-3.5 w-1/2 rounded-md skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : page === 'faq' ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3, 4].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-5 flex items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-3.5 w-28 rounded-md skeleton-shimmer" />
                  <div className="h-5 w-4/5 rounded-md skeleton-shimmer" />
                </div>
                <div className="h-8 w-8 rounded-lg skeleton-shimmer shrink-0" />
              </div>
            ))}
          </div>
        ) : page === 'forum' ? (
          <div className="mt-6 space-y-4">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-recessed)] p-6 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full skeleton-shimmer" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-32 rounded-md skeleton-shimmer" />
                      <div className="h-3 w-24 rounded-md skeleton-shimmer" />
                    </div>
                  </div>
                  <div className="h-6 w-24 rounded-md skeleton-shimmer" />
                </div>
                <div className="h-5 w-3/4 rounded-md skeleton-shimmer" />
                <div className="h-4 w-full rounded-md skeleton-shimmer" />
                <div className="h-4 w-2/3 rounded-md skeleton-shimmer" />
                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center gap-4">
                  <div className="h-7 w-20 rounded-lg skeleton-shimmer" />
                  <div className="h-7 w-24 rounded-lg skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-recessed)] overflow-hidden flex flex-col"
              >
                <div className="h-44 w-full skeleton-shimmer" />
                <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="h-3.5 w-20 rounded-md skeleton-shimmer" />
                      <div className="h-3.5 w-16 rounded-md skeleton-shimmer" />
                    </div>
                    <div className="h-5 w-11/12 rounded-md skeleton-shimmer" />
                    <div className="h-4 w-full rounded-md skeleton-shimmer" />
                    <div className="h-4 w-3/4 rounded-md skeleton-shimmer" />
                  </div>
                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="h-3.5 w-24 rounded-md skeleton-shimmer" />
                    <div className="h-3.5 w-16 rounded-md skeleton-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
