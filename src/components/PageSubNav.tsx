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
      className="pb-3.5 mb-5 border-b border-white/[0.12] flex items-center justify-between gap-4 text-xs"
    >
      <button
        type="button"
        onClick={() => onNavigate('home')}
        className="inline-flex items-center gap-1.5 py-1 font-semibold text-[#3ddc97] hover:underline shrink-0 cursor-pointer"
      >
        <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Back to Home</span>
      </button>

      <span className="text-[#949ba8] font-medium truncate text-right">
        {label}
      </span>
    </nav>
  );
}
