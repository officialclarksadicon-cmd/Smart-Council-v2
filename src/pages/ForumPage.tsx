import React, { useState, useMemo, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Plus,
  X,
  UserCircle2,
  ThumbsUp,
  Clock,
  FolderOpen,
  MessagesSquare,
} from 'lucide-react';
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
  onOpenStudentAuth?: () => void;
  onNavigate: (page: PageRoute) => void;
  onAddThread: (thread: ForumThread) => void;
  onAddReply: (threadId: string, reply: ForumReply) => void;
  onDeleteThread?: (threadId: string) => void;
  onDeleteReply?: (threadId: string, replyId: string) => void;
  onToggleSupport: (threadId: string, delta: number) => void;
}

type SortByOption = 'recent' | 'discussed' | 'relevant';

export const ForumPage: React.FC<ForumPageProps> = ({
  threads,
  filterOptions,
  official,
  student,
  onMarkSeen,
  onOpenStudentAuth,
  onNavigate,
  onAddThread,
  onAddReply,
  onDeleteThread,
  onDeleteReply,
  onToggleSupport,
}) => {
  const categories = useMemo(
    () =>
      filterOptions.length > 0
        ? filterOptions
        : ['Campus Facilities', 'Student Welfare', 'Events & Activities'],
    [filterOptions]
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('All Boards');
  const [sortBy, setSortBy] = useState<SortByOption>('recent');
  const [showMyContributionsOnly, setShowMyContributionsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Composer state
  const [authorName, setAuthorName] = useState(() => {
    if (student?.name) return student.name;
    try {
      return localStorage.getItem('slac_student_forum_author') || '';
    } catch {
      return '';
    }
  });
  const [authorSection, setAuthorSection] = useState(() => {
    if (student?.yearCourse) return student.yearCourse;
    try {
      return localStorage.getItem('slac_student_forum_section') || '';
    } catch {
      return '';
    }
  });
  const [category, setCategory] = useState(categories[0] || 'Student Welfare');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync student profile when signed in
  useEffect(() => {
    if (student?.name) setAuthorName(student.name);
    if (student?.yearCourse) setAuthorSection(student.yearCourse);
  }, [student]);

  // Track student's own authored thread IDs and reply IDs in localStorage
  const [ownedThreadIds, setOwnedThreadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('slac_owned_threads');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [ownedReplyIds, setOwnedReplyIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('slac_owned_replies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('slac_owned_threads', JSON.stringify(ownedThreadIds));
    } catch {
      // ignore storage errors
    }
  }, [ownedThreadIds]);

  useEffect(() => {
    try {
      localStorage.setItem('slac_owned_replies', JSON.stringify(ownedReplyIds));
    } catch {
      // ignore storage errors
    }
  }, [ownedReplyIds]);

  // Reply state for dedicated thread view
  const [replyText, setReplyText] = useState('');
  const [replyAuthor, setReplyAuthor] = useState(() => {
    if (student?.name) return student.name;
    try {
      return localStorage.getItem('slac_student_forum_author') || '';
    } catch {
      return '';
    }
  });
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const isModerator = Boolean(official);
  const currentUserName = official
    ? official.name
    : student?.name || authorName || replyAuthor;
  const effectiveStudentName = currentUserName.trim().toLowerCase();

  const canDeleteThread = (thread: ForumThread) => {
    if (isModerator) return true;
    if (ownedThreadIds.includes(thread.id)) return true;
    if (
      effectiveStudentName &&
      thread.author.trim().toLowerCase() === effectiveStudentName
    ) {
      return true;
    }
    return false;
  };

  const canDeleteReply = (replyId: string, replyAuthorName: string) => {
    if (isModerator) return true;
    if (ownedReplyIds.includes(replyId)) return true;
    if (
      effectiveStudentName &&
      replyAuthorName.trim().toLowerCase() === effectiveStudentName
    ) {
      return true;
    }
    return false;
  };

  const availableCategories = useMemo(
    () => ['All Boards', ...categories],
    [categories]
  );

  const boardCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Boards': threads.length };
    categories.forEach((cat) => {
      counts[cat] = threads.filter((t) => t.topic === cat).length;
    });
    return counts;
  }, [threads, categories]);

  const filteredThreads = useMemo(() => {
    const list = threads.filter((t) => {
      const matchesCategory =
        selectedCategory === 'All Boards' || t.topic === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.body.toLowerCase().includes(q) ||
        t.author.toLowerCase().includes(q) ||
        t.topic.toLowerCase().includes(q);

      if (!matchesCategory || !matchesSearch) return false;

      if (showMyContributionsOnly) {
        const isAuthored = canDeleteThread(t);
        const hasReplied = t.replies.some((r) => canDeleteReply(r.id, r.author));
        return isAuthored || hasReplied;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'discussed') {
        return b.replies.length - a.replies.length;
      }
      if (sortBy === 'relevant') {
        const scoreA = a.supportCount + a.replies.length * 2;
        const scoreB = b.supportCount + b.replies.length * 2;
        return scoreB - scoreA;
      }
      return 0;
    });
  }, [
    threads,
    selectedCategory,
    searchQuery,
    sortBy,
    showMyContributionsOnly,
    ownedThreadIds,
    ownedReplyIds,
    effectiveStudentName,
  ]);

  const activeThread = useMemo(
    () =>
      activeThreadId
        ? threads.find((t) => t.id === activeThreadId) || null
        : null,
    [threads, activeThreadId]
  );

  const openThreadDetail = (threadId: string) => {
    setActiveThreadId(threadId);
    onMarkSeen?.(threadId);
  };

  const handleSubmitThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setIsSubmitting(true);
    try {
      const finalName = official
        ? official.name
        : student?.name || authorName.trim() || 'SLAC Student';
      const finalSection = official
        ? official.role === 'admin'
          ? `Web Admin (${official.position})`
          : `SSC Officer (${official.position})`
        : student?.yearCourse || authorSection.trim() || 'Student Body';

      if (!official && authorName.trim()) {
        localStorage.setItem('slac_student_forum_author', authorName.trim());
      }
      if (!official && authorSection.trim()) {
        localStorage.setItem('slac_student_forum_section', authorSection.trim());
      }

      const newThread: ForumThread = {
        id: `thread-${Date.now()}`,
        author: finalName,
        yearLevel: finalSection,
        postedAt: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }),
        topic: category,
        title: title.trim(),
        body: content.trim(),
        supportCount: 0,
        replies: [],
      };

      onAddThread(newThread);
      setOwnedThreadIds((prev) => [newThread.id, ...prev]);
      setTitle('');
      setContent('');
      setIsComposerOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (threadId: string) => {
    const text = replyText.trim();
    if (!text) return;
    const customName = replyAuthor.trim();
    const finalAuthor = official
      ? official.name
      : student?.name || customName || authorName.trim() || 'SLAC Student';
    const finalYearLevel = official
      ? official.role === 'admin'
        ? `Web Admin (${official.position})`
        : `SSC Officer (${official.position})`
      : student?.yearCourse || authorSection.trim() || 'Student Body';

    if (!official && customName) {
      try {
        localStorage.setItem('slac_student_forum_author', customName);
        if (!authorName) setAuthorName(customName);
      } catch {
        // ignore
      }
    }

    setIsSubmittingReply(true);
    try {
      const newReply: ForumReply = {
        id: `rep-${Date.now()}`,
        author: finalAuthor,
        yearLevel: finalYearLevel,
        time: new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: '2-digit',
          year: 'numeric',
        }),
        message: text,
      };
      onAddReply(threadId, newReply);
      setOwnedReplyIds((prev) => [newReply.id, ...prev]);
      setReplyText('');
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const isOfficialRoleLabel = (yearLevelText: string) => {
    const lower = yearLevelText.toLowerCase();
    return (
      lower.includes('ssc') ||
      lower.includes('admin') ||
      lower.includes('officer') ||
      lower.includes('president') ||
      lower.includes('secretary') ||
      lower.includes('treasurer') ||
      lower.includes('auditor')
    );
  };

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <PageSubNav currentPage="forum" onNavigate={onNavigate} />

        {/* Page Header — Matched to Announcements, Events, and FAQ Sections */}
        <ScrollReveal className="pb-6 border-b border-white/[0.14] flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <WordRevealText
              as="h1"
              text="Student Forum"
              className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]"
              y={24}
              stagger={0.08}
              highlightWords={['Forum']}
            />
            <p className="mt-2 text-sm sm:text-base text-[#b4bac6] max-w-2xl leading-relaxed">
              Submit formal academic inquiries, campus facility feedback, and student welfare proposals directly to the Supreme Student Council and fellow Louisianians.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsComposerOpen((v) => !v)}
              className="gemini-cta inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-semibold rounded-lg active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer"
            >
              {isComposerOpen ? (
                <>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Close Form</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>New Discussion Topic</span>
                </>
              )}
            </button>
          </div>
        </ScrollReveal>

        {/* Collapsible New Discussion Composer */}
        {isComposerOpen && (
          <div className="mt-6 card-elevated rounded-2xl overflow-hidden">
            <div
              className="h-[2px] w-full"
              style={{ backgroundColor: 'var(--ssc-green-bright)' }}
              aria-hidden="true"
            />
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-white/[0.12]">
                <div>
                  <span className="text-xs font-semibold text-[#3ddc97]">
                    New Formal Submission
                  </span>
                  <h2 className="text-xl font-bold text-[#f5f4f0] mt-0.5">
                    Create a Discussion Topic
                  </h2>
                </div>
                {!official && !student && onOpenStudentAuth && (
                  <button
                    type="button"
                    onClick={onOpenStudentAuth}
                    className="text-xs font-semibold text-[#3ddc97] hover:underline cursor-pointer"
                  >
                    Sign in with Student Profile &rarr;
                  </button>
                )}
              </div>

              <form onSubmit={handleSubmitThread} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {!official ? (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1.5">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={authorName}
                          onChange={(e) => setAuthorName(e.target.value)}
                          placeholder="e.g. Juan Dela Cruz"
                          className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1.5">
                          Course / Year &amp; Section
                        </label>
                        <input
                          type="text"
                          value={authorSection}
                          onChange={(e) => setAuthorSection(e.target.value)}
                          placeholder="e.g. BSIT 3-A"
                          className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="sm:col-span-2 flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#3ddc97]/30 bg-[#0b0e15]">
                      <ShieldCheck className="w-4 h-4 text-[#3ddc97] shrink-0" />
                      <div className="text-xs text-[#f5f4f0]">
                        Posting officially as{' '}
                        <span className="font-bold text-[#3ddc97]">
                          {official.name}
                        </span>{' '}
                        <span className="text-[#949ba8]">
                          ({official.position})
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-[#b4bac6] mb-1.5">
                      Forum Board / Category
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2 text-sm text-[#f5f4f0]"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#b4bac6] mb-1.5">
                    Discussion Subject / Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="State the main topic clearly (e.g., Library Evening Study Hours Proposal)"
                    className="w-full min-h-[42px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-4 py-2.5 text-sm font-medium text-[#f5f4f0] placeholder:text-[#949ba8]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#b4bac6] mb-1.5">
                    Detailed Statement *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Provide clear context, constructive suggestions, or specific questions for the Council..."
                    className="w-full rounded-xl border border-white/[0.14] bg-[#0b0e15] px-4 py-3 text-sm text-[#f5f4f0] placeholder:text-[#949ba8] resize-y leading-relaxed"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsComposerOpen(false)}
                    className="min-h-[38px] px-4 py-1.5 rounded-lg border border-white/[0.14] bg-[#181d29] text-xs font-semibold text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="gemini-cta inline-flex items-center gap-2 min-h-[38px] px-5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Publishing...' : 'Publish Topic'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* DEDICATED THREAD VIEW */}
        {activeThread ? (
          <div className="mt-6 space-y-6">
            {/* Top navigation bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setActiveThreadId(null)}
                className="inline-flex items-center gap-2 min-h-[38px] px-4 py-2 rounded-xl border border-white/[0.14] bg-[#0b0e15] text-xs font-semibold text-[#f5f4f0] hover:border-[#3ddc97]/50 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4 text-[#3ddc97]" />
                <span>Back to Forum Topics</span>
              </button>

              {onDeleteThread && canDeleteThread(activeThread) && (
                <button
                  type="button"
                  onClick={() => {
                    onDeleteThread(activeThread.id);
                    setActiveThreadId(null);
                  }}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-2 rounded-xl border border-[#ef4444]/35 bg-[#ef4444]/12 text-xs font-semibold text-[#fca5a5] hover:bg-[#ef4444]/20 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Topic</span>
                </button>
              )}
            </div>

            {/* Primary Thread Document */}
            <article className="card-elevated rounded-2xl overflow-hidden">
              <div
                className="h-[2px] w-full"
                style={{ backgroundColor: 'var(--ssc-yellow-bright)' }}
                aria-hidden="true"
              />
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3 text-xs">
                  <span className="font-semibold text-[#facc15]">
                    {activeThread.topic}
                  </span>
                  <span className="text-[#949ba8] flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-[#3ddc97]" />
                    <span>Posted {activeThread.postedAt}</span>
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#f5f4f0] mb-5 leading-snug">
                  {activeThread.title}
                </h2>

                <div className="flex items-center gap-3 pb-5 mb-5 border-b border-white/[0.1]">
                  <div className="w-10 h-10 rounded-xl bg-[#0b0e15] border border-white/[0.14] flex items-center justify-center text-[#3ddc97] font-bold text-sm shrink-0">
                    {activeThread.author.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-[#f5f4f0]">
                        {activeThread.author}
                      </span>
                      {isOfficialRoleLabel(activeThread.yearLevel) && (
                        <span className="text-xs font-semibold text-[#3ddc97]">
                          · Council Official
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#949ba8]">
                      {activeThread.yearLevel}
                    </p>
                  </div>
                </div>

                <div className="text-sm sm:text-base text-[#f5f4f0]/90 leading-relaxed whitespace-pre-line mb-6">
                  {activeThread.body}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/[0.1]">
                  <button
                    type="button"
                    onClick={() => onToggleSupport(activeThread.id, 1)}
                    className="inline-flex items-center gap-2 min-h-[38px] px-4 py-2 rounded-xl border border-white/[0.14] bg-[#0b0e15] hover:border-[#3ddc97]/50 text-xs font-semibold text-[#f5f4f0] transition-colors cursor-pointer"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 text-[#3ddc97]" />
                    <span>Endorse Topic</span>
                    <span className="text-[#3ddc97] font-mono tabular-nums">
                      ({activeThread.supportCount})
                    </span>
                  </button>

                  <span className="text-xs text-[#949ba8] font-medium tabular-nums">
                    {activeThread.replies.length}{' '}
                    {activeThread.replies.length === 1
                      ? 'Chronological Response'
                      : 'Chronological Responses'}
                  </span>
                </div>
              </div>
            </article>

            {/* Chronological Responses Section */}
            <div className="card-elevated rounded-2xl overflow-hidden">
              <div
                className="h-[2px] w-full"
                style={{ backgroundColor: 'var(--ssc-green-bright)' }}
                aria-hidden="true"
              />
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-white/[0.1] pb-4">
                  <h3 className="text-base sm:text-lg font-bold text-[#f5f4f0] flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-[#3ddc97]" />
                    <span>
                      Discussion Responses ({activeThread.replies.length})
                    </span>
                  </h3>
                  <span className="text-xs text-[#949ba8]">
                    Chronological order
                  </span>
                </div>

                {activeThread.replies.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.1] bg-[#0b0e15] py-8 px-4 text-center">
                    <p className="text-sm font-semibold text-[#f5f4f0]">
                      No responses have been recorded for this topic yet.
                    </p>
                    <p className="text-xs text-[#949ba8] mt-1">
                      Use the response form below to contribute to this consultation thread.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.1]">
                    {activeThread.replies.map((reply, index) => {
                      const isOfficialReply = isOfficialRoleLabel(
                        reply.yearLevel
                      );
                      return (
                        <div key={reply.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                                  isOfficialReply
                                    ? 'bg-[#3ddc97]/15 text-[#3ddc97] border-[#3ddc97]/35'
                                    : 'bg-[#0b0e15] text-[#f5f4f0] border-white/[0.12]'
                                }`}
                              >
                                {reply.author.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                <span className="font-bold text-[#f5f4f0]">
                                  {reply.author}
                                </span>
                                <span className="text-[#949ba8]">
                                  · {reply.yearLevel}
                                </span>
                                {isOfficialReply && (
                                  <span className="font-semibold text-[#3ddc97]">
                                    · Official Response
                                  </span>
                                )}
                                <span className="text-[#949ba8] tabular-nums">
                                  · {reply.time}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-[#949ba8] tabular-nums">
                                #{index + 1}
                              </span>
                              {onDeleteReply &&
                                canDeleteReply(reply.id, reply.author) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onDeleteReply(activeThread.id, reply.id)
                                    }
                                    className="p-1.5 rounded-lg text-[#949ba8] hover:text-[#fca5a5] hover:bg-red-500/15 transition-colors cursor-pointer"
                                    title="Remove response"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-[#b4bac6] leading-relaxed pl-9 whitespace-pre-line">
                            {reply.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Response Form */}
                <div className="pt-5 border-t border-white/[0.1]">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#949ba8] mb-3">
                    Post a Formal Response
                  </h4>
                  <div className="space-y-3">
                    {!official && (
                      <div className="sm:max-w-xs">
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Your Name
                        </label>
                        <input
                          type="text"
                          value={replyAuthor}
                          onChange={(e) => setReplyAuthor(e.target.value)}
                          placeholder={
                            authorName || 'e.g. Maria Santos (BSED 2-A)'
                          }
                          className="w-full min-h-[40px] rounded-xl border border-white/[0.14] bg-[#0b0e15] px-3.5 py-2 text-xs text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a respectful, constructive response to this topic..."
                        className="flex-1 rounded-xl border border-white/[0.14] bg-[#0b0e15] px-4 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8] resize-y"
                      />
                      <button
                        type="button"
                        disabled={isSubmittingReply || !replyText.trim()}
                        onClick={() => handleSubmitReply(activeThread.id)}
                        className="gemini-cta inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 self-end sm:self-stretch shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>
                          {isSubmittingReply ? 'Posting...' : 'Submit Reply'}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* BOARD FILTER BAR + 2-COLUMN SPLIT GRID (Matched to FAQ & Announcements) */
          <div className="mt-6 space-y-6">
            {/* Top Category Filter Bar + Search */}
            <div className="pb-5 border-b border-white/[0.14] flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
              <div className="min-w-0 flex-1">
                <ResistiveFilterBar
                  ariaLabel="Filter forum discussions by board"
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  options={availableCategories.map((cat) => ({
                    value: cat,
                    label: `${cat} (${boardCounts[cat] ?? 0})`,
                  }))}
                />
              </div>

              <div className="relative w-full lg:w-72 shrink-0">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#949ba8]"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search topics or authors..."
                  aria-label="Search forum topics"
                  className="w-full min-h-[40px] rounded-xl border border-white/[0.12] bg-[#0b0e15] pl-9 pr-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                />
              </div>
            </div>

            {/* 2-Column Content Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Sidebar: Forum Boards Directory & Etiquette */}
              <aside className="lg:col-span-4 space-y-4">
                <div className="card-elevated rounded-2xl overflow-hidden">
                  <div
                    className="h-[2px] w-full"
                    style={{ backgroundColor: 'var(--ssc-green-bright)' }}
                    aria-hidden="true"
                  />
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between border-b border-white/[0.1] pb-3">
                      <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f5f4f0]">
                        <FolderOpen className="w-4 h-4 text-[#3ddc97]" />
                        <span>Consultation Boards</span>
                      </span>
                      <span className="text-xs font-mono text-[#949ba8] tabular-nums">
                        {threads.length} total
                      </span>
                    </div>

                    <div className="space-y-1">
                      {availableCategories.map((cat) => {
                        const active = selectedCategory === cat;
                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setSelectedCategory(cat)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left cursor-pointer ${
                              active
                                ? 'bg-[#181d29] text-[#3ddc97] border border-white/[0.16]'
                                : 'text-[#b4bac6] hover:bg-[#0b0e15] hover:text-[#f5f4f0] border border-transparent'
                            }`}
                          >
                            <span className="truncate pr-2">{cat}</span>
                            <span className="text-[11px] font-mono text-[#949ba8] tabular-nums">
                              {boardCounts[cat] ?? 0}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Forum Etiquette Card */}
                <div className="card-elevated rounded-2xl overflow-hidden">
                  <div
                    className="h-[2px] w-full"
                    style={{ backgroundColor: 'var(--ssc-yellow-bright)' }}
                    aria-hidden="true"
                  />
                  <div className="p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#facc15]">
                      <MessagesSquare className="w-4 h-4" />
                      <span>Forum Guidelines</span>
                    </div>
                    <p className="text-xs sm:text-sm text-[#b4bac6] leading-relaxed">
                      All discussions are reviewed by the Supreme Student Council. Keep inquiries constructive, factual, and respectful of fellow students and faculty.
                    </p>
                  </div>
                </div>
              </aside>

              {/* Right Column: Formal Sort Controls + Topic Directory */}
              <div className="lg:col-span-8 space-y-4">
                {/* Formal Sort Toolbar */}
                <div className="rounded-2xl border border-white/[0.12] bg-[#0b0e15] p-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {(
                      [
                        { id: 'recent', label: 'Most Recent' },
                        { id: 'discussed', label: 'Most Discussed' },
                        { id: 'relevant', label: 'Most Relevant' },
                      ] as const
                    ).map((tab) => {
                      const active = sortBy === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSortBy(tab.id)}
                          className={`min-h-[34px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#3ddc97] text-[#042412]'
                              : 'text-[#b4bac6] hover:text-[#f5f4f0]'
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMyContributionsOnly((v) => !v)}
                    className={`inline-flex items-center gap-1.5 min-h-[34px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border cursor-pointer ${
                      showMyContributionsOnly
                        ? 'bg-[#facc15]/15 text-[#facc15] border-[#facc15]/40'
                        : 'border-white/[0.12] bg-[#121620] text-[#b4bac6] hover:text-[#f5f4f0]'
                    }`}
                  >
                    <UserCircle2 className="w-3.5 h-3.5" />
                    <span>My Contributions</span>
                  </button>
                </div>

                {/* Topic Directory List */}
                {filteredThreads.length === 0 ? (
                  <div className="card-elevated rounded-2xl overflow-hidden">
                    <div
                      className="h-[2px] w-full"
                      style={{ backgroundColor: 'var(--ssc-yellow-bright)' }}
                      aria-hidden="true"
                    />
                    <div className="p-10 sm:p-12 text-center space-y-2.5">
                      <div className="h-12 w-12 rounded-2xl bg-[#0b0e15] border border-white/[0.12] flex items-center justify-center text-[#3ddc97] mx-auto">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h3 className="text-lg font-bold text-[#f5f4f0]">
                        No discussion topics match this view
                      </h3>
                      <p className="text-xs sm:text-sm text-[#949ba8] max-w-md mx-auto leading-relaxed">
                        {showMyContributionsOnly
                          ? 'You have not authored or responded to any topics under this filter yet. Select "New Discussion Topic" in the header above to start a conversation.'
                          : 'No topics have been posted in this board yet. Select "New Discussion Topic" in the header above to submit the first inquiry.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredThreads.map((thread) => {
                      const isOfficialAuthor = isOfficialRoleLabel(
                        thread.yearLevel
                      );
                      return (
                        <div
                          key={thread.id}
                          onClick={() => openThreadDetail(thread.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openThreadDetail(thread.id);
                            }
                          }}
                          className="card-elevated rounded-2xl overflow-hidden group cursor-pointer transition-all hover:border-[#3ddc97]/40"
                        >
                          <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-semibold text-[#3ddc97]">
                                  {thread.topic}
                                </span>
                                <span className="text-[#949ba8]">·</span>
                                <span className="text-[#949ba8] tabular-nums">
                                  {thread.postedAt}
                                </span>
                              </div>

                              <h3 className="text-base sm:text-lg font-bold text-[#f5f4f0] group-hover:text-[#3ddc97] transition-colors line-clamp-1">
                                {thread.title}
                              </h3>

                              <p className="text-xs sm:text-sm text-[#b4bac6] line-clamp-2 leading-relaxed">
                                {thread.body}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-[#949ba8]">
                                <span className="font-semibold text-[#f5f4f0]">
                                  {thread.author}
                                </span>
                                {isOfficialAuthor && (
                                  <span className="font-semibold text-[#facc15]">
                                    · Council Official
                                  </span>
                                )}
                                <span>· {thread.yearLevel}</span>
                              </div>
                            </div>

                            <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.08]">
                              <div className="inline-flex items-center gap-1.5 rounded-xl border border-white/[0.12] bg-[#0b0e15] px-3 py-1.5 text-xs font-semibold text-[#f5f4f0] tabular-nums">
                                <MessageSquare className="w-3.5 h-3.5 text-[#3ddc97]" />
                                <span>
                                  {thread.replies.length}{' '}
                                  {thread.replies.length === 1
                                    ? 'reply'
                                    : 'replies'}
                                </span>
                              </div>
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3ddc97] group-hover:underline">
                                <span>Open thread</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
