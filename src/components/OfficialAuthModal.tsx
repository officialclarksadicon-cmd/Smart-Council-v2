import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  checkAndCompleteStudentEmailVerification,
  registerStudentWithEmail,
  resendStudentVerificationEmail,
  signInOfficialWithFirebaseAuth,
  signInStudentWithEmail,
  signInStudentWithGoogle,
} from '../firebase';
import {
  OfficialAccount,
  OfficialProfile,
  SLAC_COLLEGE_DEPARTMENTS,
  SLAC_YEAR_LEVELS,
  StudentProfile,
  siteConfig,
} from '../siteConfig';

export type AuthModalMode = 'official' | 'student';
type StudentAuthAction = 'signin' | 'signup';
type IdentityChoiceMode = 'picker' | 'custom' | 'skip';

interface OfficialAuthModalProps {
  isOpen: boolean;
  initialMode?: AuthModalMode;
  accounts?: OfficialAccount[];
  currentStudent?: StudentProfile | null;
  onClose: () => void;
  onSignInOfficial: (official: OfficialProfile) => void;
  onSignInStudent: (student: StudentProfile) => void;
  onContinueAsGuest: () => void;
}

function parseSavedDepartment(yearCourse?: string): string {
  if (!yearCourse) return SLAC_COLLEGE_DEPARTMENTS[0];
  const matched = SLAC_COLLEGE_DEPARTMENTS.find((dept) =>
    yearCourse.toLowerCase().includes(dept.toLowerCase())
  );
  return matched ?? SLAC_COLLEGE_DEPARTMENTS[0];
}

function parseSavedYearLevel(yearCourse?: string): string {
  if (!yearCourse) return SLAC_YEAR_LEVELS[0];
  const matched = SLAC_YEAR_LEVELS.find((yr) =>
    yearCourse.toLowerCase().includes(yr.toLowerCase())
  );
  return matched ?? SLAC_YEAR_LEVELS[0];
}

function formatStudentAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  if (lower.includes('email-already-in-use')) {
    return 'An account with this email already exists. Switch to Sign In.';
  }
  if (
    lower.includes('invalid-credential') ||
    lower.includes('wrong-password') ||
    lower.includes('user-not-found')
  ) {
    return 'Incorrect email or password. Check your credentials or create an account.';
  }
  if (lower.includes('weak-password')) {
    return 'Password does not meet security requirements.';
  }
  if (lower.includes('invalid-email')) {
    return 'Enter a valid email address.';
  }
  if (lower.includes('too-many-requests')) {
    return 'Too many attempts. Wait a moment before trying again.';
  }
  if (lower.includes('operation-not-allowed')) {
    return 'Email/Password sign-in is not enabled yet.';
  }
  return 'Unable to complete request. Check your details and try again.';
}

/**
 * PORTAL AUTH MODAL
 * - Student Sign In: Email & Password only (no Department/Year picker since account is already created).
 * - Student Create Account: Includes optional Identity section (Department & Year picker, Custom Identity, or Skip),
 *   which can also be edited anytime inside Website Settings.
 * - Officer & Admin tab: Provisioned Council & Admin sign-in.
 */
export function OfficialAuthModal({
  isOpen,
  initialMode = 'official',
  accounts = siteConfig.officialsAuth.accounts,
  currentStudent,
  onClose,
  onSignInOfficial,
  onSignInStudent,
  onContinueAsGuest,
}: OfficialAuthModalProps) {
  const [mode, setMode] = useState<AuthModalMode>(initialMode);

  // Official Sign-In State
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [officialError, setOfficialError] = useState('');
  const [isOfficialLoading, setIsOfficialLoading] = useState(false);

  // Student Email/Password & Google Auth State
  const [studentAction, setStudentAction] =
    useState<StudentAuthAction>('signin');
  const [studentName, setStudentName] = useState(currentStudent?.name ?? '');
  const [studentEmail, setStudentEmail] = useState(
    currentStudent?.identifier ?? ''
  );
  const [studentPassword, setStudentPassword] = useState('');
  const [studentConfirmPassword, setStudentConfirmPassword] = useState('');
  const [showStudentPassword, setShowStudentPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Optional Identity State (Shown ONLY when Creating an Account)
  const [identityMode, setIdentityMode] =
    useState<IdentityChoiceMode>('picker');
  const [studentDepartment, setStudentDepartment] = useState<string>(() =>
    parseSavedDepartment(currentStudent?.yearCourse)
  );
  const [studentYearLevel, setStudentYearLevel] = useState<string>(() =>
    parseSavedYearLevel(currentStudent?.yearCourse)
  );
  const [customIdentity, setCustomIdentity] = useState<string>('');

  const [isStudentSubmitting, setIsStudentSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [studentError, setStudentError] = useState('');
  const [studentNotice, setStudentNotice] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null);

  const resolvedSignupIdentity =
    identityMode === 'skip'
      ? 'SLAC Student'
      : identityMode === 'custom'
        ? customIdentity.trim().slice(0, 80) || 'SLAC Student'
        : `${studentYearLevel} — ${studentDepartment}`;

  // Password validation rules for Create Account
  const hasMinLength =
    studentPassword.length >= 8 && studentPassword.length <= 64;
  const hasUppercase = /[A-Z]/.test(studentPassword);
  const hasLowercase = /[a-z]/.test(studentPassword);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(studentPassword);
  const passwordsMatch =
    studentPassword.length > 0 && studentPassword === studentConfirmPassword;

  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setOfficialError('');
    setStudentError('');
    setStudentNotice('');
    setPendingVerificationEmail(null);
    if (currentStudent) {
      setStudentName(currentStudent.name);
      setStudentEmail(currentStudent.identifier);
      setStudentDepartment(parseSavedDepartment(currentStudent.yearCourse));
      setStudentYearLevel(parseSavedYearLevel(currentStudent.yearCourse));
    }
  }, [isOpen, initialMode, currentStudent]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pendingVerificationEmail) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, pendingVerificationEmail, onClose]);

  const handleStudentEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStudentError('');
    setStudentNotice('');

    const cleanEmail = studentEmail.trim().toLowerCase();
    const cleanPass = studentPassword;
    const cleanName = studentName.trim();

    if (!cleanEmail) {
      setStudentError('Enter your email address.');
      return;
    }

    if (studentAction === 'signup') {
      if (!cleanName) {
        setStudentError('Enter your full name.');
        return;
      }
      if (!hasMinLength) {
        setStudentError('Password must be between 8 and 64 characters.');
        return;
      }
      if (!hasUppercase) {
        setStudentError(
          'Password must include at least one uppercase letter (A–Z).'
        );
        return;
      }
      if (!hasLowercase) {
        setStudentError(
          'Password must include at least one lowercase letter (a–z).'
        );
        return;
      }
      if (!hasSymbol) {
        setStudentError(
          'Password must include at least one symbol (e.g. @, #, !, $).'
        );
        return;
      }
      if (!passwordsMatch) {
        setStudentError('Password and Confirm Password do not match.');
        return;
      }
    } else if (!cleanPass) {
      setStudentError('Enter your password.');
      return;
    }

    setIsStudentSubmitting(true);
    try {
      if (studentAction === 'signup') {
        const res = await registerStudentWithEmail({
          name: cleanName,
          email: cleanEmail,
          password: cleanPass,
          yearCourse: resolvedSignupIdentity,
        });
        setPendingVerificationEmail(res.email);
        setStudentNotice(
          `A verification link has been sent to ${res.email}. Verify your email to finish creating your account.`
        );
      } else {
        // When signing in, do not pass a new yearCourse so their saved account identity is preserved
        const res = await signInStudentWithEmail({
          email: cleanEmail,
          password: cleanPass,
        });
        if (!res.verified) {
          setPendingVerificationEmail(res.email);
          setStudentNotice(
            `Your email (${res.email}) has not been verified yet. Verify your email first before signing in.`
          );
          return;
        }
        setStudentPassword('');
        setStudentConfirmPassword('');
        onSignInStudent(res.student);
        onClose();
      }
    } catch (err) {
      setStudentError(formatStudentAuthError(err));
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleCheckVerification = async () => {
    setStudentError('');
    setStudentNotice('');
    setIsStudentSubmitting(true);
    try {
      const verifiedProfile = await checkAndCompleteStudentEmailVerification(
        studentAction === 'signup' ? resolvedSignupIdentity : undefined,
        studentName
      );
      if (!verifiedProfile) {
        setStudentError(
          'Your email is still unverified. Open the verification link sent to your inbox, then click "I\'ve Verified My Email".'
        );
        return;
      }
      setStudentPassword('');
      setStudentConfirmPassword('');
      setPendingVerificationEmail(null);
      onSignInStudent(verifiedProfile);
      onClose();
    } catch (err) {
      setStudentError(formatStudentAuthError(err));
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setStudentError('');
    setStudentNotice('');
    setIsStudentSubmitting(true);
    try {
      await resendStudentVerificationEmail();
      setStudentNotice(
        `Sent a new verification link to ${pendingVerificationEmail ?? studentEmail}.`
      );
    } catch (err) {
      setStudentError(formatStudentAuthError(err));
    } finally {
      setIsStudentSubmitting(false);
    }
  };

  const handleStudentGoogleSignIn = async () => {
    setStudentError('');
    setStudentNotice('');
    setIsGoogleLoading(true);
    try {
      const signedInStudent = await signInStudentWithGoogle(
        studentAction === 'signup' ? resolvedSignupIdentity : undefined
      );
      onSignInStudent(signedInStudent);
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Google sign-in was cancelled or blocked by the browser.';
      if (!message.toLowerCase().includes('popup-closed-by-user')) {
        setStudentError(
          'Unable to complete Google sign-in. Allow popups in your browser and try again.'
        );
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleOfficialSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalizedUser = email.trim().toLowerCase();
    const trimmedPasscode = passcode.trim();

    if (!normalizedUser) {
      setOfficialError('Enter your user or email.');
      return;
    }
    if (!trimmedPasscode) {
      setOfficialError('Enter your passcode.');
      return;
    }

    const matchedAccount = accounts.find((acc) => {
      const accEmail = acc.email.toLowerCase();
      const accName = acc.name.toLowerCase();
      const accUsername = accEmail.split('@')[0] ?? '';
      return (
        (accEmail === normalizedUser ||
          accName === normalizedUser ||
          accUsername === normalizedUser) &&
        acc.passcode === trimmedPasscode
      );
    });

    const targetEmail = matchedAccount?.email ?? normalizedUser;

    setOfficialError('');
    setIsOfficialLoading(true);
    let firebaseProfile: OfficialProfile | null = null;
    try {
      if (targetEmail.includes('@')) {
        firebaseProfile = await signInOfficialWithFirebaseAuth(
          targetEmail,
          trimmedPasscode,
          matchedAccount?.name
        );
      }
    } finally {
      setIsOfficialLoading(false);
    }

    if (!matchedAccount && !firebaseProfile) {
      setOfficialError('Invalid user or passcode.');
      return;
    }

    setPasscode('');
    setShowPasscode(false);
    onSignInOfficial(
      firebaseProfile ?? {
        id: matchedAccount!.id,
        email: matchedAccount!.email,
        name: matchedAccount!.name,
        position: matchedAccount!.position,
        role: matchedAccount!.role,
      }
    );
    onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="portal-auth-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[90] overflow-y-auto overscroll-contain flex items-center justify-center p-4 sm:p-6 bg-black/60"
          onClick={() => {
            if (!pendingVerificationEmail) onClose();
          }}
        >
          {/* Dedicated Pop-Up Verification Card After Creating Account */}
          {mode === 'student' && pendingVerificationEmail ? (
            <motion.div
              key="email-verification-popup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="my-auto w-full max-w-md rounded-2xl bg-[#131519] border border-[#facc15]/35 shadow-2xl p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3.5">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#facc15]/15 text-[#facc15] border border-[#facc15]/35">
                  <MailCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="space-y-1 min-w-0">
                  <h2
                    id="portal-auth-title"
                    className="text-lg font-bold text-[#f5f4f0] leading-snug"
                  >
                    Verify Your Email First
                  </h2>
                  <p className="text-xs sm:text-sm text-[#b4bac6] leading-relaxed break-words">
                    Please verify your email address (
                    <span className="font-semibold text-[#f5f4f0]">
                      {pendingVerificationEmail}
                    </span>
                    ) before accessing the portal.
                  </p>
                </div>
              </div>

              {studentAction === 'signup' && (
                <div className="rounded-xl border border-white/[0.08] bg-[#0b0e15] p-3.5 text-xs text-[#b4bac6] space-y-1">
                  <p className="font-semibold text-[#f5f4f0]">
                    Student Identity:
                  </p>
                  <p>{resolvedSignupIdentity}</p>
                </div>
              )}

              {studentNotice && (
                <p className="rounded-lg bg-[#3ddc97]/10 border border-[#3ddc97]/30 px-3.5 py-2.5 text-xs font-medium text-[#3ddc97]">
                  {studentNotice}
                </p>
              )}

              {studentError && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 text-xs font-medium text-[#fca5a5]"
                >
                  {studentError}
                </p>
              )}

              <div className="space-y-2.5">
                <button
                  type="button"
                  disabled={isStudentSubmitting}
                  onClick={() => void handleCheckVerification()}
                  className="gemini-cta w-full min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {isStudentSubmitting ? (
                    <Loader2
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  <span>I&apos;ve Verified My Email</span>
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={isStudentSubmitting}
                    onClick={() => void handleResendVerification()}
                    className="min-h-[42px] px-3 py-2 rounded-lg border border-white/[0.12] bg-[#1a1d22] text-xs font-semibold text-[#f5f4f0] hover:border-white/[0.24] inline-flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Resend Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingVerificationEmail(null);
                      setStudentAction('signin');
                      setStudentError('');
                      setStudentNotice('');
                    }}
                    className="min-h-[42px] px-3 py-2 rounded-lg border border-white/[0.12] bg-[#1a1d22] text-xs font-medium text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="main-auth-modal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="my-auto w-full max-w-md rounded-2xl bg-[#131519] border border-white/[0.16] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 sm:px-6 pt-5 pb-4 border-b border-white/[0.12]">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                      mode === 'official'
                        ? 'bg-[#181d29] text-[#3ddc97] border-white/[0.14]'
                        : 'bg-[#181d29] text-[#f5f4f0] border-white/[0.14]'
                    }`}
                  >
                    {mode === 'official' ? (
                      <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <h2
                      id="portal-auth-title"
                      className="text-xl sm:text-2xl font-bold text-[#f5f4f0] leading-snug"
                    >
                      {mode === 'official'
                        ? 'Officer & Admin Sign In'
                        : studentAction === 'signup'
                          ? 'Create Student Account'
                          : 'Student Sign In'}
                    </h2>
                    <p className="text-xs text-[#949ba8]">
                      {mode === 'official'
                        ? 'Supreme Student Council Official Access'
                        : 'SLAC Student Portal'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close sign-in dialog"
                  onClick={onClose}
                  className="inline-flex shrink-0 items-center justify-center h-9 w-9 rounded-xl border border-white/[0.12] bg-[#0b0e15] text-[#949ba8] hover:text-[#f5f4f0] transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Crisp Single-Row Role Switcher (Toned-Down Clean Active Surface) */}
              <div className="px-5 sm:px-6 pt-4">
                <div
                  role="tablist"
                  aria-label="Select sign-in account type"
                  className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#0b0e15] border border-white/[0.12]"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'student'}
                    onClick={() => setMode('student')}
                    className={`inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ddc97]/60 cursor-pointer ${
                      mode === 'student'
                        ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18] shadow-xs'
                        : 'text-[#949ba8] hover:text-[#f5f4f0]'
                    }`}
                  >
                    <GraduationCap
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>Student / Guest</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === 'official'}
                    onClick={() => setMode('official')}
                    className={`inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3ddc97]/60 cursor-pointer ${
                      mode === 'official'
                        ? 'bg-[#181d29] text-[#f5f4f0] border border-white/[0.18] shadow-xs'
                        : 'text-[#949ba8] hover:text-[#f5f4f0]'
                    }`}
                  >
                    <ShieldCheck
                      className="h-4 w-4 shrink-0 text-[#3ddc97]"
                      aria-hidden="true"
                    />
                    <span>Officer &amp; Admin</span>
                  </button>
                </div>
              </div>

              {mode === 'student' ? (
                <div className="p-5 sm:p-6 space-y-4">
                  {/* Sign In vs Create Account Switcher */}
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#0d0e11] border border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => {
                        setStudentAction('signin');
                        setStudentError('');
                        setStudentNotice('');
                      }}
                      className={`h-8 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        studentAction === 'signin'
                          ? 'bg-[#1a1d22] text-[#f5f4f0] border border-white/[0.12]'
                          : 'text-[#949ba8] hover:text-[#f5f4f0]'
                      }`}
                    >
                      Sign In
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStudentAction('signup');
                        setStudentError('');
                        setStudentNotice('');
                      }}
                      className={`h-8 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                        studentAction === 'signup'
                          ? 'bg-[#1a1d22] text-[#f5f4f0] border border-white/[0.12]'
                          : 'text-[#949ba8] hover:text-[#f5f4f0]'
                      }`}
                    >
                      Create Account
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => void handleStudentEmailSubmit(e)}
                    className="space-y-3.5"
                  >
                    {studentAction === 'signup' && (
                      <div>
                        <label
                          htmlFor="student-name"
                          className="block text-xs sm:text-sm font-medium text-[#f5f4f0] mb-1"
                        >
                          Full Name
                        </label>
                        <input
                          id="student-name"
                          type="text"
                          autoComplete="name"
                          required
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          placeholder="Juan Dela Cruz"
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="student-email"
                        className="block text-xs sm:text-sm font-medium text-[#f5f4f0] mb-1"
                      >
                        Email Address
                      </label>
                      <input
                        id="student-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="student@example.com"
                        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="student-password"
                        className="block text-xs sm:text-sm font-medium text-[#f5f4f0] mb-1"
                      >
                        Password
                      </label>
                      <div className="relative">
                        <input
                          id="student-password"
                          type={showStudentPassword ? 'text' : 'password'}
                          autoComplete={
                            studentAction === 'signup'
                              ? 'new-password'
                              : 'current-password'
                          }
                          required
                          maxLength={64}
                          value={studentPassword}
                          onChange={(e) => setStudentPassword(e.target.value)}
                          placeholder={
                            studentAction === 'signup'
                              ? 'Create a strong password'
                              : 'Enter your password'
                          }
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] pl-3.5 pr-11 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                        <button
                          type="button"
                          aria-label={
                            showStudentPassword
                              ? 'Hide password'
                              : 'Show password'
                          }
                          onClick={() =>
                            setShowStudentPassword((prev) => !prev)
                          }
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#949ba8] hover:text-[#f5f4f0] cursor-pointer"
                        >
                          {showStudentPassword ? (
                            <EyeOff className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* ONLY Show Confirm Password, Password Rules, and Optional Identity When Creating an Account */}
                    {studentAction === 'signup' && (
                      <>
                        <div>
                          <label
                            htmlFor="student-confirm-password"
                            className="block text-xs sm:text-sm font-medium text-[#f5f4f0] mb-1"
                          >
                            Confirm Password
                          </label>
                          <div className="relative">
                            <input
                              id="student-confirm-password"
                              type={showConfirmPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              required
                              maxLength={64}
                              value={studentConfirmPassword}
                              onChange={(e) =>
                                setStudentConfirmPassword(e.target.value)
                              }
                              placeholder="Re-enter your password"
                              className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0d0e11] pl-3.5 pr-11 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                            />
                            <button
                              type="button"
                              aria-label={
                                showConfirmPassword
                                  ? 'Hide confirm password'
                                  : 'Show confirm password'
                              }
                              onClick={() =>
                                setShowConfirmPassword((prev) => !prev)
                              }
                              className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-[#949ba8] hover:text-[#f5f4f0] cursor-pointer"
                            >
                              {showConfirmPassword ? (
                                <EyeOff
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Password Rules Checklist */}
                        <div className="rounded-xl border border-white/[0.08] bg-[#0b0e15] p-3 space-y-1.5">
                          <p className="text-[11px] font-semibold text-[#b4bac6]">
                            Password Requirements:
                          </p>
                          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                            {[
                              {
                                label: '8–64 characters',
                                met: hasMinLength,
                              },
                              {
                                label: 'Uppercase letter (A–Z)',
                                met: hasUppercase,
                              },
                              {
                                label: 'Lowercase letter (a–z)',
                                met: hasLowercase,
                              },
                              {
                                label: 'Symbol (e.g. @, #, !, $)',
                                met: hasSymbol,
                              },
                              {
                                label: 'Passwords match',
                                met: passwordsMatch,
                              },
                            ].map((rule) => (
                              <li
                                key={rule.label}
                                className={`inline-flex items-center gap-1.5 ${
                                  rule.met
                                    ? 'text-[#3ddc97] font-medium'
                                    : 'text-[#949ba8]'
                                }`}
                              >
                                <Check
                                  className={`h-3 w-3 shrink-0 ${
                                    rule.met ? 'opacity-100' : 'opacity-30'
                                  }`}
                                  aria-hidden="true"
                                />
                                <span>{rule.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Student Identity (Optional — Visible ONLY when Creating an Account) */}
                        <div className="rounded-xl border border-white/[0.08] bg-[#0b0e15] p-3.5 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#f5f4f0]">
                              Student Identity (Optional)
                            </span>
                            <span className="text-[11px] text-[#949ba8]">
                              Editable in Settings
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#131519] border border-white/[0.08]">
                            {(
                              [
                                { id: 'picker', label: 'Dept & Year' },
                                { id: 'custom', label: 'Custom' },
                                { id: 'skip', label: 'Skip' },
                              ] as const
                            ).map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setIdentityMode(tab.id)}
                                className={`h-7 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                                  identityMode === tab.id
                                    ? 'bg-[#1a1d22] text-[#f5f4f0] border border-white/[0.14]'
                                    : 'text-[#949ba8] hover:text-[#f5f4f0]'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {identityMode === 'picker' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              <div>
                                <label
                                  htmlFor="student-department"
                                  className="block text-[11px] font-medium text-[#b4bac6] mb-1"
                                >
                                  College Department
                                </label>
                                <select
                                  id="student-department"
                                  value={studentDepartment}
                                  onChange={(e) =>
                                    setStudentDepartment(e.target.value)
                                  }
                                  className="w-full min-h-[38px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-2.5 py-1.5 text-xs text-[#f5f4f0]"
                                >
                                  {SLAC_COLLEGE_DEPARTMENTS.map((dept) => (
                                    <option key={dept} value={dept}>
                                      {dept}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label
                                  htmlFor="student-year-level"
                                  className="block text-[11px] font-medium text-[#b4bac6] mb-1"
                                >
                                  Year Level
                                </label>
                                <select
                                  id="student-year-level"
                                  value={studentYearLevel}
                                  onChange={(e) =>
                                    setStudentYearLevel(e.target.value)
                                  }
                                  className="w-full min-h-[38px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-2.5 py-1.5 text-xs text-[#f5f4f0]"
                                >
                                  {SLAC_YEAR_LEVELS.map((yr) => (
                                    <option key={yr} value={yr}>
                                      {yr}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}

                          {identityMode === 'custom' && (
                            <div>
                              <label
                                htmlFor="student-custom-identity"
                                className="block text-[11px] font-medium text-[#b4bac6] mb-1"
                              >
                                Custom Identity
                              </label>
                              <input
                                id="student-custom-identity"
                                type="text"
                                maxLength={80}
                                value={customIdentity}
                                onChange={(e) =>
                                  setCustomIdentity(e.target.value)
                                }
                                placeholder="e.g. 3rd Year — BS Computer Engineering"
                                className="w-full min-h-[38px] rounded-lg border border-white/[0.12] bg-[#0d0e11] px-3 py-1.5 text-xs text-[#f5f4f0] placeholder:text-[#949ba8]"
                              />
                            </div>
                          )}

                          {identityMode === 'skip' && (
                            <p className="text-[11px] text-[#949ba8]">
                              Your account will display as &ldquo;SLAC Student&rdquo;. You can update this anytime in Settings.
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    {studentError && (
                      <p
                        role="alert"
                        className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-medium text-[#fca5a5]"
                      >
                        {studentError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isStudentSubmitting || isGoogleLoading}
                      className="gemini-cta w-full min-h-[44px] px-4 py-2.5 rounded-full font-semibold text-sm inline-flex items-center justify-center gap-2 transition-transform active:scale-[0.99] disabled:opacity-55 cursor-pointer"
                    >
                      {isStudentSubmitting && (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      <span>
                        {studentAction === 'signup'
                          ? 'Create Account'
                          : 'Sign In with Email'}
                      </span>
                    </button>
                  </form>

                  <div className="relative py-1 flex items-center justify-center">
                    <div className="w-full border-t border-white/[0.08]" />
                    <span className="bg-[#131519] px-3 text-[11px] font-medium text-[#949ba8]">
                      or
                    </span>
                    <div className="w-full border-t border-white/[0.08]" />
                  </div>

                  <button
                    type="button"
                    disabled={isGoogleLoading || isStudentSubmitting}
                    onClick={() => void handleStudentGoogleSignIn()}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-full border border-white/[0.18] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.28] font-semibold text-sm inline-flex items-center justify-center gap-2.5 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {isGoogleLoading ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <svg
                        className="h-4 w-4 shrink-0"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          fill="#4285F4"
                          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                        />
                      </svg>
                    )}
                    <span>
                      {isGoogleLoading
                        ? 'Connecting to Google...'
                        : 'Continue with Google'}
                    </span>
                  </button>

                  <div className="pt-0.5 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        onContinueAsGuest();
                        onClose();
                      }}
                      className="w-full min-h-[42px] px-4 py-2 text-xs sm:text-sm font-medium text-[#b4bac6] rounded-full border border-white/[0.12] bg-[#1a1d22] hover:text-[#f5f4f0] transition-colors cursor-pointer"
                    >
                      Continue as Guest
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => void handleOfficialSubmit(e)}
                  className="p-5 sm:p-6 space-y-4"
                >
                  <div>
                    <label
                      htmlFor="official-user"
                      className="block text-xs sm:text-sm font-medium text-[#f5f4f0] mb-1.5"
                    >
                      User
                    </label>
                    <input
                      id="official-user"
                      type="text"
                      autoComplete="username"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter user or email"
                      className="w-full min-h-[44px] rounded-xl border border-white/[0.12] bg-[#0d0e11] px-3.5 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="official-code"
                      className="block text-xs sm:text-sm font-medium text-[#f5f4f0] mb-1.5"
                    >
                      Passcode
                    </label>
                    <div className="relative">
                      <input
                        id="official-code"
                        type={showPasscode ? 'text' : 'password'}
                        autoComplete="current-password"
                        required
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="Enter passcode"
                        className="w-full min-h-[44px] rounded-xl border border-white/[0.12] bg-[#0d0e11] pl-3.5 pr-12 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                      <button
                        type="button"
                        aria-label={
                          showPasscode ? 'Hide passcode' : 'Show passcode'
                        }
                        onClick={() => setShowPasscode((prev) => !prev)}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#949ba8] hover:text-[#f5f4f0] cursor-pointer"
                      >
                        {showPasscode ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                  </div>

                  {officialError && (
                    <p
                      role="alert"
                      className="rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs font-medium text-[#fca5a5]"
                    >
                      {officialError}
                    </p>
                  )}

                  <div className="pt-1 flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-full border border-white/[0.12] bg-[#1a1d22] hover:text-[#f5f4f0] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isOfficialLoading}
                      className="gemini-cta min-h-[44px] px-5 py-2 text-sm font-semibold rounded-full inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 transition-transform cursor-pointer"
                    >
                      {isOfficialLoading && (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      <span>Sign In</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
