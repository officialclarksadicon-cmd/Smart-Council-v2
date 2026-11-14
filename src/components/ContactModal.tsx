import { FormEvent, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { siteConfig } from '../siteConfig';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * CONTACT SSC MODAL (CLAUDE EDITORIAL + KARST WINDOW DESIGN)
 * Supports preset Concern Categories plus "Others" with a required specific purpose input.
 */
export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [subject, setSubject] = useState('General Inquiry');
  const [customPurpose, setCustomPurpose] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const { officeLocation, availabilityTitle, supportEmail } =
    siteConfig.councilInfo;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const resolvedPurpose =
    subject === 'Others' ? customPurpose.trim() : subject;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!studentName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (
      !studentEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studentEmail.trim())
    ) {
      setError('Please enter a valid student email address.');
      return;
    }
    if (subject === 'Others' && !customPurpose.trim()) {
      setError('Please specify your exact purpose or concern.');
      return;
    }
    if (!message.trim()) {
      setError('Please write a short message for the council.');
      return;
    }
    setError('');
    setSent(true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-ssc-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-[#131519] border border-white/[0.16] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.12] flex items-center justify-between gap-3 shrink-0">
              <div>
                <p className="text-xs font-medium text-[#949ba8] mb-0.5">
                  Student Support Desk
                </p>
                <h2
                  id="contact-ssc-title"
                  className="text-xl sm:text-2xl font-bold text-[#f5f4f0]"
                >
                  Contact Supreme Student Council
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close contact dialog"
                onClick={onClose}
                className="inline-flex items-center justify-center h-9 w-9 rounded-xl border border-white/[0.12] bg-[#0b0e15] text-[#949ba8] hover:text-[#f5f4f0] cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto no-scrollbar">
              {sent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#3ddc97]/15 text-[#3ddc97] border border-[#3ddc97]/30">
                    <Check className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-[#f5f4f0]">
                    Inquiry Recorded for {studentName}
                  </h3>
                  <p className="text-sm text-[#b4bac6] leading-relaxed">
                    Your message regarding{' '}
                    <strong className="text-[#f5f4f0]">
                      {resolvedPurpose}
                    </strong>{' '}
                    has been saved in this browser preview. For direct email
                    support anytime, write to{' '}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-semibold text-[#3ddc97] underline"
                    >
                      {supportEmail}
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setMessage('');
                      setCustomPurpose('');
                      onClose();
                    }}
                    className="gemini-cta mt-2 inline-flex px-6 py-2.5 min-h-[44px] items-center text-xs font-bold uppercase tracking-wider rounded-full active:scale-[0.98] transition-transform cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <p className="text-xs text-[#b4bac6] leading-relaxed rounded-xl bg-[#0d0e11] border border-white/[0.1] px-3.5 py-2.5">
                    Office: <strong className="text-[#f5f4f0]">{officeLocation}</strong> (
                    {availabilityTitle}). Direct support email:{' '}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="font-semibold text-[#3ddc97] hover:underline"
                    >
                      {supportEmail}
                    </a>
                  </p>

                  <div>
                    <label
                      htmlFor="ssc-name"
                      className="block text-sm font-medium text-[#f5f4f0] mb-1"
                    >
                      Student Name
                    </label>
                    <input
                      id="ssc-name"
                      type="text"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Alex Rivera"
                      className="w-full min-h-[44px] rounded-xl border border-white/[0.14] bg-[#0d0e11] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ssc-email"
                      className="block text-sm font-medium text-[#f5f4f0] mb-1"
                    >
                      Student Email
                    </label>
                    <input
                      id="ssc-email"
                      type="email"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="alex.rivera@university.edu"
                      className="w-full min-h-[44px] rounded-xl border border-white/[0.14] bg-[#0d0e11] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ssc-subject"
                      className="block text-sm font-medium text-[#f5f4f0] mb-1"
                    >
                      Concern Category
                    </label>
                    <select
                      id="ssc-subject"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        if (e.target.value !== 'Others') {
                          setCustomPurpose('');
                        }
                      }}
                      className="w-full min-h-[44px] rounded-xl border border-white/[0.14] bg-[#0d0e11] px-3.5 py-2.5 text-sm text-[#f5f4f0]"
                    >
                      <option value="General Inquiry">General Inquiry</option>
                      <option value="Student Support">Student Support</option>
                      <option value="Student Welfare & Grievance">
                        Student Welfare &amp; Grievance
                      </option>
                      <option value="Club Accreditation">
                        Club Accreditation
                      </option>
                      <option value="Event Proposal">Event Proposal</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>

                  <AnimatePresence initial={false}>
                    {subject === 'Others' && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="pt-1">
                          <label
                            htmlFor="ssc-custom-purpose"
                            className="block text-sm font-medium text-[#f5f4f0] mb-1"
                          >
                            Specify Your Purpose
                          </label>
                          <input
                            id="ssc-custom-purpose"
                            type="text"
                            value={customPurpose}
                            onChange={(e) => setCustomPurpose(e.target.value)}
                            placeholder="e.g. Lost ID endorsement, Room reservation..."
                            className="w-full min-h-[44px] rounded-xl border border-white/[0.14] bg-[#0d0e11] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label
                      htmlFor="ssc-message"
                      className="block text-sm font-medium text-[#f5f4f0] mb-1"
                    >
                      Message
                    </label>
                    <textarea
                      id="ssc-message"
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Share your message with the SSC officers..."
                      className="w-full rounded-xl border border-white/[0.14] bg-[#0d0e11] px-3.5 py-2.5 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                    />
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-medium text-[#f87171]"
                    >
                      {error}
                    </p>
                  )}

                  <div className="pt-2 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-5 py-2.5 min-h-[44px] text-xs font-semibold uppercase tracking-wider text-[#b4bac6] rounded-full border border-white/[0.14] bg-[#1a1d22] hover:text-[#f5f4f0] active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="gemini-cta px-6 py-2.5 min-h-[44px] text-xs font-bold uppercase tracking-wider rounded-full active:scale-[0.98] transition-transform cursor-pointer"
                    >
                      Send to SSC
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
