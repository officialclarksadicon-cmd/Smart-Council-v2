import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calendar,
  Clock,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  List,
  MapPin,
  Plus,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  GalleryEventItem,
  OfficialProfile,
  PageRoute,
  siteConfig,
} from '../siteConfig';
import {
  CalendarDatePicker,
  ClockTimePicker,
} from '../components/DateTimePicker';
import { PageSubNav } from '../components/PageSubNav';
import { ImageKitUploader } from '../components/ImageKitUploader';
import { ResistiveFilterBar } from '../components/ResistiveFilterBar';
import { ScrollReveal } from '../components/ScrollReveal';
import { WordRevealText } from '../components/WordRevealText';
import {
  getImageFramingStyle,
  normalizeImageKitInput,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface EventsPageProps {
  events: GalleryEventItem[];
  filterOptions: string[];
  official: OfficialProfile | null;
  seenIds?: Record<string, boolean>;
  onMarkSeen?: (id: string) => void;
  onNavigate: (page: PageRoute) => void;
  onAddEvent: (item: GalleryEventItem) => void;
}

const VIEW_MODE_STORAGE_KEY = 'smart_council_evt_view_mode_v1';

export function EventsPage({
  events,
  filterOptions,
  official,
  seenIds = {},
  onMarkSeen,
  onNavigate,
  onAddEvent,
}: EventsPageProps) {
  const [filter, setFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      if (saved === 'grid' || saved === 'list') return saved;
    } catch {
      // Ignore
    }
    return 'grid';
  });
  const [selectedEvent, setSelectedEvent] = useState<GalleryEventItem | null>(
    null
  );
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [rawFallbacks, setRawFallbacks] = useState<Record<string, boolean>>({});

  // Official Add Event Composer State + Discard/Keep Editing Guard
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newCategory, setNewCategory] = useState(
    filterOptions[0] ?? 'Governance'
  );
  const [newDesc, setNewDesc] = useState('');
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

  const filteredEvents = useMemo(
    () =>
      events.filter(
        (evt) => activeFilter === 'All' || evt.category === activeFilter
      ),
    [events, activeFilter]
  );

  const openFullEvent = (evt: GalleryEventItem) => {
    setSelectedEvent(evt);
    onMarkSeen?.(evt.id);
  };

  const requestCloseAddForm = () => {
    setShowDiscardConfirm(true);
  };

  const handleDiscardAddForm = () => {
    setShowDiscardConfirm(false);
    setShowAddForm(false);
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewLocation('');
    setNewDesc('');
    setNewImage('');
  };

  useEffect(() => {
    if (!selectedEvent && !showAddForm) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showAddForm) {
          setShowDiscardConfirm(true);
        } else {
          setSelectedEvent(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedEvent, showAddForm]);

  const handleAddEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate.trim() || !newLocation.trim()) return;

    const fallbackImage = siteConfig.councilSection.image;
    const resolvedImage = normalizeImageKitInput(newImage) || fallbackImage;
    const created: GalleryEventItem = {
      id: `evt-${Date.now()}`,
      title: newTitle.trim(),
      date: newDate.trim(),
      time: newTime.trim() || 'TBA',
      location: newLocation.trim(),
      category: newCategory || filterOptions[0] || 'Governance',
      description:
        newDesc.trim() ||
        `Posted by ${official?.name ?? 'SSC Official'} (${official?.position ?? 'Officer'}). Open to SLAC students.`,
      image: resolvedImage,
      imageAlt: `${newTitle.trim()} campus event`,
    };

    onAddEvent(created);
    setShowDiscardConfirm(false);
    setShowAddForm(false);
    setNewTitle('');
    setNewDate('');
    setNewTime('');
    setNewLocation('');
    setNewDesc('');
    setNewImage('');
  };

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <PageSubNav currentPage="events" onNavigate={onNavigate} />

        {/* Page Header */}
        <ScrollReveal>
          <div className="pb-6 border-b border-white/[0.14] flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <WordRevealText
                as="h1"
                text="Upcoming Events Gallery"
                className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]"
                y={24}
                stagger={0.08}
                highlightWords={['Events', 'Gallery']}
              />
              <p className="mt-2 text-sm sm:text-base text-[#b4bac6] max-w-xl leading-relaxed">
                Upcoming SSC activities and schedules. Tap any event for full details.
              </p>
            </div>

            {official && (
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    setShowAddForm(true);
                  }}
                  className="gemini-cta inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>New Event</span>
                </button>
              </div>
            )}
          </div>
        </ScrollReveal>

        {/* Resistive Category Filter Tabs & Grid/List View Switcher */}
        <div className="mt-6 pb-5 border-b border-white/[0.14] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ResistiveFilterBar
              ariaLabel="Filter upcoming events"
              value={activeFilter}
              onChange={setFilter}
              options={categories.map((cat) => ({ value: cat, label: cat }))}
            />
          </div>

          <div
            role="group"
            aria-label="Event layout view"
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
              <span>Grid</span>
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
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Events Gallery (Grid View or List View) */}
        {filteredEvents.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#131519] p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base font-semibold text-[#f5f4f0]">
              No upcoming events match your filter
            </p>
            <p className="mt-1 text-xs sm:text-sm text-[#b4bac6]">
              {official
                ? 'Select “All” categories or use the “New Event” button in the section header above to schedule an event.'
                : 'Check back soon for new SSC campus activities or select “All” categories.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredEvents.map((evt) => {
              const imgKey = `${evt.id}:${evt.image || ''}`;
              const transformedUrl = resolveImageUrl(
                evt.image,
                'w-900,c-at_max,f-auto,q-85'
              );
              const rawUrl = stripImageFramingHash(evt.image);
              const activeSrc = rawFallbacks[imgKey] ? rawUrl : transformedUrl;
              const hasFailed = !activeSrc || failedImages[imgKey];
              const isUnseen = !seenIds[evt.id];

              return (
                <ScrollReveal key={evt.id} className="h-full">
                  <article
                    role="button"
                    tabIndex={0}
                    aria-label={`View full event details: ${evt.title}`}
                    onClick={() => openFullEvent(evt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFullEvent(evt);
                      }
                    }}
                    className="card-elevated group rounded-2xl overflow-hidden flex flex-col h-full cursor-pointer"
                  >
                    {/* Shared Event Card Aspect Ratio */}
                    <div className="relative aspect-event-card w-full bg-[#181d29] overflow-hidden">
                      {!hasFailed ? (
                        <img
                          src={activeSrc}
                          alt={evt.imageAlt}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (
                              !rawFallbacks[imgKey] &&
                              rawUrl &&
                              rawUrl !== activeSrc
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
                          style={getImageFramingStyle(evt.image, 'landscape')}
                          className="h-full w-full transition-transform duration-300 group-hover:scale-103"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-[#3ddc97]">
                          <ImageIcon className="h-8 w-8" aria-hidden="true" />
                          <span className="text-sm font-medium">{evt.title}</span>
                        </div>
                      )}

                      <div
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
                      />
                      <div className="photo-overlay absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-md bg-[#0b0e15]/95 border border-white/[0.14] px-2.5 py-1 text-xs font-semibold text-[#f5f4f0] tabular-nums">
                        <Calendar
                          className="h-3.5 w-3.5 text-[#3ddc97]"
                          aria-hidden="true"
                        />
                        <span>{evt.date}</span>
                      </div>
                      {isUnseen && (
                        <span className="photo-overlay absolute top-3 right-3 inline-flex items-center rounded-full bg-[#ef4444] px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                          NEW
                        </span>
                      )}
                    </div>

                    {/* Gallery Card Caption */}
                    <div className="p-6 flex-1 flex flex-col space-y-2.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-[#b4bac6]">
                          {evt.category}
                        </span>
                        <span className="text-[#949ba8] tabular-nums">
                          {evt.time}
                        </span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold text-[#f5f4f0] group-hover:text-[#3ddc97] transition-colors">
                        {evt.title}
                      </h2>

                      <p className="text-sm text-[#b4bac6] leading-relaxed line-clamp-2 break-words">
                        {evt.description}
                      </p>

                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3ddc97] group-hover:underline">
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Tap to view full event details</span>
                      </span>

                      <div className="mt-auto pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tag text-[#b4bac6] tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock
                            className="h-3.5 w-3.5 text-[#facc15]"
                            aria-hidden="true"
                          />
                          {evt.time}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin
                            className="h-3.5 w-3.5 text-[#3ddc97]"
                            aria-hidden="true"
                          />
                          {evt.location}
                        </span>
                      </div>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 space-y-3.5">
            {filteredEvents.map((evt) => {
              const imgKey = `${evt.id}:${evt.image || ''}`;
              const transformedUrl = resolveImageUrl(
                evt.image,
                'w-600,c-at_max,f-auto,q-85'
              );
              const rawUrl = stripImageFramingHash(evt.image);
              const activeSrc = rawFallbacks[imgKey] ? rawUrl : transformedUrl;
              const hasFailed = !activeSrc || failedImages[imgKey];
              const isUnseen = !seenIds[evt.id];

              return (
                <ScrollReveal key={evt.id}>
                  <article
                    role="button"
                    tabIndex={0}
                    aria-label={`View full event details: ${evt.title}`}
                    onClick={() => openFullEvent(evt)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openFullEvent(evt);
                      }
                    }}
                    className="card-elevated group rounded-2xl overflow-hidden p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 cursor-pointer"
                  >
                    <div className="relative aspect-[16/9] sm:aspect-[4/3] w-full sm:w-48 rounded-xl bg-[#181d29] overflow-hidden shrink-0">
                      {!hasFailed ? (
                        <img
                          src={activeSrc}
                          alt={evt.imageAlt}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() => {
                            if (
                              !rawFallbacks[imgKey] &&
                              rawUrl &&
                              rawUrl !== activeSrc
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
                          style={getImageFramingStyle(evt.image, 'landscape')}
                          className="h-full w-full transition-transform duration-300 group-hover:scale-103"
                        />
                      ) : (
                        <div className="h-full w-full flex flex-col items-center justify-center gap-1.5 text-[#3ddc97]">
                          <ImageIcon className="h-6 w-6" aria-hidden="true" />
                        </div>
                      )}
                      {isUnseen && (
                        <span className="photo-overlay absolute top-2 right-2 inline-flex items-center rounded-full bg-[#ef4444] px-2 py-0.5 text-[10px] font-bold text-white">
                          NEW
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#38bdf8]">
                          {evt.category}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[#f5f4f0] font-medium tabular-nums">
                          <Calendar
                            className="h-3.5 w-3.5 text-[#3ddc97]"
                            aria-hidden="true"
                          />
                          {evt.date}
                        </span>
                      </div>

                      <h2 className="text-base sm:text-lg font-bold text-[#f5f4f0] group-hover:text-[#38bdf8] transition-colors truncate">
                        {evt.title}
                      </h2>

                      <p className="text-sm text-[#b4bac6] line-clamp-2 break-words">
                        {evt.description}
                      </p>

                      <div className="pt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#b4bac6] tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock
                            className="h-3.5 w-3.5 text-[#facc15]"
                            aria-hidden="true"
                          />
                          {evt.time}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin
                            className="h-3.5 w-3.5 text-[#3ddc97]"
                            aria-hidden="true"
                          />
                          {evt.location}
                        </span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#38bdf8]">
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>View Event</span>
                      </span>
                    </div>
                  </article>
                </ScrollReveal>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Lightbox Modal */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedEvent && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="lightbox-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => setSelectedEvent(null)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#131519] border border-white/[0.12] shadow-2xl"
                >
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1a1d22]">
                    <img
                      src={
                        rawFallbacks[
                          `${selectedEvent.id}:${selectedEvent.image || ''}`
                        ]
                          ? stripImageFramingHash(selectedEvent.image)
                          : resolveImageUrl(
                              selectedEvent.image,
                              'w-1200,c-at_max,f-auto,q-85'
                            )
                      }
                      alt={selectedEvent.imageAlt}
                      referrerPolicy="no-referrer"
                      style={getImageFramingStyle(
                        selectedEvent.image,
                        'landscape'
                      )}
                      className="h-full w-full"
                    />
                    <button
                      type="button"
                      aria-label="Close event preview"
                      onClick={() => setSelectedEvent(null)}
                      className="absolute top-3 right-3 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg bg-[#0d0e11] border border-white/[0.16] text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <p className="text-xs font-semibold text-[#38bdf8]">
                      {selectedEvent.category}
                    </p>

                    <h2
                      id="lightbox-title"
                      className="text-xl sm:text-2xl font-bold text-[#f5f4f0]"
                    >
                      {selectedEvent.title}
                    </h2>

                    <p className="text-sm sm:text-base text-[#b4bac6] leading-relaxed whitespace-pre-line break-words">
                      {selectedEvent.description}
                    </p>

                    <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm text-[#f5f4f0] tabular-nums">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Calendar className="h-4 w-4 text-[#3ddc97]" aria-hidden="true" />
                        {selectedEvent.date}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <Clock className="h-4 w-4 text-[#facc15]" aria-hidden="true" />
                        {selectedEvent.time}
                      </span>
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <MapPin className="h-4 w-4 text-[#3ddc97]" aria-hidden="true" />
                        {selectedEvent.location}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* Official Add Event Pop-Up Modal (Dedicated Calendar & Clock Pickers + Edit Guard) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {official && showAddForm && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-event-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={requestCloseAddForm}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleAddEvent}
                  className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <div>
                      <h2
                        id="add-event-modal-title"
                        className="text-lg font-bold text-[#f5f4f0]"
                      >
                        Add Upcoming Event
                      </h2>
                      <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3ddc97]">
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Posting as {official.name} ({official.position})
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close add event modal"
                      onClick={requestCloseAddForm}
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
                              Discard ongoing event edits?
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
                            onClick={handleDiscardAddForm}
                            className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] hover:bg-[#ef4444]/25 cursor-pointer"
                          >
                            Discard Changes
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="sm:col-span-2">
                        <label
                          htmlFor="evt-title"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Event Title
                        </label>
                        <input
                          id="evt-title"
                          type="text"
                          required
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          placeholder="e.g. SigLakas 2026"
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-2 text-sm text-[#f5f4f0]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Date
                        </label>
                        <CalendarDatePicker
                          id="evt-date"
                          value={newDate}
                          onChange={setNewDate}
                          placeholder="Select date"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="evt-category"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Category
                        </label>
                        <select
                          id="evt-category"
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Time
                        </label>
                        <ClockTimePicker
                          id="evt-time"
                          value={newTime}
                          onChange={setNewTime}
                          placeholder="Select time"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="evt-location"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Campus Venue
                        </label>
                        <input
                          id="evt-location"
                          type="text"
                          required
                          value={newLocation}
                          onChange={(e) => setNewLocation(e.target.value)}
                          placeholder="e.g. Main Campus"
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-2 text-sm text-[#f5f4f0]"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="evt-desc"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Full Event Description
                      </label>
                      <textarea
                        id="evt-desc"
                        rows={4}
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Describe the upcoming activity..."
                        className="w-full rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-2 text-sm text-[#f5f4f0]"
                      />
                    </div>

                    <ImageKitUploader
                      value={newImage}
                      onChange={setNewImage}
                      folder="events"
                      label="Photo"
                      aspect="landscape"
                      cardType="event"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={requestCloseAddForm}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#1a1d22] hover:text-[#f5f4f0] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Publish to Gallery
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
