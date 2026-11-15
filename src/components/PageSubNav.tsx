import { ArrowLeft } from 'lucide-react';
import { PageRoute } from '../siteConfig';

interface PageSubNavProps {
  currentPage: Exclude<PageRoute, 'home'>;
  onNavigate: (page: PageRoute) => void;
}

const PAGE_LABELS: Record<Exclude<PageRoute, 'home'>, string> = {
  announcements: 'Official Advisories & Memoranda',
  events: 'Campus Events Gallery',
  officers: 'Council Officers Archive',
  forum: 'Student Assembly Forum',
  faq: 'Student Handbook & FAQ',
  admin: 'SSC Suite',
};

/**
 * Clean, aligned single-line breadcrumb bar for inner portal pages.
 * Uses plain text metadata with zero redundant colored boxes.
 */
export function PageSubNav({ currentPage, onNavigate }: PageSubNavProps) {
  const label = PAGE_LABELS[currentPage];

  return (
    <nav
      aria-label="Breadcrumb"
      className="pb-4 mb-6 border-b border-white/[0.14] flex flex-wrap items-center justify-between gap-3 text-xs"
    >
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-1.5 font-semibold text-[#3ddc97] hover:underline cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Back to Home</span>
      </button>

      <div className="flex items-center gap-2 text-[#949ba8] tabular-nums">
        <span>{label}</span>
      </div>
    </nav>
  );
}
