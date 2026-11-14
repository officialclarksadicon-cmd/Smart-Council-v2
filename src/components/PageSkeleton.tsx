import { PageRoute } from '../siteConfig';

interface PageSkeletonProps {
  page: PageRoute;
}

/**
 * FACEBOOK-STYLE CONTENT SILHOUETTE (SKELETON SHIMMER) LOADING PAGE
 * Displays animated shimmer silhouettes matching the layout of each portal page
 * during initial website boot, page transitions, and user-triggered refreshes.
 */
export function PageSkeleton({ page }: PageSkeletonProps) {
  if (page === 'home') {
    return (
      <div
        role="status"
        aria-label="Loading Smart Council home page"
        className="w-full py-12 sm:py-16 space-y-12"
      >
        {/* Hero Silhouette */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl flex flex-col items-center text-center space-y-4">
            <div className="skeleton-shimmer h-4 w-36 rounded-full" />
            <div className="skeleton-shimmer h-11 sm:h-14 w-full max-w-xl rounded-2xl" />
            <div className="skeleton-shimmer h-11 sm:h-14 w-4/5 rounded-2xl" />
            <div className="skeleton-shimmer h-5 w-3/4 rounded-lg mt-2" />
            <div className="flex items-center gap-3 pt-4">
              <div className="skeleton-shimmer h-11 w-44 rounded-lg" />
              <div className="skeleton-shimmer h-11 w-36 rounded-lg" />
            </div>
          </div>

          {/* 3-Card Highlights Row Silhouette */}
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="skeleton-shimmer h-3.5 w-28 rounded-md" />
                  <div className="skeleton-shimmer h-4 w-4 rounded-md" />
                </div>
                <div className="space-y-2">
                  <div className="skeleton-shimmer h-5 w-full rounded-md" />
                  <div className="skeleton-shimmer h-5 w-2/3 rounded-md" />
                </div>
                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                  <div className="skeleton-shimmer h-3.5 w-20 rounded-md" />
                  <div className="skeleton-shimmer h-3.5 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Officers Showcase Silhouette */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
              <div className="skeleton-shimmer h-5 w-40 rounded-md" />
              <div className="flex items-center gap-2">
                <div className="skeleton-shimmer h-9 w-9 rounded-lg" />
                <div className="skeleton-shimmer h-9 w-9 rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {[0, 1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className={`aspect-[3/4] rounded-xl border border-white/[0.08] bg-[#0b0e15] p-3.5 flex flex-col justify-end space-y-2 ${
                    idx >= 2 ? 'hidden sm:flex' : 'flex'
                  }`}
                >
                  <div className="skeleton-shimmer h-3 w-20 rounded-md" />
                  <div className="skeleton-shimmer h-4 w-32 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* About SLAC Card Silhouette */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-4">
              <div className="skeleton-shimmer h-3.5 w-28 rounded-md" />
              <div className="skeleton-shimmer h-9 w-4/5 rounded-xl" />
              <div className="skeleton-shimmer h-4 w-full rounded-md" />
              <div className="skeleton-shimmer h-4 w-2/3 rounded-md" />
              <div className="pt-4 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-shimmer h-10 w-full rounded-lg" />
                ))}
              </div>
            </div>
            <div className="lg:col-span-5">
              <div className="skeleton-shimmer h-60 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (page === 'events') {
    return (
      <div
        role="status"
        aria-label="Loading upcoming events"
        className="w-full py-6 lg:py-8"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-5">
          <div className="pb-5 border-b border-white/[0.08] space-y-2.5">
            <div className="skeleton-shimmer h-3.5 w-32 rounded-md" />
            <div className="skeleton-shimmer h-9 w-72 rounded-xl" />
            <div className="skeleton-shimmer h-4 w-96 max-w-full rounded-md" />
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-9 w-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-white/[0.08] bg-[#121620] overflow-hidden"
              >
                <div className="skeleton-shimmer aspect-[4/3] w-full" />
                <div className="p-6 space-y-3">
                  <div className="skeleton-shimmer h-3.5 w-24 rounded-md" />
                  <div className="skeleton-shimmer h-6 w-3/4 rounded-lg" />
                  <div className="skeleton-shimmer h-4 w-full rounded-md" />
                  <div className="skeleton-shimmer h-4 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Loading page content"
      className="w-full py-6 lg:py-8"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-5">
        <div className="pb-5 border-b border-white/[0.08] space-y-2.5">
          <div className="skeleton-shimmer h-3.5 w-32 rounded-md" />
          <div className="skeleton-shimmer h-9 w-64 rounded-xl" />
          <div className="skeleton-shimmer h-4 w-80 max-w-full rounded-md" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton-shimmer h-9 w-24 rounded-lg" />
            ))}
          </div>
          <div className="skeleton-shimmer h-10 w-64 rounded-xl" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/[0.08] bg-[#121620] overflow-hidden"
            >
              {idx === 0 && (
                <div className="skeleton-shimmer aspect-[21/9] w-full" />
              )}
              <div className="p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="skeleton-shimmer h-3.5 w-24 rounded-md" />
                  <div className="skeleton-shimmer h-3.5 w-20 rounded-md" />
                </div>
                <div className="skeleton-shimmer h-6 w-3/4 rounded-lg" />
                <div className="skeleton-shimmer h-4 w-full rounded-md" />
                <div className="skeleton-shimmer h-4 w-5/6 rounded-md" />
                <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between">
                  <div className="skeleton-shimmer h-3.5 w-36 rounded-md" />
                  <div className="skeleton-shimmer h-9 w-28 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
