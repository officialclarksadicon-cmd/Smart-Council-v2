import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowBigUp,
  Check,
  Clock,
  Flame,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
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
  onToggleSupport: (threadId: string, delta: 1 | -1) => void;
}

const SUPPORTED_THREADS_KEY = 'smart_council_supported_threads_v2';
const CUSTOM_TOPIC_VALUE = '__custom_topic__';
const MAX_CUSTOM_TOPIC_LEN = 32;

type SortMode = 'hot' | 'new' | 'discussed';

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'SC';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function isOfficialLabel(yearLevel: string): boolean {
  const lower = yearLevel.toLowerCase();
  return (
    lower.includes('ssc') ||
    lower.includes('president') ||
    lower.includes('secretary') ||
    lower.includes('treasurer') ||
    lower.includes('auditor') ||
    lower.includes('senator') ||
    lower.includes('governor') ||
    lower.includes('representative') ||
    lower.includes('head of') ||
    lower.includes('officer') ||
    lower.includes('admin')
  );
}

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
  const [selectedTopic, setSelectedTopic] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [expandedThreadIds, setExpandedThreadIds] = useState<
    Record<string, boolean>
  >(() => (threads[0]?.id ? { [threads[0].id]: true } : {}));
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [copiedThreadId, setCopiedThreadId] = useState<string | null>(null);

  const [supportedMap, setSupportedMap] = useState<
    Record<string, Record<string, boolean>>
  >(() => {
    try {
      const saved = window.localStorage.getItem(SUPPORTED_THREADS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch {
      // Ignore storage errors
    }
    return {};
  });

  const currentAccountKey = official
    ? `official:${official.email.toLowerCase()}`
    : student
      ? `student:${student.identifier.toLowerCase()}`
      : 'guest';

  const supportedIds = supportedMap[currentAccountKey] ?? {};

  // Text-Only New Thread Modal State
  const [showNewForm, setShowNewForm] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState<string>(
    filterOptions[0] ?? 'Academic Affairs'
  );
  const [customTopic, setCustomTopic] = useState('');
  const [newBody, setNewBody] = useState('');

  const replyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    try {
      window.localStorage.setItem(
        SUPPORTED_THREADS_KEY,
        JSON.stringify(supportedMap)
      );
    } catch {
      // Ignore storage errors
    }
  }, [supportedMap]);

  const dynamicTopics = useMemo(() => {
    const set = new Set<string>(filterOptions);
    threads.forEach((t) => {
      if (t.topic && t.topic.trim()) {
        set.add(t.topic.trim());
      }
    });
    return Array.from(set);
  }, [filterOptions, threads]);

  const topics = useMemo(() => ['All', ...dynamicTopics], [dynamicTopics]);

  const filteredThreads = useMemo(() => {
    const matching = threads.filter((t) => {
      const matchesTopic = selectedTopic === 'All' || t.topic === selectedTopic;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q);
      return matchesTopic && matchesSearch;
    });

    return [...matching].sort((a, b) => {
      if (sortMode === 'hot') {
        const scoreA = a.supportCount * 2 + a.replies.length;
        const scoreB = b.supportCount * 2 + b.replies.length;
        if (scoreB !== scoreA) return scoreB - scoreA;
      } else if (sortMode === 'discussed') {
        if (b.replies.length !== a.replies.length) {
          return b.replies.length - a.replies.length;
        }
      }
      return 0;
    });
  }, [threads, selectedTopic, searchQuery, sortMode]);

  const totalRepliesCount = useMemo(
    () => threads.reduce((acc, t) => acc + t.replies.length, 0),
    [threads]
  );

  // Lock background scroll when New Discussion modal is open
  useEffect(() => {
    if (!showNewForm) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDiscardConfirm(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showNewForm]);

  const canPost = Boolean(student || official);

  const toggleThreadExpanded = (threadId: string, focusReply = false) => {
    onMarkSeen?.(threadId);
    setExpandedThreadIds((prev) => {
      const nextOpen = focusReply ? true : !prev[threadId];
      if (nextOpen && focusReply) {
        window.setTimeout(() => {
          replyInputRefs.current[threadId]?.focus();
        }, 80);
      }
      return { ...prev, [threadId]: nextOpen };
    });
  };

  const toggleSupport = (threadId: string) => {
    onMarkSeen?.(threadId);
    const alreadySupported = Boolean(supportedIds[threadId]);
    const delta: 1 | -1 = alreadySupported ? -1 : 1;
    setSupportedMap((prev) => ({
      ...prev,
      [currentAccountKey]: {
        ...(prev[currentAccountKey] ?? {}),
        [threadId]: !alreadySupported,
      },
    }));
    onToggleSupport(threadId, delta);
  };

  const handleShareThread = async (thread: ForumThread) => {
    const shareText = `${thread.title} — c/SLACSmartCouncil (${window.location.origin}/#forum)`;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopiedThreadId(thread.id);
      window.setTimeout(() => {
        setCopiedThreadId((prev) => (prev === thread.id ? null : prev));
      }, 1800);
    } catch {
      // Ignore clipboard errors
    }
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
    const cleanTitle = newTitle.trim();
    const cleanBody = newBody.trim();
    const resolvedTopic =
      newTopic === CUSTOM_TOPIC_VALUE
        ? customTopic.trim().slice(0, MAX_CUSTOM_TOPIC_LEN)
        : newTopic;

    if (!cleanTitle || !cleanBody || !resolvedTopic) return;

    const authorName = official
      ? official.name
      : (student?.name ?? 'SLAC Student');
    const authorRole = official
      ? `SSC ${official.position}`
      : (student?.yearCourse ?? 'Student');

    const created: ForumThread = {
      id: `thread-${Date.now()}`,
      title: cleanTitle,
      author: authorName,
      yearLevel: authorRole,
      topic: resolvedTopic,
      postedAt: 'Just now',
      supportCount: 1,
      body: cleanBody,
      replies: [],
    };

    onAddThread(created);
    onMarkSeen?.(created.id);
    setExpandedThreadIds((prev) => ({ ...prev, [created.id]: true }));
    setNewTitle('');
    setNewBody('');
    setCustomTopic('');
    setShowDiscardConfirm(false);
    setShowNewForm(false);
  };

  const handleReplySubmit = (e: FormEvent, threadId: string) => {
    e.preventDefault();
    if (!canPost) {
      onOpenStudentAuth();
      return;
    }
    const cleanMsg = (replyDrafts[threadId] ?? '').trim();
    if (!cleanMsg) return;

    const replyAuthor = official
      ? official.name
      : (student?.name ?? 'SLAC Student');
    const replyRole = official
      ? `SSC ${official.position}`
      : (student?.yearCourse ?? 'Student');

    const createdReply: ForumReply = {
      id: `reply-${Date.now()}`,
      author: replyAuthor,
      yearLevel: replyRole,
      time: 'Just now',
      message: cleanMsg,
    };

    onAddReply(threadId, createdReply);
    setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }));
    setExpandedThreadIds((prev) => ({ ...prev, [threadId]: true }));
  };

  return (
    <section
      aria-label="Student Forum"
      className="w-full py-6 sm:py-10 border-b border-white/[0.08]"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-8 space-y-5">
        <PageSubNav currentPage="forum" onNavigate={onNavigate} />

        {/* Compact Feed Header */}
        <ScrollReveal>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/[0.12]">
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#3ddc97]">
                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                <span>c/SLACSmartCouncil • Campus Threads</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#f5f4f0] tracking-tight">
                Student Forum
              </h1>
              <p className="text-xs sm:text-sm text-[#b4bac6]">
                Text-only student threads, campus proposals, and direct SSC responses.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {official && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 text-xs font-semibold text-[#f5f4f0] rounded-lg border border-white/[0.16] bg-[#121620] hover:border-white/[0.28] transition-colors cursor-pointer"
                >
                  <LayoutDashboard
                    className="h-3.5 w-3.5 text-[#3ddc97]"
                    aria-hidden="true"
                  />
                  <span>Manage in SSC Suite</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!canPost) {
                    onOpenStudentAuth();
                    return;
                  }
                  setShowDiscardConfirm(false);
                  setShowNewForm(true);
                }}
                className="gemini-cta inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg active:scale-[0.98] transition-transform cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>New Thread</span>
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Main 2-Column Hybrid Feed Layout (Threads Feed on Left, Community Card on Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (lg:col-span-8): Threads-Style Vertical Feed + Reddit Upvote Pills */}
          <div className="lg:col-span-8 space-y-4 min-w-0">
            {/* 1. Threads-Style Quick Compose Prompt Bar */}
            <div className="card-elevated rounded-2xl p-4 sm:p-4.5">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold border ${
                    official
                      ? 'bg-[#3ddc97]/15 text-[#3ddc97] border-[#3ddc97]/35'
                      : student
                        ? 'bg-[#facc15]/15 text-[#facc15] border-[#facc15]/35'
                        : 'bg-[#181d29] text-[#b4bac6] border-white/[0.14]'
                  }`}
                >
                  {official ? (
                    <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
                  ) : student ? (
                    getInitials(student.name)
                  ) : (
                    <GraduationCap className="h-4.5 w-4.5" aria-hidden="true" />
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    if (!canPost) {
                      onOpenStudentAuth();
                      return;
                    }
                    setShowDiscardConfirm(false);
                    setShowNewForm(true);
                  }}
                  className="flex-1 min-h-[42px] rounded-full border border-white/[0.14] bg-[#0b0e15] px-4 py-2 text-left text-xs sm:text-sm text-[#949ba8] hover:border-white/[0.26] hover:text-[#f5f4f0] transition-colors cursor-pointer truncate"
                >
                  {canPost
                    ? `Start a thread as ${official ? official.name : student?.name}...`
                    : 'Sign in to start a campus thread or ask the SSC...'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!canPost) {
                      onOpenStudentAuth();
                      return;
                    }
                    setShowDiscardConfirm(false);
                    setShowNewForm(true);
                  }}
                  className="gemini-cta hidden sm:inline-flex items-center justify-center h-9 px-4 rounded-full text-xs font-semibold shrink-0 cursor-pointer"
                >
                  Post
                </button>
              </div>
            </div>

            {/* 2. Reddit-Style Sort & Topic Filter Controls */}
            <div className="rounded-2xl border border-white/[0.14] bg-[#121620] p-3 sm:p-3.5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {/* Sort Pills (Hot / New / Discussed) */}
                <div
                  role="tablist"
                  aria-label="Sort threads"
                  className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0b0e15] border border-white/[0.1] self-start"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sortMode === 'hot'}
                    onClick={() => setSortMode('hot')}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      sortMode === 'hot'
                        ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18]'
                        : 'text-[#949ba8] hover:text-[#f5f4f0]'
                    }`}
                  >
                    <Flame className="h-3.5 w-3.5 text-[#e8985e]" aria-hidden="true" />
                    <span>Hot</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sortMode === 'new'}
                    onClick={() => setSortMode('new')}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      sortMode === 'new'
                        ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18]'
                        : 'text-[#949ba8] hover:text-[#f5f4f0]'
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-[#3ddc97]" aria-hidden="true" />
                    <span>Newest</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={sortMode === 'discussed'}
                    onClick={() => setSortMode('discussed')}
                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      sortMode === 'discussed'
                        ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18]'
                        : 'text-[#949ba8] hover:text-[#f5f4f0]'
                    }`}
                  >
                    <MessageCircle
                      className="h-3.5 w-3.5 text-[#facc15]"
                      aria-hidden="true"
                    />
                    <span>Top Replies</span>
                  </button>
                </div>

                {/* Search Input */}
                <div className="relative flex-1 sm:max-w-xs">
                  <Search
                    className="h-3.5 w-3.5 text-[#949ba8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search threads..."
                    aria-label="Search threads"
                    className="w-full h-9 rounded-xl border border-white/[0.12] bg-[#0b0e15] pl-8.5 pr-3 text-xs text-[#f5f4f0] placeholder:text-[#949ba8]"
                  />
                </div>
              </div>

              {/* Topic Filter Pills */}
              <div className="pt-1 border-t border-white/[0.08]">
                <ResistiveFilterBar
                  ariaLabel="Filter forum threads by topic"
                  compact
                  value={selectedTopic}
                  onChange={setSelectedTopic}
                  options={topics.map((topic) => ({
                    value: topic,
                    label: topic,
                    tone: topic === 'All' ? 'yellow' : 'green',
                  }))}
                />
              </div>
            </div>

            {/* 3. Thread Feed List */}
            {filteredThreads.length === 0 ? (
              <div className="card-elevated rounded-2xl p-10 text-center space-y-3">
                <p className="text-base font-bold text-[#f5f4f0]">
                  No threads match your current filter
                </p>
                <p className="text-xs sm:text-sm text-[#949ba8] max-w-md mx-auto">
                  Try selecting &ldquo;All&rdquo; topics or start the first text discussion on this subject.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredThreads.map((thread) => {
                  const isSupported = Boolean(supportedIds[thread.id]);
                  const isUnread = !seenIds[thread.id];
                  const isExpanded = Boolean(expandedThreadIds[thread.id]);
                  const authorIsOfficial = isOfficialLabel(thread.yearLevel);
                  const replyDraft = replyDrafts[thread.id] ?? '';

                  return (
                    <article
                      key={thread.id}
                      onClick={() => onMarkSeen?.(thread.id)}
                      className="card-elevated rounded-2xl p-4 sm:p-5 transition-all"
                    >
                      {/* Main Post Row with Left Threads Avatar + Timeline Spine */}
                      <div className="flex items-stretch gap-3.5">
                        {/* Left Column: Avatar + Threads Vertical Timeline Connector */}
                        <div className="flex flex-col items-center shrink-0">
                          <span
                            className={`inline-flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold border ${
                              authorIsOfficial
                                ? 'bg-[#3ddc97]/15 text-[#3ddc97] border-[#3ddc97]/40'
                                : 'bg-[#181d29] text-[#f5f4f0] border-white/[0.16]'
                            }`}
                          >
                            {authorIsOfficial ? (
                              <ShieldCheck
                                className="h-4.5 w-4.5"
                                aria-hidden="true"
                              />
                            ) : (
                              getInitials(thread.author)
                            )}
                          </span>

                          {/* Continuous Vertical Thread Line */}
                          {(thread.replies.length > 0 || isExpanded) && (
                            <div
                              aria-hidden="true"
                              className="w-[2px] flex-1 my-2 rounded-full bg-white/[0.14]"
                            />
                          )}

                          {/* Mini Reply Count Dot at Bottom of Spine when Collapsed */}
                          {!isExpanded && thread.replies.length > 0 && (
                            <span
                              aria-hidden="true"
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#181d29] border border-white/[0.16] text-[10px] font-bold text-[#3ddc97] tabular-nums"
                            >
                              {thread.replies.length}
                            </span>
                          )}
                        </div>

                        {/* Right Column: Header Metadata + Post Title & Text Body + Reddit Action Bar */}
                        <div className="flex-1 min-w-0 space-y-2.5">
                          {/* Top Meta Bar (Author, Role/Course, Topic Pill, Timestamp) */}
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs min-w-0">
                              <span className="font-bold text-[#f5f4f0] truncate">
                                {thread.author}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium border ${
                                  authorIsOfficial
                                    ? 'bg-[#3ddc97]/12 text-[#3ddc97] border-[#3ddc97]/30'
                                    : 'bg-[#0b0e15] text-[#b4bac6] border-white/[0.1]'
                                }`}
                              >
                                {thread.yearLevel}
                              </span>
                              <span className="text-[#949ba8]">•</span>
                              <span className="inline-flex items-center gap-1 text-[#949ba8] tabular-nums">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                {thread.postedAt}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isUnread && (
                                <span className="rounded-full bg-[#ef4444] px-2 py-0.5 text-[10px] font-bold text-white">
                                  New
                                </span>
                              )}
                              <span className="rounded-full border border-white/[0.14] bg-[#181d29] px-2.5 py-0.5 text-[11px] font-semibold text-[#facc15]">
                                {thread.topic}
                              </span>
                            </div>
                          </div>

                          {/* Post Title & Message Body (Text-Only) */}
                          <div
                            onClick={() => toggleThreadExpanded(thread.id)}
                            className="space-y-1.5 cursor-pointer"
                          >
                            <h2 className="text-base sm:text-lg font-bold text-[#f5f4f0] leading-snug break-words">
                              {thread.title}
                            </h2>
                            <p className="text-sm sm:text-[15px] text-[#e2e5eb] leading-relaxed whitespace-pre-line break-words">
                              {thread.body}
                            </p>
                          </div>

                          {/* Hybrid Reddit + Threads Action Pill Bar */}
                          <div className="pt-1.5 flex flex-wrap items-center gap-2">
                            {/* Reddit-Style Upvote / Support Pill */}
                            <button
                              type="button"
                              onClick={() => toggleSupport(thread.id)}
                              aria-pressed={isSupported}
                              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all active:scale-95 tabular-nums cursor-pointer ${
                                isSupported
                                  ? 'bg-[#3ddc97]/15 border-[#3ddc97]/45 text-[#3ddc97]'
                                  : 'bg-[#0b0e15] border-white/[0.14] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.26]'
                              }`}
                            >
                              <ArrowBigUp
                                className={`h-4 w-4 ${
                                  isSupported ? 'fill-current' : ''
                                }`}
                                aria-hidden="true"
                              />
                              <span>{isSupported ? 'Upvoted' : 'Upvote'}</span>
                              <span className="pl-1 border-l border-current/25 font-bold">
                                {thread.supportCount}
                              </span>
                            </button>

                            {/* Threads / Reddit Replies Toggle Pill */}
                            <button
                              type="button"
                              onClick={() => toggleThreadExpanded(thread.id)}
                              aria-expanded={isExpanded}
                              className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-semibold border transition-all tabular-nums cursor-pointer ${
                                isExpanded
                                  ? 'bg-[#181d29] border-white/[0.24] text-[#f5f4f0]'
                                  : 'bg-[#0b0e15] border-white/[0.14] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.26]'
                              }`}
                            >
                              <MessageCircle
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>
                                {thread.replies.length}{' '}
                                {thread.replies.length === 1
                                  ? 'Reply'
                                  : 'Replies'}
                              </span>
                            </button>

                            {/* Quick Reply Focus Button */}
                            <button
                              type="button"
                              onClick={() => toggleThreadExpanded(thread.id, true)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-white/[0.12] bg-[#0b0e15] text-[#b4bac6] hover:text-[#f5f4f0] hover:border-white/[0.24] transition-colors cursor-pointer"
                            >
                              <span>Reply</span>
                            </button>

                            {/* Share / Copy Link Pill */}
                            <button
                              type="button"
                              onClick={() => void handleShareThread(thread)}
                              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-white/[0.12] bg-[#0b0e15] text-[#949ba8] hover:text-[#f5f4f0] transition-colors cursor-pointer"
                            >
                              {copiedThreadId === thread.id ? (
                                <>
                                  <Check
                                    className="h-3.5 w-3.5 text-[#3ddc97]"
                                    aria-hidden="true"
                                  />
                                  <span className="text-[#3ddc97]">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Share2
                                    className="h-3.5 w-3.5"
                                    aria-hidden="true"
                                  />
                                  <span>Share</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Inline Threads-Style Nested Replies & Reply Composer */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.18, ease: 'easeOut' }}
                                className="overflow-hidden pt-3"
                              >
                                <div className="space-y-3 border-t border-white/[0.1] pt-3.5">
                                  {thread.replies.length === 0 ? (
                                    <p className="text-xs text-[#949ba8] py-1">
                                      No replies yet. Be the first to respond to this thread.
                                    </p>
                                  ) : (
                                    <div className="space-y-2.5">
                                      {thread.replies.map((reply, idx) => {
                                        const replyIsOfficial = isOfficialLabel(
                                          reply.yearLevel
                                        );
                                        const isLastReply =
                                          idx === thread.replies.length - 1;

                                        return (
                                          <div
                                            key={reply.id}
                                            className="flex items-stretch gap-2.5"
                                          >
                                            {/* Mini Reply Avatar + Thread Spine */}
                                            <div className="flex flex-col items-center shrink-0">
                                              <span
                                                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold border ${
                                                  replyIsOfficial
                                                    ? 'bg-[#3ddc97]/15 text-[#3ddc97] border-[#3ddc97]/40'
                                                    : 'bg-[#0b0e15] text-[#b4bac6] border-white/[0.14]'
                                                }`}
                                              >
                                                {replyIsOfficial ? (
                                                  <ShieldCheck
                                                    className="h-3.5 w-3.5"
                                                    aria-hidden="true"
                                                  />
                                                ) : (
                                                  getInitials(reply.author)
                                                )}
                                              </span>
                                              {!isLastReply && (
                                                <div
                                                  aria-hidden="true"
                                                  className="w-[1.5px] flex-1 my-1 bg-white/[0.1]"
                                                />
                                              )}
                                            </div>

                                            {/* Reply Bubble */}
                                            <div className="flex-1 min-w-0 rounded-xl border border-white/[0.1] bg-[#0b0e15] p-3 space-y-1">
                                              <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
                                                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                                  <span className="font-bold text-[#f5f4f0]">
                                                    {reply.author}
                                                  </span>
                                                  <span
                                                    className={`text-[11px] font-medium ${
                                                      replyIsOfficial
                                                        ? 'text-[#3ddc97]'
                                                        : 'text-[#949ba8]'
                                                    }`}
                                                  >
                                                    {reply.yearLevel}
                                                  </span>
                                                  {replyIsOfficial && (
                                                    <span className="rounded-md bg-[#3ddc97]/15 border border-[#3ddc97]/30 px-1.5 py-0.2 text-[10px] font-semibold text-[#3ddc97]">
                                                      SSC Official
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="text-[11px] text-[#949ba8] tabular-nums shrink-0">
                                                  {reply.time}
                                                </span>
                                              </div>
                                              <p className="text-xs sm:text-sm text-[#e2e5eb] leading-relaxed break-words">
                                                {reply.message}
                                              </p>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Inline Text-Only Reply Input */}
                                  {canPost ? (
                                    <form
                                      onSubmit={(e) =>
                                        handleReplySubmit(e, thread.id)
                                      }
                                      className="flex items-center gap-2 pt-1"
                                    >
                                      <input
                                        ref={(el) => {
                                          replyInputRefs.current[thread.id] = el;
                                        }}
                                        type="text"
                                        required
                                        value={replyDraft}
                                        onChange={(e) =>
                                          setReplyDrafts((prev) => ({
                                            ...prev,
                                            [thread.id]: e.target.value,
                                          }))
                                        }
                                        placeholder={`Reply to ${thread.author}...`}
                                        aria-label={`Reply to ${thread.title}`}
                                        className="flex-1 min-h-[38px] rounded-full border border-white/[0.14] bg-[#0b0e15] px-4 py-1.5 text-xs sm:text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                                      />
                                      <button
                                        type="submit"
                                        className="gemini-cta inline-flex items-center gap-1.5 h-[38px] px-4 rounded-full text-xs font-semibold shrink-0 cursor-pointer"
                                      >
                                        <Send
                                          className="h-3.5 w-3.5"
                                          aria-hidden="true"
                                        />
                                        <span>Reply</span>
                                      </button>
                                    </form>
                                  ) : (
                                    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.1] bg-[#0b0e15] px-3.5 py-2.5">
                                      <span className="text-xs text-[#b4bac6]">
                                        Sign in to join the conversation and post a reply.
                                      </span>
                                      <button
                                        type="button"
                                        onClick={onOpenStudentAuth}
                                        className="gemini-cta inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 cursor-pointer"
                                      >
                                        <GraduationCap
                                          className="h-3.5 w-3.5"
                                          aria-hidden="true"
                                        />
                                        <span>Sign In</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (lg:col-span-4): Reddit-Style Community Info & Rules Card */}
          <aside className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
            <div className="card-elevated rounded-2xl p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-white/[0.1]">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3ddc97]/15 border border-[#3ddc97]/35 text-[#3ddc97]">
                  <MessageSquare className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-[#f5f4f0]">
                    c/SLACSmartCouncil
                  </h2>
                  <p className="text-xs text-[#949ba8]">
                    Official SLAC Student Community
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#b4bac6] leading-relaxed">
                A text-first forum where SLAC students share campus proposals, ask academic questions, and receive verified responses from Supreme Student Council officers.
              </p>

              {/* Community Metrics */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <div className="rounded-xl border border-white/[0.1] bg-[#0b0e15] p-3">
                  <p className="text-lg font-bold text-[#f5f4f0] tabular-nums">
                    {threads.length}
                  </p>
                  <p className="text-[11px] text-[#949ba8]">Active Threads</p>
                </div>
                <div className="rounded-xl border border-white/[0.1] bg-[#0b0e15] p-3">
                  <p className="text-lg font-bold text-[#3ddc97] tabular-nums">
                    {totalRepliesCount}
                  </p>
                  <p className="text-[11px] text-[#949ba8]">Total Replies</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!canPost) {
                    onOpenStudentAuth();
                    return;
                  }
                  setShowDiscardConfirm(false);
                  setShowNewForm(true);
                }}
                className="gemini-cta w-full min-h-[40px] rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Create Text Thread</span>
              </button>
            </div>

            {/* Forum Guidelines */}
            <div className="card-elevated rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5f4f0]">
                Forum Guidelines
              </h3>
              <ol className="space-y-2 text-xs text-[#b4bac6] list-decimal list-inside">
                <li>Keep discussions respectful and constructive.</li>
                <li>Text-only posts — focus on clear ideas and questions.</li>
                <li>Upvote existing proposals to help SSC prioritize action.</li>
              </ol>
            </div>
          </aside>
        </div>
      </div>

      {/* TEXT-ONLY NEW THREAD COMPOSER MODAL */}
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
                className="fixed inset-0 z-[85] overflow-y-auto overscroll-contain flex items-center justify-center p-4 bg-black/60"
              >
                <motion.form
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleCreateThread}
                  className="my-auto w-full max-w-xl rounded-2xl border border-white/[0.16] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.1]">
                    <div>
                      <h2
                        id="new-discussion-title"
                        className="text-lg font-bold text-[#f5f4f0]"
                      >
                        New Campus Thread
                      </h2>
                      <p className="mt-0.5 text-xs text-[#949ba8]">
                        {official
                          ? `Posting verified thread as ${official.name}`
                          : `Posting as ${student?.name ?? 'SLAC Student'}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close thread composer"
                      onClick={() => setShowDiscardConfirm(true)}
                      className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-4.5 w-4.5" />
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
                            Discard this thread draft?
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowDiscardConfirm(false)}
                            className="min-h-[32px] px-3 py-1 rounded-lg bg-[#3ddc97] text-xs font-semibold text-[#042412] cursor-pointer"
                          >
                            Keep Editing
                          </button>
                          <button
                            type="button"
                            onClick={handleDiscardNewForm}
                            className="min-h-[32px] px-3 py-1 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] cursor-pointer"
                          >
                            Discard
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      {official ? (
                        <div className="sm:col-span-2 rounded-xl border border-[#3ddc97]/25 bg-[#0b0e15] px-3.5 py-2.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#f5f4f0]">
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
                          <div className="sm:col-span-2 rounded-xl border border-[#facc15]/25 bg-[#0b0e15] px-3.5 py-2.5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#f5f4f0]">
                              <GraduationCap
                                className="h-4 w-4 text-[#facc15]"
                                aria-hidden="true"
                              />
                              <span>{student.name}</span>
                            </div>
                            <span className="text-xs text-[#949ba8] truncate">
                              {student.yearCourse || 'SLAC Student'}
                            </span>
                          </div>
                        )
                      )}

                      <div>
                        <label
                          htmlFor="forum-topic"
                          className="block text-xs font-semibold text-[#b4bac6] mb-1"
                        >
                          Topic Tag
                        </label>
                        <select
                          id="forum-topic"
                          value={newTopic}
                          onChange={(e) => setNewTopic(e.target.value)}
                          className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3 py-2 text-xs sm:text-sm text-[#f5f4f0]"
                        >
                          {dynamicTopics.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                          <option value={CUSTOM_TOPIC_VALUE}>
                            Custom Topic...
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
                            Custom Topic Name
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
                          placeholder="e.g. Library Hours"
                          className="w-full min-h-[42px] rounded-xl border border-[#facc15]/35 bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="forum-title"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Title
                      </label>
                      <input
                        id="forum-title"
                        type="text"
                        required
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="Give your thread a clear, specific headline..."
                        className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="forum-body"
                        className="block text-xs font-semibold text-[#b4bac6] mb-1"
                      >
                        Message
                      </label>
                      <textarea
                        id="forum-body"
                        rows={4}
                        required
                        value={newBody}
                        onChange={(e) => setNewBody(e.target.value)}
                        placeholder="Write your message, question, or proposal..."
                        className="w-full rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-2.5">
                      <button
                        type="button"
                        onClick={() => setShowDiscardConfirm(true)}
                        className="min-h-[40px] px-4 py-2 text-xs sm:text-sm font-medium text-[#b4bac6] rounded-xl border border-white/[0.14] bg-[#181d29] hover:text-[#f5f4f0] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[40px] px-5 py-2 text-xs sm:text-sm font-semibold rounded-xl active:scale-[0.98] transition-transform cursor-pointer"
                      >
                        Post Thread
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
