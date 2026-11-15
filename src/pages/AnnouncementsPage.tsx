import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calendar,
  Check,
  Eye,
  LayoutDashboard,
  LayoutGrid,
  List,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AnnouncementItem,
  OfficialProfile,
  PageRoute,
} from '../siteConfig';
import { CalendarDatePicker } from '../components/DateTimePicker';
import { ImageKitUploader } from '../components/ImageKitUploader';
import { PageSubNav } from '../components/PageSubNav';
import { ResistiveFilterBar } from '../components/ResistiveFilterBar';
import { ScrollReveal } from '../components/ScrollReveal';
import { WordRevealText } from '../components/WordRevealText';
import {
  getImageFramingStyle,
  normalizeImageKitInput,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface AnnouncementsPageProps {
  announcements: AnnouncementItem[];
  filterOptions: string[];
  official: OfficialProfile | null;
  seenIds?: Record<string, boolean>;
  onMarkSeen?: (id: string) => void;
  onNavigate: (page: PageRoute) => void;
  onAddAnnouncement: (item: AnnouncementItem) => void;
}

const VIEW_MODE_STORAGE_KEY = 'smart_council_ann_view_mode_v1';

export function AnnouncementsPage({
  announcements,
  filterOptions,
  official,
  seenIds = {},
  onMarkSeen,
  onNavigate,
  onAddAnnouncement,
}: AnnouncementsPageProps) {
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {
      // Ignore
    }
    return 'grid';
  });
  const [readIds, setReadIds] = useState<Record<string, boolean>>({});
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<AnnouncementItem | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [rawFallbacks, setRawFallbacks] = useState<Record<string, boolean>>({});

  // Official Post Announcement Form State + Discard/Keep Editing Guard
  const [showPostForm, setShowPostForm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() =>
    new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  );
  const [newCategory, setNewCategory] = useState(
    filterOptions[0] ?? 'Campus Life'
  );
  const [newSummary, setNewSummary] = useState('');
  const [newImage, setNewImage] = useState('');

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Ignore
    }
  }, [viewMode]);

  const categories = useMemo(() => ['All', ...filterOptions], [filterOptions]);
  const activeFilter = categories.includes(filter) ? filter : 'All';

  const filteredAnnouncements = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return announcements.filter((item) => {
      const matchesCategory =
        activeFilter === 'All' || item.category === activeFilter;
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.issuedBy.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [announcements, activeFilter, searchQuery]);

  const toggleRead = (id: string) => {
    setReadIds((prev) => ({ ...prev, [id]: !prev[id] }));
    onMarkSeen?.(id);
  };

  const openFullAnnouncement = (item: AnnouncementItem) => {
    setSelectedAnnouncement(item);
    onMarkSeen?.(item.id);
  };

  const requestClosePostForm = () => {
    setShowDiscardConfirm(true);
  };

  const handleDiscardPostForm = () => {
    setShowDiscardConfirm(false);
    setShowPostForm(false);
    setNewTitle('');
    setNewSummary('');
    setNewImage('');
  };

  useEffect(() => {
    if (!showPostForm && !selectedAnnouncement) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPostForm) {
          setShowDiscardConfirm(true);
        } else if (selectedAnnouncement) {
          setSelectedAnnouncement(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [showPostForm, selectedAnnouncement]);

  const handlePostAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!official || !newTitle.trim() || !newSummary.trim()) return;

    const fallbackToday = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const resolvedImg = normalizeImageKitInput(newImage);

    const created: AnnouncementItem = {
      id: `ann-${Date.now()}`,
      date: newDate.trim() || fallbackToday,
      category: newCategory || filterOptions[0] || 'Campus Life',
      title: newTitle.trim(),
      summary: newSummary.trim(),
      issuedBy: `${official.name} (${official.position})`,
      image: resolvedImg || undefined,
    };

    onAddAnnouncement(created);
    setShowDiscardConfirm(false);
    setShowPostForm(false);
    setNewTitle('');
    setNewSummary('');
    setNewImage('');
  };

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <PageSubNav currentPage="announcements" onNavigate={onNavigate} />

        {/* Page Header */}
        <ScrollReveal className="pb-6 border-b border-white/[0.14] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <WordRevealText
              as="h1"
              text="Announcements"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]"
              y={24}
              stagger={0.08}
            />
            <p className="mt-2 text-sm sm:text-base text-[#b4bac6] max-w-xl leading-relaxed">
              Official memos, deadlines, and campus updates. Tap any announcement for full details.
            </p>
          </div>

          {official && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('admin')}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg border border-white/[0.14] bg-[#0b0e15] text-[#f5f4f0] hover:border-white/[0.28] transition-colors cursor-pointer"
              >
                <LayoutDashboard
                  className="h-3.5 w-3.5 text-[#3ddc97]"
                  aria-hidden="true"
                />
                <span>SSC Suite</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  setShowPostForm(true);
                }}
                className="gemini-cta inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New Announcement</span>
              </button>
            </div>
          )}
        </ScrollReveal>

        {/* Filter Tabs, Search & Grid/List View Switcher */}
        <div className="mt-6 pb-5 border-b border-white/[0.14] flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          <div className="min-w-0 flex-1">
            <ResistiveFilterBar
              ariaLabel="Filter announcements by category"
              value={activeFilter}
              onChange={setFilter}
              options={categories.map((cat) => ({ value: cat, label: cat }))}
            />
          </div>

          <div className="flex items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#949ba8]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search announcements..."
                aria-label="Search announcements"
                className="w-full min-h-[40px] rounded-xl border border-white/[0.1] bg-[#131519] pl-9 pr-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
              />
            </div>

            {/* Grid View / List View Toggle */}
            <div
              role="group"
              aria-label="Announcement layout view"
              className="hidden md:inline-flex items-center rounded-xl border border-white/[0.1] bg-[#131519] p-1 shrink-0"
            >
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.16]'
                    : 'text-[#949ba8] hover:text-[#f5f4f0]'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.16]'
                    : 'text-[#949ba8] hover:text-[#f5f4f0]'
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Announcements Content (Grid View or List View) */}
        <div className="mt-5">
          {filteredAnnouncements.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#131519] p-6 sm:p-8 text-center">
              <p className="text-sm sm:text-base font-semibold text-[#f5f4f0]">
                No announcements match your filter
              </p>
              <p className="mt-1 text-xs sm:text-sm text-[#b4bac6]">
                Try clearing your search or selecting “All” categories.
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredAnnouncements.map((item) => {
                const isRead = !!readIds[item.id];
                const isUnseen = !seenIds[item.id] && !isRead;
                const normalized = item.category.toLowerCase();
                const categoryColor = normalized.includes('urgent')
                  ? 'text-[#f87171]'
                  : normalized.includes('academic') ||
                      normalized.includes('study')
                    ? 'text-[#facc15]'
                    : 'text-[#3ddc97]';

                const topStripeColor = normalized.includes('urgent')
                  ? 'var(--ssc-red)'
                  : normalized.includes('academic')
                    ? 'var(--ssc-yellow-bright)'
                    : 'var(--ssc-green-bright)';

                const imgKey = `${item.id}:${item.image || ''}`;
                const transformedImg = resolveImageUrl(
                  item.image,
                  'w-1000,c-at_max,f-auto,q-85'
                );
                const rawImg = stripImageFramingHash(item.image);
                const activeImgSrc = rawFallbacks[imgKey]
                  ? rawImg
                  : transformedImg;
                const showBanner =
                  Boolean(activeImgSrc) && !failedImages[imgKey];

                return (
                  <ScrollReveal key={item.id} className="h-full">
                    <article
                      role="button"
                      tabIndex={0}
                      aria-label={`View full announcement: ${item.title}`}
                      onClick={() => openFullAnnouncement(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openFullAnnouncement(item);
                        }
                      }}
                      className={`card-elevated group rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer transition-all ${
                        isRead ? 'opacity-75' : ''
                      }`}
                    >
                      <div
                        className="h-[2px] w-full shrink-0"
                        style={{ backgroundColor: topStripeColor }}
                        aria-hidden="true"
                      />

                      {showBanner && (
                        <div className="aspect-[16/9] w-full overflow-hidden border-b border-white/[0.08] bg-[#0b0e15] shrink-0">
                          <img
                            src={activeImgSrc}
                            alt={item.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => {
                              if (
                                !rawFallbacks[imgKey] &&
                                rawImg &&
                                rawImg !== activeImgSrc
                              ) {
                                setRawFallbacks((prev) => ({
                                  ...prev,
                                  [imgKey]: true,
                                }));
                              } else {
                                setFailedImages((prev) => ({
                                  ...prev,
                                  [imgKey]: true,
                                }));
                              }
                            }}
                            style={getImageFramingStyle(
                              item.image,
                              'landscape'
                            )}
                            className="h-full w-full transition-transform duration-300 group-hover:scale-103"
                          />
                        </div>
                      )}

                      <div className="p-5 sm:p-6 flex-1 flex flex-col space-y-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${categoryColor}`}>
                              {item.category}
                            </span>
                            {isUnseen && (
                              <span className="inline-flex items-center rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#f87171]">
                                NEW
                              </span>
                            )}
                          </div>
                          <span className="text-[#949ba8] tabular-nums">
                            {item.date}
                          </span>
                        </div>

                        <div className="flex-1">
                          <h2 className="text-lg sm:text-xl font-bold text-[#f5f4f0] group-hover:text-[#3ddc97] transition-colors">
                            {item.title}
                          </h2>
                          <p className="mt-2 text-sm text-[#b4bac6] leading-relaxed line-clamp-2 break-words">
                            {item.summary}
                          </p>
                          <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#3ddc97]/90 group-hover:text-[#3ddc97]">
                            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Tap to view full announcement</span>
                          </span>
                        </div>

                        <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 mt-auto">
                          <span className="text-xs text-[#949ba8] truncate max-w-[60%]">
                            {item.issuedBy}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRead(item.id);
                            }}
                            className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              isRead
                                ? 'bg-[#3ddc97]/15 border-[#3ddc97]/35 text-[#3ddc97]'
                                : 'bg-[#181d29] border-white/[0.12] text-[#f5f4f0] hover:border-white/[0.24]'
                            }`}
                          >
                            {isRead && (
                              <Check
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              {isRead ? 'Acknowledged' : 'Mark as Read'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3.5">
              {filteredAnnouncements.map((item) => {
                const isRead = !!readIds[item.id];
                const isUnseen = !seenIds[item.id] && !isRead;
                const normalized = item.category.toLowerCase();
                const categoryColor = normalized.includes('urgent')
                  ? 'text-[#f87171]'
                  : normalized.includes('academic') ||
                      normalized.includes('study')
                    ? 'text-[#facc15]'
                    : 'text-[#3ddc97]';

                const imgKey = `${item.id}:${item.image || ''}`;
                const transformedImg = resolveImageUrl(
                  item.image,
                  'w-600,c-at_max,f-auto,q-85'
                );
                const rawImg = stripImageFramingHash(item.image);
                const activeImgSrc = rawFallbacks[imgKey]
                  ? rawImg
                  : transformedImg;
                const showBanner =
                  Boolean(activeImgSrc) && !failedImages[imgKey];

                return (
                  <ScrollReveal key={item.id}>
                    <article
                      role="button"
                      tabIndex={0}
                      aria-label={`View full announcement: ${item.title}`}
                      onClick={() => openFullAnnouncement(item)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openFullAnnouncement(item);
                        }
                      }}
                      className={`card-elevated group rounded-2xl overflow-hidden p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer transition-all ${
                        isRead ? 'opacity-75' : ''
                      }`}
                    >
                      {showBanner && (
                        <div className="aspect-[16/9] sm:aspect-[4/3] w-full sm:w-44 rounded-xl overflow-hidden border border-white/[0.08] bg-[#0b0e15] shrink-0">
                          <img
                            src={activeImgSrc}
                            alt={item.title}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => {
                              if (
                                !rawFallbacks[imgKey] &&
                                rawImg &&
                                rawImg !== activeImgSrc
                              ) {
                                setRawFallbacks((prev) => ({
                                  ...prev,
                                  [imgKey]: true,
                                }));
                              } else {
                                setFailedImages((prev) => ({
                                  ...prev,
                                  [imgKey]: true,
                                }));
                              }
                            }}
                            style={getImageFramingStyle(
                              item.image,
                              'landscape'
                            )}
                            className="h-full w-full transition-transform duration-300 group-hover:scale-103"
                          />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold ${categoryColor}`}>
                              {item.category}
                            </span>
                            {isUnseen && (
                              <span className="inline-flex items-center rounded-full bg-[#ef4444] px-2 py-0.5 text-[10px] font-bold text-white">
                                NEW
                              </span>
                            )}
                          </div>
                          <span className="text-[#949ba8] tabular-nums">
                            {item.date}
                          </span>
                        </div>

                        <h2 className="text-base sm:text-lg font-bold text-[#f5f4f0] group-hover:text-[#3ddc97] transition-colors truncate">
                          {item.title}
                        </h2>

                        <p className="text-sm text-[#b4bac6] line-clamp-2 break-words">
                          {item.summary}
                        </p>

                        <p className="text-xs text-[#949ba8]">
                          Issued by{' '}
                          <span className="font-semibold text-[#f5f4f0]">
                            {item.issuedBy}
                          </span>
                        </p>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3ddc97]">
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Read Full</span>
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRead(item.id);
                          }}
                          className={`inline-flex items-center gap-1.5 min-h-[34px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            isRead
                              ? 'bg-[#3ddc97]/15 border-[#3ddc97]/35 text-[#3ddc97]'
                              : 'bg-[#181d29] border-white/[0.12] text-[#f5f4f0] hover:border-white/[0.24]'
                          }`}
                        >
                          {isRead && (
                            <Check
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          )}
                          <span>
                            {isRead ? 'Acknowledged' : 'Mark as Read'}
                          </span>
                        </button>
                      </div>
                    </article>
                  </ScrollReveal>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Announcement Full-View Pop-Up Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedAnnouncement && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ann-lightbox-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => setSelectedAnnouncement(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#131519] border border-white/[0.12] shadow-2xl overflow-hidden"
                >
                  {(() => {
                    const mKey = `${selectedAnnouncement.id}:${selectedAnnouncement.image || ''}`;
                    const mUrl = rawFallbacks[mKey]
                      ? stripImageFramingHash(selectedAnnouncement.image)
                      : resolveImageUrl(
                          selectedAnnouncement.image,
                          'w-1200,c-at_max,f-auto,q-85'
                        );
                    const showModalImg = Boolean(mUrl) && !failedImages[mKey];

                    return showModalImg ? (
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1a1d22]">
                        <img
                          src={mUrl}
                          alt={selectedAnnouncement.title}
                          referrerPolicy="no-referrer"
                          style={getImageFramingStyle(
                            selectedAnnouncement.image,
                            'landscape'
                          )}
                          className="h-full w-full"
                        />
                        <button
                          type="button"
                          aria-label="Close announcement preview"
                          onClick={() => setSelectedAnnouncement(null)}
                          className="absolute top-3 right-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#0d0e11] border border-white/[0.16] text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/[0.08]">
                        <span className="text-xs font-semibold text-[#3ddc97]">
                          Official SLAC SSC Advisory
                        </span>
                        <button
                          type="button"
                          aria-label="Close announcement preview"
                          onClick={() => setSelectedAnnouncement(null)}
                          className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg bg-[#0d0e11] border border-white/[0.12] text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    );
                  })()}

                  <div className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#3ddc97]">
                        {selectedAnnouncement.category}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-[#b4bac6] tabular-nums">
                        <Calendar
                          className="h-3.5 w-3.5 text-[#facc15]"
                          aria-hidden="true"
                        />
                        {selectedAnnouncement.date}
                      </span>
                    </div>

                    <h2
                      id="ann-lightbox-title"
                      className="text-xl sm:text-2xl font-bold text-[#f5f4f0]"
                    >
                      {selectedAnnouncement.title}
                    </h2>

                    <p className="text-sm sm:text-base text-[#b4bac6] leading-relaxed whitespace-pre-line break-words">
                      {selectedAnnouncement.summary}
                    </p>

                    <div className="pt-4 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-[#b4bac6]">
                        <UserCheck
                          className="h-4 w-4 text-[#3ddc97]"
                          aria-hidden="true"
                        />
                        <span>
                          Issued by{' '}
                          <strong className="font-semibold text-[#f5f4f0]">
                            {selectedAnnouncement.issuedBy}
                          </strong>
                        </span>
                      </span>

                      <button
                        type="button"
                        onClick={() => toggleRead(selectedAnnouncement.id)}
                        className={`inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                          readIds[selectedAnnouncement.id]
                            ? 'bg-[#3ddc97]/15 border-[#3ddc97]/35 text-[#3ddc97]'
                            : 'bg-[#181d29] border-white/[0.12] text-[#f5f4f0] hover:border-white/[0.24]'
                        }`}
                      >
                        {readIds[selectedAnnouncement.id] && (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {readIds[selectedAnnouncement.id]
                            ? 'Acknowledged'
                            : 'Mark as Read'}
                        </span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Portaled Post Announcement Pop-Up Modal (Protected by Discard / Keep Editing Guard) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {official && showPostForm && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ann-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={requestClosePostForm}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handlePostAnnouncement}
                  className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <div>
                      <h2
                        id="ann-modal-title"
                        className="text-lg font-bold text-[#f5f4f0]"
                      >
                        New Official Announcement
                      </h2>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3ddc97]">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Issuing as {official.name} ({official.position})
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close announcement modal"
                      onClick={requestClosePostForm}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Discard / Keep Editing Guard Banner */}
                  <AnimatePresence>
                    {showDiscardConfirm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-b border-[#facc15]/35 bg-[#facc15]/10 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5">
                          <AlertTriangle
                            className="h-4 w-4 text-[#facc15] shrink-0 mt-0.5"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-[#f5f4f0]">
                              Discard ongoing announcement edits?
                            </p>
                            <p className="text-xs text-[#b4bac6]">
                              Choose Keep Editing to stay or Discard Changes to close.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDiscardConfirm(false)}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#3ddc97] text-xs font-semibold text-[#042412] hover:bg-[#34c786] cursor-pointer"
                          >
                            Keep Editing
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardPostForm}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] hover:bg-[#ef4444]/25 cursor-pointer"
                          >
                            Discard Changes
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="ann-title"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Announcement Headline
                        </label>
                        <input
                          id="ann-title"
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="Write official advisory headline..."
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-2 text-sm text-[#f5f4f0]"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="ann-cat"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Category
                        </label>
                        <select
                          id="ann-cat"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-2 text-sm text-[#f5f4f0]"
                        >
                          {filterOptions.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Date
                      </label>
                      <CalendarDatePicker
                        value={newDate}
                        onChange={setNewDate}
                        placeholder="Select date"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="ann-summary"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Advisory Details
                      </label>
                      <textarea
                        id="ann-summary"
                        rows={4}
                        required
                        value={newSummary}
                        onChange={(e) => setNewSummary(e.target.value)}
                        placeholder="Share clear details for SLAC students..."
                        className="w-full rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-2 text-sm text-[#f5f4f0]"
                      />
                    </div>

                    <ImageKitUploader
                      value={newImage}
                      onChange={setNewImage}
                      folder="announcements"
                      label="Photo"
                      aspect="landscape"
                      cardType="announcement"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={requestClosePostForm}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#1a1d22] hover:text-[#f5f4f0] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Publish Advisory
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </section>
  );
}
