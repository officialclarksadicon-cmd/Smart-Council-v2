import { FormEvent, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  ThumbsUp,
  User,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ForumReply,
  ForumThread,
  OfficialProfile,
  PageRoute,
  StudentProfile,
} from '../siteConfig';
import { PageSubNav } from '../components/PageSubNav';
import { ResistiveFilterBar } from '../components/ResistiveFilterBar';
import { ScrollReveal } from '../components/ScrollReveal';
import { WordRevealText } from '../components/WordRevealText';

interface ForumPageProps {
  threads: ForumThread[];
  filterOptions: string[];
  official: OfficialProfile | null;
  student: StudentProfile | null;
  seenIds?: Record<string, boolean>;
  onMarkSeen?: (id: string) => void;
  onOpenStudentAuth: () => void;
  onNavigate: (page: PageRoute) => void;
  onAddThread: (thread: ForumThread) => void;
  onAddReply: (threadId: string, reply: ForumReply) => void;
  onToggleSupport?: (threadId: string, delta: number) => void;
}

const CUSTOM_TOPIC_VALUE = '__custom__';
const MAX_CUSTOM_TOPIC_LEN = 32;

export function ForumPage({
  threads,
  filterOptions,
  official,
  student,
  seenIds = {},
  onMarkSeen,
  onOpenStudentAuth,
  onNavigate,
  onAddThread,
  onAddReply,
  onToggleSupport,
}: ForumPageProps) {
  const [selectedId, setSelectedId] = useState<string>(threads[0]?.id ?? '');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [topicFilter, setTopicFilter] = useState<string>('All');
  const [supportedIds, setSupportedIds] = useState<Record<string, boolean>>({});

  // New Thread Composer State + Discard/Keep Editing Guard
  const [showNewForm, setShowNewForm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newTopic, setNewTopic] = useState<string>(
    filterOptions[0] ?? 'Suggestions'
  );
  const [customTopic, setCustomTopic] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');

  // Reply Composer State
  const [replyMessage, setReplyMessage] = useState('');

  const desktopReplyInputRef = useRef<HTMLInputElement>(null);
  const mobileReplyInputRef = useRef<HTMLInputElement>(null);
  const desktopRepliesBoxRef = useRef<HTMLDivElement>(null);
  const mobileRepliesBoxRef = useRef<HTMLDivElement>(null);
  const lastThreadMetaRef = useRef<{ id: string; count: number } | null>(null);

  const canPost = Boolean(official || student);

  const dynamicTopics = Array.from(
    new Set([
      ...filterOptions,
      ...threads.map((t) => t.topic.trim()).filter(Boolean),
    ])
  );
  const topics = ['All', ...dynamicTopics];
  const activeFilter = topics.includes(topicFilter) ? topicFilter : 'All';

  const visibleThreads = threads.filter(
    (t) => activeFilter === 'All' || t.topic === activeFilter
  );

  const activeThread =
    visibleThreads.find((t) => t.id === selectedId) ?? visibleThreads[0];

  useEffect(() => {
    if (!mobileSheetOpen && !showNewForm) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showNewForm) {
          setShowDiscardConfirm(true);
        } else {
          setMobileSheetOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileSheetOpen, showNewForm]);

  const toggleSupport = (id: string) => {
    if (!canPost) {
      onOpenStudentAuth();
      return;
    }
    const currentlySupported = Boolean(supportedIds[id]);
    const nextSupported = !currentlySupported;
    setSupportedIds((prev) => ({ ...prev, [id]: nextSupported }));
    onToggleSupport?.(id, nextSupported ? 1 : -1);
    onMarkSeen?.(id);
  };

  const handleSelectThread = (threadId: string, openSheetOnMobile: boolean) => {
    setSelectedId(threadId);
    onMarkSeen?.(threadId);
    if (openSheetOnMobile) {
      setMobileSheetOpen(true);
    }
  };

  const handleOpenNewDiscussion = () => {
    if (!canPost) {
      onOpenStudentAuth();
      return;
    }
    setShowDiscardConfirm(false);
    setShowNewForm(true);
  };

  const handleDiscardNewForm = () => {
    setShowDiscardConfirm(false);
    setShowNewForm(false);
    setNewTitle('');
    setNewBody('');
    setCustomTopic('');
  };

  const handleCreateThread = (e: FormEvent) => {
    e.preventDefault();
    if (!canPost) {
      onOpenStudentAuth();
      return;
    }

    const resolvedTopic =
      newTopic === CUSTOM_TOPIC_VALUE
        ? customTopic.trim().slice(0, MAX_CUSTOM_TOPIC_LEN)
        : newTopic || filterOptions[0] || 'Suggestions';

    if (!newTitle.trim() || !newBody.trim() || !resolvedTopic) return;

    const resolvedAuthor = official
      ? official.name
      : student
        ? student.name
        : 'SLAC Student';
    const resolvedRole = official
      ? official.position
      : student
        ? student.yearCourse || 'SLAC Student'
        : 'SLAC Student';

    const created: ForumThread = {
      id: `thread-${Date.now()}`,
      author: resolvedAuthor,
      yearLevel: resolvedRole,
      postedAt: 'Just now',
      topic: resolvedTopic,
      title: newTitle.trim(),
      body: newBody.trim(),
      supportCount: 1,
      replies: [],
    };

    onAddThread(created);
    setSelectedId(created.id);
    setTopicFilter('All');
    setShowDiscardConfirm(false);
    setShowNewForm(false);
    setNewTitle('');
    setNewBody('');
    setCustomTopic('');
  };

  const handleReplySubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canPost) {
      onOpenStudentAuth();
      return;
    }
    if (!activeThread || !replyMessage.trim()) return;

    const resolvedAuthor = official
      ? official.name
      : student
        ? student.name
        : 'SLAC Student';
    const resolvedRole = official
      ? official.position
      : student
        ? student.yearCourse || 'SLAC Student'
        : 'SLAC Student';

    const reply: ForumReply = {
      id: `rep-${Date.now()}`,
      author: resolvedAuthor,
      yearLevel: resolvedRole,
      time: 'Just now',
      message: replyMessage.trim(),
    };

    onAddReply(activeThread.id, reply);
    onMarkSeen?.(activeThread.id);
    setReplyMessage('');
  };

  useEffect(() => {
    if (!activeThread) {
      lastThreadMetaRef.current = null;
      return;
    }

    const prev = lastThreadMetaRef.current;
    const nextCount = activeThread.replies.length;
    lastThreadMetaRef.current = { id: activeThread.id, count: nextCount };

    if (prev && prev.id === activeThread.id && nextCount > prev.count) {
      requestAnimationFrame(() => {
        if (mobileSheetOpen && mobileRepliesBoxRef.current) {
          mobileRepliesBoxRef.current.scrollTo({
            top: mobileRepliesBoxRef.current.scrollHeight,
            behavior: 'smooth',
          });
        } else if (desktopRepliesBoxRef.current) {
          desktopRepliesBoxRef.current.scrollTo({
            top: desktopRepliesBoxRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }
      });
    }
  }, [activeThread, mobileSheetOpen]);

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <PageSubNav currentPage="forum" onNavigate={onNavigate} />

        {/* Page Header */}
        <ScrollReveal className="pb-6 border-b border-white/[0.14] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <WordRevealText
              as="h1"
              text="Student Forum"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]"
              y={32}
              stagger={0.1}
              highlightWords={['Forum']}
            />
            <p className="mt-2 text-sm sm:text-base text-[#b4bac6] max-w-xl leading-relaxed">
              Share campus ideas, ask questions, and reply to discussions.
            </p>
          </div>

          <button
            type="button"
            onClick={handleOpenNewDiscussion}
            className="gemini-cta inline-flex items-center justify-center gap-2 min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New Discussion</span>
          </button>
        </ScrollReveal>

        {/* Resistive Topic Filter Tabs */}
        <div className="mt-6 pb-5 border-b border-white/[0.14]">
          <ResistiveFilterBar
            ariaLabel="Filter forum discussions"
            value={activeFilter}
            onChange={setTopicFilter}
            options={topics.map((topic) => ({ value: topic, label: topic }))}
          />
        </div>

        {visibleThreads.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/[0.12] bg-[#0b0e15] p-6 sm:p-8 text-center">
            <p className="text-sm sm:text-base font-semibold text-[#f5f4f0]">
              No discussions under this topic yet
            </p>
            <p className="mt-1 text-xs sm:text-sm text-[#b4bac6]">
              Start a new discussion to share campus ideas or questions with the student body.
            </p>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW (< lg) */}
            <div className="mt-6 space-y-3 lg:hidden">
              {visibleThreads.map((thread) => {
                const isSupported = !!supportedIds[thread.id];
                const isUnseen = !seenIds[thread.id];
                const topicLower = thread.topic.toLowerCase();
                const topicColor =
                  topicLower.includes('concern') || topicLower.includes('urgent')
                    ? 'text-[#f87171]'
                    : topicLower.includes('event') ||
                        topicLower.includes('campus')
                      ? 'text-[#3ddc97]'
                      : 'text-[#facc15]';

                return (
                  <ScrollReveal key={thread.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectThread(thread.id, true)}
                      className="card-elevated w-full text-left p-5 rounded-2xl active:scale-[0.99] transition-transform cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${topicColor}`}>
                            {thread.topic}
                          </span>
                          {isUnseen && (
                            <span className="inline-flex items-center rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#f87171]">
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[#949ba8] tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {thread.postedAt}
                        </span>
                      </div>

                      <h2 className="mt-2.5 text-lg font-bold text-[#f5f4f0] leading-snug">
                        {thread.title}
                      </h2>

                      <p className="mt-1.5 text-sm text-[#b4bac6] line-clamp-2">
                        {thread.body}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#b4bac6] tabular-nums">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#f5f4f0]">
                          <User
                            className="h-3.5 w-3.5 text-[#949ba8]"
                            aria-hidden="true"
                          />
                          {thread.author}
                        </span>
                        <span className="inline-flex items-center gap-3 font-medium">
                          <span className={isSupported ? 'text-[#facc15]' : ''}>
                            {thread.supportCount} support
                          </span>
                          <span className="inline-flex items-center gap-1 text-[#3ddc97] font-semibold">
                            <MessageSquare
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {thread.replies.length}
                            <ChevronRight
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </span>
                        </span>
                      </div>
                    </button>
                  </ScrollReveal>
                );
              })}
            </div>

            {/* DESKTOP VIEW (>= lg) */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-6 mt-6 lg:h-[620px] min-h-0">
              <div className="lg:col-span-5 lg:h-full min-h-0 lg:overflow-y-auto no-scrollbar lg:pr-2 lg:border-r lg:border-white/[0.14] space-y-3">
                {visibleThreads.map((thread) => {
                  const isSelected = thread.id === activeThread?.id;
                  const isSupported = !!supportedIds[thread.id];
                  const isUnseen = !seenIds[thread.id];
                  const topicLower = thread.topic.toLowerCase();
                  const topicColor =
                    topicLower.includes('concern') ||
                    topicLower.includes('urgent')
                      ? 'text-[#f87171]'
                      : topicLower.includes('event') ||
                          topicLower.includes('campus')
                        ? 'text-[#3ddc97]'
                        : 'text-[#facc15]';

                  return (
                    <button
                      key={thread.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => handleSelectThread(thread.id, false)}
                      className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#2b5b42] bg-[#181d29]'
                          : 'border-white/[0.12] bg-[#0b0e15] hover:border-white/[0.24]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold ${topicColor}`}>
                            {thread.topic}
                          </span>
                          {isUnseen && (
                            <span className="inline-flex items-center rounded-full bg-[#ef4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#f87171]">
                              NEW
                            </span>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[#949ba8] tabular-nums">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          {thread.postedAt}
                        </span>
                      </div>

                      <h2 className="mt-2.5 text-base sm:text-lg font-bold text-[#f5f4f0]">
                        {thread.title}
                      </h2>

                      <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between text-xs text-[#b4bac6] tabular-nums">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#f5f4f0]">
                          <User
                            className="h-3.5 w-3.5 text-[#949ba8]"
                            aria-hidden="true"
                          />
                          {thread.author}
                        </span>
                        <span className="inline-flex items-center gap-3">
                          <span className={isSupported ? 'text-[#facc15]' : ''}>
                            {thread.supportCount} support
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#3ddc97]">
                            <MessageSquare
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                            {thread.replies.length}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-7 lg:h-full min-h-0 flex flex-col">
                {activeThread && (
                  <div className="h-full min-h-0 flex flex-col rounded-2xl border border-white/[0.1] bg-[#121620] overflow-hidden">
                    <div
                      className="h-[2px] w-full shrink-0"
                      style={{ backgroundColor: 'var(--ssc-green-bright)' }}
                      aria-hidden="true"
                    />

                    <div className="shrink-0 px-6 pt-5 pb-4 border-b border-white/[0.08] bg-[#121620]">
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="font-semibold text-[#facc15]">
                          {activeThread.topic}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[#949ba8] tabular-nums">
                          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                          {activeThread.postedAt}
                        </span>
                      </div>

                      <h2 className="mt-2 text-xl font-bold text-[#f5f4f0]">
                        {activeThread.title}
                      </h2>

                      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-[#b4bac6]">
                        <span className="font-semibold text-[#f5f4f0]">
                          {activeThread.author}
                        </span>
                        <span>{activeThread.yearLevel}</span>
                      </div>

                      <p className="mt-3 text-sm text-[#e2e5eb] leading-relaxed max-w-[65ch] max-h-[140px] overflow-y-auto overscroll-contain break-words pr-1">
                        {activeThread.body}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSupport(activeThread.id)}
                          className={`inline-flex items-center gap-2 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg border active:scale-[0.98] transition-transform tabular-nums cursor-pointer ${
                            supportedIds[activeThread.id]
                              ? 'bg-[#facc15]/15 border-[#facc15]/40 text-[#facc15]'
                              : 'bg-[#181d29] border-white/[0.12] text-[#f5f4f0] hover:border-white/[0.24]'
                          }`}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>
                            {supportedIds[activeThread.id]
                              ? 'Supported'
                              : 'Support Proposal'}{' '}
                            ({activeThread.supportCount})
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!canPost) {
                              onOpenStudentAuth();
                              return;
                            }
                            desktopReplyInputRef.current?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg text-[#3ddc97] bg-[#3ddc97]/10 border border-[#3ddc97]/30 hover:bg-[#3ddc97]/15 cursor-pointer"
                        >
                          <MessageSquare
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>Write a Reply</span>
                        </button>
                      </div>
                    </div>

                    <div
                      ref={desktopRepliesBoxRef}
                      className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 space-y-3 bg-[#0b0e15]"
                    >
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#949ba8] tabular-nums">
                        Replies ({activeThread.replies.length})
                      </h3>

                      {activeThread.replies.length === 0 ? (
                        <p className="text-sm text-[#949ba8] py-4">
                          No replies yet. Be the first to respond below.
                        </p>
                      ) : (
                        activeThread.replies.map((reply) => (
                          <div
                            key={reply.id}
                            className="rounded-xl border border-white/[0.08] bg-[#121620] p-4"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                                <span className="font-semibold text-[#f5f4f0] break-words">
                                  {reply.author}
                                </span>
                                <span className="font-medium text-[#3ddc97] break-words">
                                  {reply.yearLevel}
                                </span>
                              </div>
                              <span className="text-[#949ba8] tabular-nums shrink-0">
                                {reply.time}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-[#e2e5eb] leading-relaxed break-words">
                              {reply.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {canPost ? (
                      <form
                        onSubmit={handleReplySubmit}
                        className="shrink-0 border-t border-white/[0.08] bg-[#121620] px-6 py-3.5 space-y-2.5"
                      >
                        {official ? (
                          <div className="flex items-center justify-between gap-2 rounded-lg border border-[#3ddc97]/25 bg-[#0b0e15] px-3 py-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 font-semibold text-[#f5f4f0]">
                              <ShieldCheck
                                className="h-3.5 w-3.5 text-[#3ddc97]"
                                aria-hidden="true"
                              />
                              Replying as {official.name}
                            </span>
                            <span className="font-semibold text-[#3ddc97]">
                              {official.position}
                            </span>
                          </div>
                        ) : (
                          student && (
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-[#facc15]/25 bg-[#0b0e15] px-3 py-2 text-xs">
                              <span className="inline-flex items-center gap-1.5 font-semibold text-[#f5f4f0]">
                                <GraduationCap
                                  className="h-3.5 w-3.5 text-[#facc15]"
                                  aria-hidden="true"
                                />
                                {student.name}
                              </span>
                              <button
                                type="button"
                                onClick={onOpenStudentAuth}
                                className="font-semibold text-[#facc15] hover:underline cursor-pointer"
                              >
                                {student.yearCourse || 'Student Profile'}
                              </button>
                            </div>
                          )
                        )}

                        <div className="flex gap-2">
                          <input
                            ref={desktopReplyInputRef}
                            type="text"
                            required
                            value={replyMessage}
                            onChange={(e) => setReplyMessage(e.target.value)}
                            placeholder="Write a reply to this thread..."
                            aria-label="Write a reply"
                            className="flex-1 min-h-[44px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                          />
                          <button
                            type="submit"
                            className="gemini-cta inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold rounded-lg active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <Send className="h-4 w-4" aria-hidden="true" />
                            <span>Post Reply</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="shrink-0 border-t border-white/[0.08] bg-[#121620] px-6 py-4 flex items-center justify-between gap-3">
                        <p className="text-xs sm:text-sm text-[#b4bac6]">
                          Sign in with your student or officer account to post replies.
                        </p>
                        <button
                          type="button"
                          onClick={onOpenStudentAuth}
                          className="gemini-cta inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <GraduationCap className="h-4 w-4" aria-hidden="true" />
                          <span>Sign In to Reply</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* MOBILE FOCUSED THREAD SHEET */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {mobileSheetOpen && activeThread && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-thread-title"
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-50 h-[100dvh] lg:hidden flex flex-col bg-[#0b0e15]"
              >
                <div className="shrink-0 border-b border-white/[0.08] bg-[#07090e] px-4 py-2.5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileSheetOpen(false)}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-sm font-semibold text-[#3ddc97] cursor-pointer"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    <span>Back to Threads</span>
                  </button>

                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-semibold text-[#facc15] truncate">
                      {activeThread.topic}
                    </span>
                    <button
                      type="button"
                      aria-label="Close discussion"
                      onClick={() => setMobileSheetOpen(false)}
                      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-[#b4bac6] hover:bg-[#181d29] hover:text-[#f5f4f0] cursor-pointer shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div
                  ref={mobileRepliesBoxRef}
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar px-4 py-5 space-y-5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3 text-xs text-[#b4bac6]">
                      <span className="font-semibold text-[#f5f4f0] truncate">
                        {activeThread.author}
                      </span>
                      <span className="inline-flex items-center gap-1 shrink-0 text-[#949ba8] tabular-nums">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {activeThread.postedAt}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#949ba8]">
                      {activeThread.yearLevel}
                    </p>

                    <h2
                      id="mobile-thread-title"
                      className="mt-2.5 text-xl font-bold text-[#f5f4f0] leading-snug break-words"
                    >
                      {activeThread.title}
                    </h2>

                    <p className="mt-3 text-[15px] text-[#e2e5eb] leading-relaxed break-words">
                      {activeThread.body}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => toggleSupport(activeThread.id)}
                        className={`inline-flex items-center gap-2 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-lg border active:scale-[0.98] transition-transform tabular-nums cursor-pointer ${
                          supportedIds[activeThread.id]
                            ? 'bg-[#facc15]/15 border-[#facc15]/40 text-[#facc15]'
                            : 'bg-[#121620] border-white/[0.12] text-[#f5f4f0]'
                        }`}
                      >
                        <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {supportedIds[activeThread.id]
                            ? 'Supported'
                            : 'Support Proposal'}{' '}
                          ({activeThread.supportCount})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!canPost) {
                            onOpenStudentAuth();
                            return;
                          }
                          mobileReplyInputRef.current?.focus();
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-4 py-2 text-xs font-semibold rounded-lg bg-[#3ddc97]/10 border border-[#3ddc97]/30 text-[#3ddc97] cursor-pointer"
                      >
                        <MessageSquare className="h-4 w-4" aria-hidden="true" />
                        <span>Focus Reply Box</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/[0.08] space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#949ba8] tabular-nums">
                      Replies ({activeThread.replies.length})
                    </h3>

                    {activeThread.replies.length === 0 ? (
                      <p className="text-sm text-[#949ba8]">
                        No replies yet. Write a reply in the bar below.
                      </p>
                    ) : (
                      activeThread.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-xl border border-white/[0.08] bg-[#121620] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex flex-wrap items-baseline gap-2 min-w-0">
                              <span className="font-semibold text-[#f5f4f0] break-words">
                                {reply.author}
                              </span>
                              <span className="font-medium text-[#3ddc97] break-words">
                                {reply.yearLevel}
                              </span>
                            </div>
                            <span className="text-[#949ba8] tabular-nums shrink-0">
                              {reply.time}
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-[#e2e5eb] leading-relaxed break-words">
                            {reply.message}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {canPost ? (
                  <form
                    onSubmit={handleReplySubmit}
                    className="shrink-0 border-t border-white/[0.08] bg-[#121620] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2"
                  >
                    <div className="flex gap-2">
                      <input
                        ref={mobileReplyInputRef}
                        type="text"
                        required
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Write a reply..."
                        aria-label="Write a reply"
                        className="flex-1 min-h-[44px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                      <button
                        type="submit"
                        className="gemini-cta inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 text-sm font-semibold rounded-lg active:scale-[0.98] transition-transform whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Send className="h-4 w-4" aria-hidden="true" />
                        <span>Reply</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="shrink-0 border-t border-white/[0.08] bg-[#121620] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
                    <span className="text-xs text-[#b4bac6]">
                      Sign in as a student or officer to reply.
                    </span>
                    <button
                      type="button"
                      onClick={onOpenStudentAuth}
                      className="gemini-cta inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Sign In</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* NEW DISCUSSION POP-UP MODAL (Protected by Discard / Keep Editing Guard) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showNewForm && canPost && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-discussion-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => setShowDiscardConfirm(true)}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleCreateThread}
                  className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <div>
                      <h2
                        id="new-discussion-title"
                        className="text-lg font-bold text-[#f5f4f0]"
                      >
                        Start a Student Discussion
                      </h2>
                      <p className="mt-0.5 text-xs text-[#949ba8]">
                        {official
                          ? `Posting verified update as ${official.name}`
                          : `Signed in as ${student?.name ?? 'SLAC Student'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close discussion form"
                      onClick={() => setShowDiscardConfirm(true)}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Discard / Keep Editing Guard */}
                  <AnimatePresence>
                    {showDiscardConfirm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-b border-[#facc15]/35 bg-[#facc15]/10 px-6 py-3 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <AlertTriangle
                            className="h-4 w-4 text-[#facc15] shrink-0"
                            aria-hidden="true"
                          />
                          <span className="text-xs font-bold text-[#f5f4f0]">
                            Discard ongoing discussion draft?
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDiscardConfirm(false)}
                            className="min-h-[34px] px-3 py-1 rounded-lg bg-[#3ddc97] text-xs font-semibold text-[#042412] cursor-pointer"
                          >
                            Keep Editing
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardNewForm}
                            className="min-h-[34px] px-3 py-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] cursor-pointer"
                          >
                            Discard Changes
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                      {official ? (
                        <div className="sm:col-span-2 rounded-xl border border-[#3ddc97]/25 bg-[#0b0e15] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#f5f4f0]">
                            <ShieldCheck
                              className="h-4 w-4 text-[#3ddc97]"
                              aria-hidden="true"
                            />
                            <span>{official.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-[#3ddc97]">
                            {official.position}
                          </span>
                        </div>
                      ) : (
                        student && (
                          <div className="sm:col-span-2 rounded-xl border border-[#facc15]/25 bg-[#0b0e15] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#f5f4f0]">
                              <GraduationCap
                                className="h-4 w-4 text-[#facc15]"
                                aria-hidden="true"
                              />
                              <span>{student.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setShowNewForm(false);
                                onOpenStudentAuth();
                              }}
                              className="text-xs font-semibold text-[#facc15] hover:underline cursor-pointer"
                            >
                              Change
                            </button>
                          </div>
                        )
                      )}

                      <div>
                        <label
                          htmlFor="forum-topic"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Topic
                        </label>
                        <select
                          id="forum-topic"
                          value={newTopic}
                          onChange={(e) => setNewTopic(e.target.value)}
                          className="w-full min-h-[44px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        >
                          {dynamicTopics.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value={CUSTOM_TOPIC_VALUE}>
                            Others (Custom Topic)
                          </option>
                        </select>
                      </div>
                    </div>

                    {newTopic === CUSTOM_TOPIC_VALUE && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label
                            htmlFor="forum-custom-topic"
                            className="block text-xs font-semibold text-[#facc15]"
                          >
                            State Custom Topic
                          </label>
                          <span className="text-[11px] font-medium text-[#949ba8] tabular-nums">
                            {customTopic.length}/{MAX_CUSTOM_TOPIC_LEN}
                          </span>
                        </div>
                        <input
                          id="forum-custom-topic"
                          type="text"
                          required
                          maxLength={MAX_CUSTOM_TOPIC_LEN}
                          value={customTopic}
                          onChange={(e) =>
                            setCustomTopic(
                              e.target.value.slice(0, MAX_CUSTOM_TOPIC_LEN)
                            )
                          }
                          placeholder="State custom topic (max 32 characters)..."
                          className="w-full min-h-[44px] rounded-lg border border-[#facc15]/35 bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="forum-title"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Discussion Title
                      </label>
                      <input
                        id="forum-title"
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Write a clear, specific topic title..."
                        className="w-full min-h-[44px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="forum-body"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Details
                      </label>
                      <textarea
                        id="forum-body"
                        rows={4}
                        required
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        placeholder="Explain your idea or question for fellow students and SSC officers..."
                        className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setShowDiscardConfirm(true)}
                        className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] hover:text-[#f5f4f0] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[44px] px-5 py-2 text-sm font-semibold rounded-lg active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        Publish Discussion
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
