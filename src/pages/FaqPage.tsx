import { FormEvent, useMemo, useState } from 'react';
import { Check, ChevronDown, Edit3, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FaqItem, OfficialProfile, PageRoute, siteConfig } from '../siteConfig';
import { PageSubNav } from '../components/PageSubNav';
import { ScrollReveal } from '../components/ScrollReveal';
import { WordRevealText } from '../components/WordRevealText';

interface FaqPageProps {
  faqs: FaqItem[];
  official?: OfficialProfile | null;
  onNavigate: (page: PageRoute) => void;
}

export function FaqPage({ faqs, official, onNavigate }: FaqPageProps) {
  const [openId, setOpenId] = useState<string>(faqs[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');

  // Quick "Ask the SSC" form state
  const [studentName, setStudentName] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [formError, setFormError] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState(false);

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return faqs;
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) ||
        faq.answer.toLowerCase().includes(q) ||
        faq.category.toLowerCase().includes(q)
    );
  }, [faqs, searchQuery]);

  const handleAskSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!questionText.trim()) {
      setFormError('Please enter your question for the council.');
      return;
    }
    setFormError('');
    setSubmittedQuestion(true);
    setQuestionText('');
  };

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620] px-4 sm:px-8 lg:px-12 py-6 lg:py-8">
        <PageSubNav currentPage="faq" onNavigate={onNavigate} />

        {/* Page Header */}
        <ScrollReveal>
          <div className="pb-6 border-b border-white/[0.14]">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <WordRevealText
                  as="h1"
                  text="Frequently Asked Questions"
                  className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]"
                  y={24}
                  stagger={0.08}
                  highlightWords={['Questions']}
                />
              </div>

              {official && (
                <button
                  type="button"
                  onClick={() => onNavigate('admin')}
                  className="inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-medium rounded-lg border border-white/[0.14] bg-[#0b0e15] text-[#f5f4f0] hover:border-white/[0.28] transition-colors shrink-0 cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5 text-[#3ddc97]" aria-hidden="true" />
                  <span>Edit FAQs</span>
                </button>
              )}
            </div>

            {/* Search Bar */}
            <div className="mt-5 relative max-w-md">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#949ba8]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student questions..."
                aria-label="Search FAQ"
                className="w-full min-h-[44px] rounded-xl border border-white/[0.14] bg-[#0b0e15] pl-10 pr-4 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
              />
            </div>
          </div>
        </ScrollReveal>

        {/* Karst 2-Column Split Grid: Rounded FAQ Accordion Cards (Left) + Ask the SSC Composer (Right) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Rounded FAQ Accordion Cards */}
          <div className="lg:col-span-7 space-y-3.5">
            {filteredFaqs.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.12] bg-[#0b0e15] p-6 sm:p-8 text-center">
                <p className="text-sm font-medium text-[#b4bac6]">
                  No matching questions found.
                </p>
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isOpen = openId === faq.id;

                return (
                  <ScrollReveal key={faq.id}>
                    <div className="card-elevated rounded-2xl overflow-hidden">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        onClick={() => setOpenId(isOpen ? '' : faq.id)}
                        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-[#181d29]/60 transition-colors cursor-pointer"
                      >
                        <div className="space-y-1">
                          <span className="block text-xs font-medium text-[#949ba8]">
                            {faq.category}
                          </span>
                          <h2 className="text-lg sm:text-xl font-bold text-[#f5f4f0]">
                            {faq.question}
                          </h2>
                        </div>
                        <ChevronDown
                          className={`h-5 w-5 text-[#949ba8] shrink-0 transition-transform duration-200 ${
                            isOpen ? 'rotate-180 text-[#3ddc97]' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{
                              duration: 0.18,
                              ease: [0.16, 1, 0.3, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-5 pt-3 text-sm sm:text-[15px] text-[#b4bac6] leading-relaxed border-t border-white/[0.1]">
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </ScrollReveal>
                );
              })
            )}
          </div>

          {/* Right Column: Ask the SSC Form Card */}
          <ScrollReveal className="lg:col-span-5">
            <div className="card-elevated rounded-2xl overflow-hidden">
              <div
                className="h-[2px] w-full"
                style={{ backgroundColor: 'var(--ssc-yellow-bright)' }}
                aria-hidden="true"
              />
              <div className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-2 mb-1.5 text-xs font-medium text-[#949ba8]">
                  <span>Direct Inquiry</span>
                  <span>SSC Desk</span>
                </div>
                <h2 className="text-2xl font-bold text-[#f5f4f0]">
                  Ask the SSC
                </h2>

                {submittedQuestion ? (
                  <div className="mt-5 rounded-xl border border-[#3ddc97]/30 bg-[#0d0e11] p-5 flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#3ddc97]/15 text-[#3ddc97] shrink-0">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#f5f4f0]">
                        Question sent for {studentName}
                      </p>
                      <p className="mt-1 text-sm text-[#b4bac6]">
                        Council officers review new student inquiries regularly. For
                        urgent support, write directly to{' '}
                        {siteConfig.councilInfo.supportEmail}.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSubmittedQuestion(false)}
                        className="mt-3 text-xs font-semibold text-[#3ddc97] hover:underline cursor-pointer"
                      >
                        Ask another question
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAskSubmit} className="mt-5 space-y-4">
                    <div>
                      <label
                        htmlFor="faq-student-name"
                        className="block text-sm font-medium text-[#f5f4f0] mb-1"
                      >
                        Your Name
                      </label>
                      <input
                        id="faq-student-name"
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="e.g. Jordan Reyes"
                        className="w-full min-h-[44px] rounded-xl border border-white/[0.12] bg-[#0b0e15] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="faq-question-text"
                        className="block text-sm font-medium text-[#f5f4f0] mb-1"
                      >
                        Your Question
                      </label>
                      <textarea
                        id="faq-question-text"
                        rows={3}
                        value={questionText}
                        onChange={(e) => setQuestionText(e.target.value)}
                        placeholder="Ask about clearances, event permits, or campus services..."
                        className="w-full rounded-xl border border-white/[0.12] bg-[#0b0e15] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    {formError && (
                      <p
                        role="alert"
                        className="text-sm font-medium text-[#f87171]"
                      >
                        {formError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="gemini-cta w-full min-h-[46px] px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full active:scale-[0.98] cursor-pointer transition-transform"
                    >
                      Submit Question
                    </button>
                  </form>
                )}
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
