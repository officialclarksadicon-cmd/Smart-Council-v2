import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  KeyRound,
  Megaphone,
  MessageSquare,
  Plus,
  RefreshCw,
  ShieldCheck,
  Tag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AnnouncementItem,
  FaqItem,
  ForumThread,
  GalleryEventItem,
  OfficerMember,
  OfficerTermRoster,
  OfficialAccount,
  OfficialProfile,
  PageRoute,
  PortalBranding,
  PortalFilters,
  siteConfig,
} from '../siteConfig';
import {
  CalendarDatePicker,
  ClockTimePicker,
} from '../components/DateTimePicker';
import { ImageKitUploader } from '../components/ImageKitUploader';
import { ResistiveFilterBar } from '../components/ResistiveFilterBar';
import { PageSubNav } from '../components/PageSubNav';
import {
  deleteAnnouncementFromFirestore,
  deleteCouncilAccountFromFirestore,
  deleteCouncilOfficerFromFirestore,
  deleteCouncilTermFromFirestore,
  deleteEventFromFirestore,
  deleteFaqFromFirestore,
  deleteForumThreadFromFirestore,
  inferCommitteeFromPosition,
  isPrimaryAdminUser,
  pushNewCouncilMemberToFirestore,
  updateCouncilAccountInFirestore,
  upsertAnnouncementToFirestore,
  upsertCouncilOfficerToFirestore,
  upsertEventToFirestore,
  upsertFaqToFirestore,
  upsertForumThreadToFirestore,
  upsertPortalSettingsToFirestore,
} from '../firebase';
import {
  getImageFramingStyle,
  normalizeImageKitInput,
  resolveImageUrl,
  stripImageFramingHash,
} from '../utils/imagekit';

interface AdminDashboardPageProps {
  official: OfficialProfile;
  announcements: AnnouncementItem[];
  events: GalleryEventItem[];
  forumThreads: ForumThread[];
  officerTerms: OfficerTermRoster[];
  accounts: OfficialAccount[];
  faqs: FaqItem[];
  filters: PortalFilters;
  branding: PortalBranding;
  onNavigate: (page: PageRoute) => void;
  onSetAnnouncements: (items: AnnouncementItem[]) => void;
  onSetEvents: (items: GalleryEventItem[]) => void;
  onSetForumThreads: (items: ForumThread[]) => void;
  onSetOfficerTerms: (terms: OfficerTermRoster[]) => void;
  onSetAccounts: (accounts: OfficialAccount[]) => void;
  onSetFaqs: (faqs: FaqItem[]) => void;
  onSetFilters: (filters: PortalFilters) => void;
  onUpdateBranding: (patch: Partial<PortalBranding>) => void;
  onResetDefaults: () => void;
  onNotify?: (message: string, type?: 'login' | 'logout' | 'refresh') => void;
}

type AdminTab =
  | 'branding'
  | 'filters'
  | 'announcements'
  | 'events'
  | 'officers'
  | 'accounts'
  | 'forum'
  | 'faqs';

type ActiveEditorModal = 'ann' | 'evt' | 'officer' | 'acc' | 'faq' | 'branding';

const ADMIN_DRAFT_STORAGE_KEY = 'smart_council_admin_editor_draft_v2';

const SSC_POSITIONS = [
  'President',
  'Vice President',
  'Secretary',
  'Asst. Secretary',
  'Treasurer',
  'Auditor',
  'Business Manager',
  '1st Year Representative',
  '2nd Year Representative',
  '3rd Year Representative',
  '4th Year Representative',
  'Head Of Information',
  'Media Information Officer',
  'External Information Officer',
  'Head Of Documentary',
  'Documentary Officer',
  'Head Of Technical',
  'Technical Officer',
];

function createPasscode(role: 'admin' | 'official'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return role === 'admin' ? `SLAC-ADM-${suffix}` : `SLAC-SSC-${suffix}`;
}

export function AdminDashboardPage({
  official,
  announcements,
  events,
  forumThreads,
  officerTerms,
  accounts,
  faqs,
  filters,
  branding,
  onNavigate,
  onSetAnnouncements,
  onSetEvents,
  onSetForumThreads,
  onSetOfficerTerms,
  onSetAccounts,
  onSetFaqs,
  onSetFilters,
  onUpdateBranding,
  onResetDefaults,
  onNotify,
}: AdminDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('branding');
  const [backupNotice, setBackupNotice] = useState('');
  const [backupError, setBackupError] = useState('');

  // Discard / Keep Editing Confirmation State for Admin Editor Pop-Ups
  const [discardPromptTarget, setDiscardPromptTarget] =
    useState<ActiveEditorModal | null>(null);

  // Branding & Stock Photo Pop-up Editor State
  const [brandingModalOpen, setBrandingModalOpen] = useState(false);
  const [draftLogoUrl, setDraftLogoUrl] = useState(branding.customLogoUrl);
  const [draftAboutImg, setDraftAboutImg] = useState(branding.aboutSlacImage);
  const [draftHeroImg, setDraftHeroImg] = useState(branding.heroImage);

  // Manual Filter Inputs
  const [newAnnFilter, setNewAnnFilter] = useState('');
  const [newEvtFilter, setNewEvtFilter] = useState('');
  const [newForumFilter, setNewForumFilter] = useState('');

  // Announcement Edit / Create State
  const [editingAnnId, setEditingAnnId] = useState<string | null>(null);
  const [annFormOpen, setAnnFormOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annDate, setAnnDate] = useState('');
  const [annCategory, setAnnCategory] = useState(
    filters.announcements[0] ?? 'Campus Life'
  );
  const [annSummary, setAnnSummary] = useState('');
  const [annIssuedBy, setAnnIssuedBy] = useState(
    `${official.name} (${official.position})`
  );
  const [annImage, setAnnImage] = useState('');

  // Event Edit / Create State
  const [editingEvtId, setEditingEvtId] = useState<string | null>(null);
  const [evtFormOpen, setEvtFormOpen] = useState(false);
  const [evtTitle, setEvtTitle] = useState('');
  const [evtDate, setEvtDate] = useState('');
  const [evtTime, setEvtTime] = useState('');
  const [evtLocation, setEvtLocation] = useState('');
  const [evtCategory, setEvtCategory] = useState(
    filters.events[0] ?? 'Governance'
  );
  const [evtDesc, setEvtDesc] = useState('');
  const [evtImage, setEvtImage] = useState('');

  // Custom Officer Terms & Officer Entries State
  const [selectedOfficerTerm, setSelectedOfficerTerm] = useState<string>(
    officerTerms[0]?.term ?? ''
  );
  const [newTermInput, setNewTermInput] = useState('');
  const [officerFormOpen, setOfficerFormOpen] = useState(false);
  const [editingOfficerId, setEditingOfficerId] = useState<string | null>(null);
  const [officerPositionInput, setOfficerPositionInput] = useState<string>(
    SSC_POSITIONS[0]
  );
  const [officerNameInput, setOfficerNameInput] = useState('');
  const [officerImageInput, setOfficerImageInput] = useState('');

  // Official & Admin Logins Generator State
  const [newAccName, setNewAccName] = useState('');
  const [newAccEmail, setNewAccEmail] = useState('');
  const [newAccPosition, setNewAccPosition] = useState(SSC_POSITIONS[0]);
  const [newAccTerm, setNewAccTerm] = useState(
    officerTerms[0]?.term || '2025–2026'
  );
  const [newAccRole, setNewAccRole] = useState<'admin' | 'official'>('admin');
  const [newAccPasscode, setNewAccPasscode] = useState(() =>
    createPasscode('admin')
  );
  const [accError, setAccError] = useState('');
  const [revealedAccIds, setRevealedAccIds] = useState<Record<string, boolean>>(
    {}
  );
  const [copiedAccId, setCopiedAccId] = useState<string | null>(null);
  const [accFormOpen, setAccFormOpen] = useState(false);

  // FAQ Edit / Create State
  const [faqFormOpen, setFaqFormOpen] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [faqCategory, setFaqCategory] = useState('Council Office');
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');

  const isPrimaryAdmin = isPrimaryAdminUser(official.email);
  const isWebAdmin = official.role === 'admin' || isPrimaryAdmin;

  const activeOfficerRoster =
    officerTerms.find((t) => t.term === selectedOfficerTerm) ?? officerTerms[0];

  // Restore any ongoing persistent admin draft from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(ADMIN_DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.activeTab) setActiveTab(draft.activeTab);
      if (draft.annFormOpen) {
        setEditingAnnId(draft.editingAnnId ?? null);
        setAnnTitle(draft.annTitle ?? '');
        setAnnDate(draft.annDate ?? '');
        setAnnCategory(draft.annCategory ?? 'Campus Life');
        setAnnSummary(draft.annSummary ?? '');
        setAnnIssuedBy(
          draft.annIssuedBy ?? `${official.name} (${official.position})`
        );
        setAnnImage(draft.annImage ?? '');
        setAnnFormOpen(true);
      } else if (draft.evtFormOpen) {
        setEditingEvtId(draft.editingEvtId ?? null);
        setEvtTitle(draft.evtTitle ?? '');
        setEvtDate(draft.evtDate ?? '');
        setEvtTime(draft.evtTime ?? '');
        setEvtLocation(draft.evtLocation ?? '');
        setEvtCategory(draft.evtCategory ?? 'Governance');
        setEvtDesc(draft.evtDesc ?? '');
        setEvtImage(draft.evtImage ?? '');
        setEvtFormOpen(true);
      } else if (draft.officerFormOpen) {
        setEditingOfficerId(draft.editingOfficerId ?? null);
        setOfficerPositionInput(draft.officerPositionInput ?? SSC_POSITIONS[0]);
        setOfficerNameInput(draft.officerNameInput ?? '');
        setOfficerImageInput(draft.officerImageInput ?? '');
        setOfficerFormOpen(true);
      } else if (draft.accFormOpen && isWebAdmin) {
        setNewAccName(draft.newAccName ?? '');
        setNewAccEmail(draft.newAccEmail ?? '');
        setNewAccPosition(draft.newAccPosition ?? SSC_POSITIONS[0]);
        setNewAccTerm(draft.newAccTerm ?? '2025–2026');
        setNewAccRole(draft.newAccRole ?? 'admin');
        setNewAccPasscode(draft.newAccPasscode ?? createPasscode('admin'));
        setAccFormOpen(true);
      } else if (draft.faqFormOpen) {
        setEditingFaqId(draft.editingFaqId ?? null);
        setFaqCategory(draft.faqCategory ?? 'Council Office');
        setFaqQuestion(draft.faqQuestion ?? '');
        setFaqAnswer(draft.faqAnswer ?? '');
        setFaqFormOpen(true);
      } else if (draft.brandingModalOpen) {
        setDraftLogoUrl(draft.draftLogoUrl ?? branding.customLogoUrl);
        setDraftAboutImg(draft.draftAboutImg ?? branding.aboutSlacImage);
        setDraftHeroImg(draft.draftHeroImg ?? branding.heroImage);
        setBrandingModalOpen(true);
      }
    } catch {
      // Ignore storage access errors
    }
  }, [
    branding.aboutSlacImage,
    branding.customLogoUrl,
    branding.heroImage,
    isWebAdmin,
    official.name,
    official.position,
  ]);

  // Persist ongoing admin edits so changes are never lost accidentally
  useEffect(() => {
    try {
      const hasOpenEditor =
        annFormOpen ||
        evtFormOpen ||
        officerFormOpen ||
        accFormOpen ||
        faqFormOpen ||
        brandingModalOpen;
      if (!hasOpenEditor) {
        window.sessionStorage.removeItem(ADMIN_DRAFT_STORAGE_KEY);
        return;
      }
      const payload = {
        activeTab,
        annFormOpen,
        editingAnnId,
        annTitle,
        annDate,
        annCategory,
        annSummary,
        annIssuedBy,
        annImage,
        evtFormOpen,
        editingEvtId,
        evtTitle,
        evtDate,
        evtTime,
        evtLocation,
        evtCategory,
        evtDesc,
        evtImage,
        officerFormOpen,
        editingOfficerId,
        officerPositionInput,
        officerNameInput,
        officerImageInput,
        accFormOpen,
        newAccName,
        newAccEmail,
        newAccPosition,
        newAccTerm,
        newAccRole,
        newAccPasscode,
        faqFormOpen,
        editingFaqId,
        faqCategory,
        faqQuestion,
        faqAnswer,
        brandingModalOpen,
        draftLogoUrl,
        draftAboutImg,
        draftHeroImg,
      };
      window.sessionStorage.setItem(
        ADMIN_DRAFT_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch {
      // Ignore storage errors
    }
  }, [
    activeTab,
    annFormOpen,
    editingAnnId,
    annTitle,
    annDate,
    annCategory,
    annSummary,
    annIssuedBy,
    annImage,
    evtFormOpen,
    editingEvtId,
    evtTitle,
    evtDate,
    evtTime,
    evtLocation,
    evtCategory,
    evtDesc,
    evtImage,
    officerFormOpen,
    editingOfficerId,
    officerPositionInput,
    officerNameInput,
    officerImageInput,
    accFormOpen,
    newAccName,
    newAccEmail,
    newAccPosition,
    newAccTerm,
    newAccRole,
    newAccPasscode,
    faqFormOpen,
    editingFaqId,
    faqCategory,
    faqQuestion,
    faqAnswer,
    brandingModalOpen,
    draftLogoUrl,
    draftAboutImg,
    draftHeroImg,
  ]);

  const requestCloseEditor = (target: ActiveEditorModal) => {
    setDiscardPromptTarget(target);
  };

  const confirmDiscardEditor = (target: ActiveEditorModal) => {
    setDiscardPromptTarget(null);
    if (target === 'ann') {
      setAnnFormOpen(false);
      setEditingAnnId(null);
    } else if (target === 'evt') {
      setEvtFormOpen(false);
      setEditingEvtId(null);
    } else if (target === 'officer') {
      setOfficerFormOpen(false);
      setEditingOfficerId(null);
    } else if (target === 'acc') {
      setAccFormOpen(false);
      setAccError('');
    } else if (target === 'faq') {
      setFaqFormOpen(false);
      setEditingFaqId(null);
    } else if (target === 'branding') {
      setBrandingModalOpen(false);
    }
  };

  useEffect(() => {
    const hasModal =
      annFormOpen ||
      evtFormOpen ||
      accFormOpen ||
      officerFormOpen ||
      faqFormOpen ||
      brandingModalOpen;
    if (!hasModal) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (annFormOpen) setDiscardPromptTarget('ann');
        else if (evtFormOpen) setDiscardPromptTarget('evt');
        else if (officerFormOpen) setDiscardPromptTarget('officer');
        else if (accFormOpen) setDiscardPromptTarget('acc');
        else if (faqFormOpen) setDiscardPromptTarget('faq');
        else if (brandingModalOpen) setDiscardPromptTarget('branding');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    annFormOpen,
    evtFormOpen,
    accFormOpen,
    officerFormOpen,
    faqFormOpen,
    brandingModalOpen,
  ]);

  const tabs: Array<{ id: AdminTab; label: string }> = [
    { id: 'branding', label: 'Branding & Photos' },
    { id: 'announcements', label: `Announcements (${announcements.length})` },
    { id: 'events', label: `Events (${events.length})` },
    { id: 'officers', label: 'Officers Archive' },
    ...(isWebAdmin
      ? [
          {
            id: 'accounts' as AdminTab,
            label: `Officer Accounts (${accounts.length})`,
          },
        ]
      : []),
    { id: 'forum', label: `Forum (${forumThreads.length})` },
    { id: 'faqs', label: `FAQ (${faqs.length})` },
    { id: 'filters', label: 'Custom Filters' },
  ];

  // --- Branding & Stock Photos Save ---
  const openBrandingModal = () => {
    setDiscardPromptTarget(null);
    setDraftLogoUrl(branding.customLogoUrl);
    setDraftAboutImg(branding.aboutSlacImage);
    setDraftHeroImg(branding.heroImage);
    setBrandingModalOpen(true);
  };

  const handleSaveBrandingModal = (e: FormEvent) => {
    e.preventDefault();
    onUpdateBranding({
      customLogoUrl:
        normalizeImageKitInput(draftLogoUrl) || siteConfig.brand.customLogoUrl,
      aboutSlacImage:
        normalizeImageKitInput(draftAboutImg) || siteConfig.councilSection.image,
      heroImage:
        normalizeImageKitInput(draftHeroImg) || siteConfig.hero.backgroundImage,
    });
    setDiscardPromptTarget(null);
    setBrandingModalOpen(false);
    onNotify?.('Branding and photos updated.', 'login');
  };

  // --- Filter Handlers ---
  const addFilterTag = (section: keyof PortalFilters, rawValue: string) => {
    const clean = rawValue.trim();
    if (!clean) return;
    if (
      filters[section].some(
        (existing) => existing.toLowerCase() === clean.toLowerCase()
      )
    ) {
      return;
    }
    const nextFilters: PortalFilters = {
      ...filters,
      [section]: [...filters[section], clean],
    };
    onSetFilters(nextFilters);
    void upsertPortalSettingsToFirestore(nextFilters, false, branding).catch(
      () => undefined
    );
  };

  const removeFilterTag = (
    section: keyof PortalFilters,
    tagToRemove: string
  ) => {
    const remaining = filters[section].filter((t) => t !== tagToRemove);
    if (remaining.length === 0) return;
    const nextFilters: PortalFilters = {
      ...filters,
      [section]: remaining,
    };
    onSetFilters(nextFilters);
    void upsertPortalSettingsToFirestore(nextFilters, false, branding).catch(
      () => undefined
    );
  };

  // --- Announcement CRUD ---
  const openNewAnnouncement = () => {
    setDiscardPromptTarget(null);
    setEditingAnnId(null);
    setAnnTitle('');
    setAnnDate(
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
      })
    );
    setAnnCategory(filters.announcements[0] ?? 'Campus Life');
    setAnnSummary('');
    setAnnIssuedBy(`${official.name} (${official.position})`);
    setAnnImage('');
    setAnnFormOpen(true);
  };

  const openEditAnnouncement = (item: AnnouncementItem) => {
    setDiscardPromptTarget(null);
    setEditingAnnId(item.id);
    setAnnTitle(item.title);
    setAnnDate(item.date);
    setAnnCategory(item.category);
    setAnnSummary(item.summary);
    setAnnIssuedBy(item.issuedBy);
    setAnnImage(item.image ?? '');
    setAnnFormOpen(true);
  };

  const saveAnnouncement = (e: FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annSummary.trim()) return;

    const category = annCategory.trim() || 'Campus Life';
    if (!filters.announcements.includes(category)) {
      addFilterTag('announcements', category);
    }

    const resolvedAnnImage = normalizeImageKitInput(annImage) || undefined;

    if (editingAnnId) {
      let updatedItem: AnnouncementItem | null = null;
      const nextList = announcements.map((a) => {
        if (a.id !== editingAnnId) return a;
        updatedItem = {
          ...a,
          title: annTitle.trim(),
          date: annDate.trim() || a.date,
          category,
          summary: annSummary.trim(),
          issuedBy: annIssuedBy.trim() || a.issuedBy,
          image: resolvedAnnImage,
        };
        return updatedItem;
      });
      onSetAnnouncements(nextList);
      if (updatedItem) {
        void upsertAnnouncementToFirestore(updatedItem).catch(() => undefined);
      }
    } else {
      const created: AnnouncementItem = {
        id: `ann-${Date.now()}`,
        title: annTitle.trim(),
        date: annDate.trim() || 'Today',
        category,
        summary: annSummary.trim(),
        issuedBy:
          annIssuedBy.trim() || `${official.name} (${official.position})`,
        image: resolvedAnnImage,
      };
      onSetAnnouncements([created, ...announcements]);
      void upsertAnnouncementToFirestore(created).catch(() => undefined);
    }
    onNotify?.(
      editingAnnId ? 'Announcement updated.' : 'Announcement published.',
      'login'
    );
    setDiscardPromptTarget(null);
    setAnnFormOpen(false);
    setEditingAnnId(null);
  };

  const deleteAnnouncement = (id: string) => {
    onSetAnnouncements(announcements.filter((a) => a.id !== id));
    void deleteAnnouncementFromFirestore(id).catch(() => undefined);
    onNotify?.('Announcement removed.', 'logout');
  };

  // --- Event CRUD ---
  const openNewEvent = () => {
    setDiscardPromptTarget(null);
    setEditingEvtId(null);
    setEvtTitle('');
    setEvtDate('');
    setEvtTime('');
    setEvtLocation('');
    setEvtCategory(filters.events[0] ?? 'Governance');
    setEvtDesc('');
    setEvtImage('');
    setEvtFormOpen(true);
  };

  const openEditEvent = (evt: GalleryEventItem) => {
    setDiscardPromptTarget(null);
    setEditingEvtId(evt.id);
    setEvtTitle(evt.title);
    setEvtDate(evt.date);
    setEvtTime(evt.time);
    setEvtLocation(evt.location);
    setEvtCategory(evt.category);
    setEvtDesc(evt.description);
    setEvtImage(evt.image ?? '');
    setEvtFormOpen(true);
  };

  const saveEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!evtTitle.trim() || !evtDate.trim() || !evtLocation.trim()) return;

    const category = evtCategory.trim() || 'Governance';
    if (!filters.events.includes(category)) {
      addFilterTag('events', category);
    }

    const fallbackImage = branding.heroImage || siteConfig.hero.backgroundImage;
    const resolvedImage = normalizeImageKitInput(evtImage) || fallbackImage;

    if (editingEvtId) {
      let updatedEvt: GalleryEventItem | null = null;
      const nextList = events.map((ev) => {
        if (ev.id !== editingEvtId) return ev;
        updatedEvt = {
          ...ev,
          title: evtTitle.trim(),
          date: evtDate.trim(),
          time: evtTime.trim() || 'TBA',
          location: evtLocation.trim(),
          category,
          description: evtDesc.trim() || ev.description,
          image: resolvedImage,
        };
        return updatedEvt;
      });
      onSetEvents(nextList);
      if (updatedEvt) {
        void upsertEventToFirestore(updatedEvt).catch(() => undefined);
      }
    } else {
      const created: GalleryEventItem = {
        id: `evt-${Date.now()}`,
        title: evtTitle.trim(),
        date: evtDate.trim(),
        time: evtTime.trim() || 'TBA',
        location: evtLocation.trim(),
        category,
        description:
          evtDesc.trim() ||
          `Organized by ${official.name} (${official.position}). Open to SLAC students.`,
        image: resolvedImage,
        imageAlt: `${evtTitle.trim()} campus event`,
      };
      onSetEvents([created, ...events]);
      void upsertEventToFirestore(created).catch(() => undefined);
    }
    onNotify?.(
      editingEvtId ? 'Event updated.' : 'Event published.',
      'login'
    );
    setDiscardPromptTarget(null);
    setEvtFormOpen(false);
    setEditingEvtId(null);
  };

  const deleteEvent = (id: string) => {
    onSetEvents(events.filter((ev) => ev.id !== id));
    void deleteEventFromFirestore(id).catch(() => undefined);
    onNotify?.('Event removed.', 'logout');
  };

  // --- Custom Term Timeline & Officer Roster CRUD ---
  const handleAddCustomTerm = (e: FormEvent) => {
    e.preventDefault();
    const cleanTerm = newTermInput.trim().slice(0, 32);
    if (!cleanTerm) return;

    const existing = officerTerms.find(
      (t) => t.term.toLowerCase() === cleanTerm.toLowerCase()
    );
    if (existing) {
      setSelectedOfficerTerm(existing.term);
      setNewTermInput('');
      return;
    }

    const nextTerms: OfficerTermRoster[] = [
      { term: cleanTerm, officers: [] },
      ...officerTerms,
    ];
    onSetOfficerTerms(nextTerms);
    setSelectedOfficerTerm(cleanTerm);
    setNewTermInput('');
    onNotify?.(`Term ${cleanTerm} added.`, 'login');
  };

  const handleDeleteTerm = async (termToRemove: string) => {
    const remaining = officerTerms.filter((t) => t.term !== termToRemove);
    onSetOfficerTerms(remaining);
    setSelectedOfficerTerm(remaining[0]?.term ?? '');
    try {
      await deleteCouncilTermFromFirestore(termToRemove);
    } catch {
      // Handled by handleFirestoreError
    }
  };

  const openNewOfficerEntry = () => {
    if (!activeOfficerRoster) return;
    setDiscardPromptTarget(null);
    setEditingOfficerId(null);
    setOfficerPositionInput(SSC_POSITIONS[0]);
    setOfficerNameInput('');
    setOfficerImageInput('');
    setOfficerFormOpen(true);
  };

  const startEditOfficer = (member: OfficerMember) => {
    setDiscardPromptTarget(null);
    setEditingOfficerId(member.id);
    setOfficerPositionInput(member.position);
    setOfficerNameInput(member.name);
    setOfficerImageInput(member.image ?? '');
    setOfficerFormOpen(true);
  };

  const deleteOfficerEntry = async (memberId: string) => {
    if (!activeOfficerRoster) return;
    onSetOfficerTerms(
      officerTerms.map((roster) =>
        roster.term !== activeOfficerRoster.term
          ? roster
          : {
              ...roster,
              officers: roster.officers.filter((m) => m.id !== memberId),
            }
      )
    );
    try {
      await deleteCouncilOfficerFromFirestore(memberId);
    } catch {
      // Handled by handleFirestoreError
    }
  };

  const saveOfficerEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeOfficerRoster || !officerNameInput.trim()) return;

    const resolvedImg = normalizeImageKitInput(officerImageInput) || undefined;
    const resolvedPos = officerPositionInput.trim() || SSC_POSITIONS[0];
    const resolvedCommittee = inferCommitteeFromPosition(resolvedPos);
    const isOptional = resolvedPos.toLowerCase().includes('asst');

    let savedMember: OfficerMember | null = null;

    if (editingOfficerId) {
      onSetOfficerTerms(
        officerTerms.map((roster) =>
          roster.term !== activeOfficerRoster.term
            ? roster
            : {
                ...roster,
                officers: roster.officers.map((m) => {
                  if (m.id !== editingOfficerId) return m;
                  const nextMember: OfficerMember = {
                    ...m,
                    position: resolvedPos,
                    committee: resolvedCommittee,
                    name: officerNameInput.trim(),
                    image: resolvedImg,
                    optional: isOptional || undefined,
                  };
                  savedMember = nextMember;
                  return nextMember;
                }),
              }
        )
      );
    } else {
      const createdMember: OfficerMember = {
        id: `off-${Date.now()}`,
        position: resolvedPos,
        committee: resolvedCommittee,
        name: officerNameInput.trim(),
        image: resolvedImg,
        optional: isOptional || undefined,
      };
      savedMember = createdMember;
      onSetOfficerTerms(
        officerTerms.map((roster) =>
          roster.term !== activeOfficerRoster.term
            ? roster
            : {
                ...roster,
                officers: [...roster.officers, createdMember],
              }
        )
      );
    }

    setDiscardPromptTarget(null);
    setOfficerFormOpen(false);
    setEditingOfficerId(null);

    if (savedMember) {
      try {
        await upsertCouncilOfficerToFirestore(
          savedMember,
          activeOfficerRoster.term
        );
      } catch {
        // Handled by handleFirestoreError
      }
    }
  };

  // --- Officer Accounts CRUD ---
  const handleCreateAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!isWebAdmin) {
      setAccError(
        'Only a Web Admin is authorized to create new Officer Accounts.'
      );
      return;
    }

    const cleanEmail = newAccEmail.trim().toLowerCase();
    const cleanName = newAccName.trim();
    const cleanPasscode = newAccPasscode.trim();
    const targetTerm = (
      newAccTerm.trim() ||
      officerTerms[0]?.term ||
      '2025–2026'
    ).slice(0, 32);

    if (!cleanName || !cleanEmail || !cleanPasscode) {
      setAccError('Fill in name, email, and passcode.');
      return;
    }

    if (accounts.some((a) => a.email.toLowerCase() === cleanEmail)) {
      setAccError('An Officer Account with this email already exists.');
      return;
    }

    const created: OfficialAccount = {
      id: `acc-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      position: newAccPosition,
      role: newAccRole,
      passcode: cleanPasscode,
    };

    const nextAccounts = [created, ...accounts];
    onSetAccounts(nextAccounts);

    const existingRoster = officerTerms.find((r) => r.term === targetTerm);
    const existingSlot = existingRoster?.officers.find(
      (m) => m.position.toLowerCase() === newAccPosition.toLowerCase()
    );
    const targetOfficerId = existingSlot?.id ?? `off-${Date.now()}`;
    const targetOfficerImage = existingSlot?.image;

    const newOfficerEntry: OfficerMember = {
      id: targetOfficerId,
      position: newAccPosition,
      committee: inferCommitteeFromPosition(newAccPosition),
      name: cleanName,
      image: targetOfficerImage,
    };

    if (existingRoster) {
      onSetOfficerTerms(
        officerTerms.map((roster) => {
          if (roster.term !== targetTerm) return roster;
          if (existingSlot) {
            return {
              ...roster,
              officers: roster.officers.map((m) =>
                m.id === existingSlot.id ? { ...m, name: cleanName } : m
              ),
            };
          }
          return {
            ...roster,
            officers: [...roster.officers, newOfficerEntry],
          };
        })
      );
    } else {
      onSetOfficerTerms([
        { term: targetTerm, officers: [newOfficerEntry] },
        ...officerTerms,
      ]);
      setSelectedOfficerTerm(targetTerm);
    }

    setAccError('');
    setNewAccName('');
    setNewAccEmail('');
    setNewAccPasscode(createPasscode(newAccRole));
    setDiscardPromptTarget(null);
    setAccFormOpen(false);

    try {
      await pushNewCouncilMemberToFirestore(
        created,
        targetTerm,
        targetOfficerId,
        targetOfficerImage
      );
      onNotify?.('Officer account added.', 'login');
    } catch {
      onNotify?.('Officer account added.', 'login');
    }
  };

  const rotateAccountPasscode = (accId: string, role: 'admin' | 'official') => {
    if (!isWebAdmin) return;
    const nextCode = createPasscode(role);
    let updatedAccount: OfficialAccount | null = null;
    onSetAccounts(
      accounts.map((a) => {
        if (a.id !== accId) return a;
        updatedAccount = { ...a, passcode: nextCode };
        return updatedAccount;
      })
    );
    setRevealedAccIds((prev) => ({ ...prev, [accId]: true }));
    if (updatedAccount) {
      void updateCouncilAccountInFirestore(updatedAccount).catch(
        () => undefined
      );
    }
  };

  const updateAccountRole = (accId: string, nextRole: 'admin' | 'official') => {
    if (!isWebAdmin) return;
    const target = accounts.find((a) => a.id === accId);
    if (!target || isPrimaryAdminUser(target.email)) return;
    let updatedAccount: OfficialAccount | null = null;
    onSetAccounts(
      accounts.map((a) => {
        if (a.id !== accId) return a;
        updatedAccount = { ...a, role: nextRole };
        return updatedAccount;
      })
    );
    if (updatedAccount) {
      void updateCouncilAccountInFirestore(updatedAccount).catch(
        () => undefined
      );
    }
  };

  const copyAccountLogin = async (acc: OfficialAccount) => {
    if (!isWebAdmin) return;
    try {
      await navigator.clipboard.writeText(
        `Email: ${acc.email}\nPasscode: ${acc.passcode}`
      );
      setCopiedAccId(acc.id);
      window.setTimeout(() => setCopiedAccId(null), 1800);
    } catch {
      setCopiedAccId(null);
    }
  };

  const deleteAccount = async (accId: string) => {
    if (!isWebAdmin) return;
    const target = accounts.find((a) => a.id === accId);
    if (!target || isPrimaryAdminUser(target.email)) return;
    const adminsCount = accounts.filter((a) => a.role === 'admin').length;
    if (target.role === 'admin' && adminsCount <= 1) return;
    onSetAccounts(accounts.filter((a) => a.id !== accId));
    // Also remove any linked officer entry from local roster state
    onSetOfficerTerms(
      officerTerms
        .map((roster) => ({
          ...roster,
          officers: roster.officers.filter(
            (m) =>
              m.name.trim().toLowerCase() !== target.name.trim().toLowerCase()
          ),
        }))
        .filter((roster) => roster.officers.length > 0)
    );
    onNotify?.('Officer account removed.', 'logout');
    try {
      await deleteCouncilAccountFromFirestore(
        target.id,
        target.email,
        target.name
      );
    } catch {
      // Handled by handleFirestoreError
    }
  };

  // --- Forum Topic Moderation ---
  const updateThreadTopic = (threadId: string, topic: string) => {
    let updatedThread: ForumThread | null = null;
    onSetForumThreads(
      forumThreads.map((t) => {
        if (t.id !== threadId) return t;
        updatedThread = { ...t, topic };
        return updatedThread;
      })
    );
    if (updatedThread) {
      void upsertForumThreadToFirestore(updatedThread, true).catch(
        () => undefined
      );
    }
  };

  const deleteThread = (threadId: string) => {
    onSetForumThreads(forumThreads.filter((t) => t.id !== threadId));
    void deleteForumThreadFromFirestore(threadId).catch(() => undefined);
  };

  // --- FAQ CRUD ---
  const openNewFaq = () => {
    setDiscardPromptTarget(null);
    setEditingFaqId(null);
    setFaqCategory('Council Office');
    setFaqQuestion('');
    setFaqAnswer('');
    setFaqFormOpen(true);
  };

  const openEditFaq = (item: FaqItem) => {
    setDiscardPromptTarget(null);
    setEditingFaqId(item.id);
    setFaqCategory(item.category);
    setFaqQuestion(item.question);
    setFaqAnswer(item.answer);
    setFaqFormOpen(true);
  };

  const saveFaq = (e: FormEvent) => {
    e.preventDefault();
    if (!faqQuestion.trim() || !faqAnswer.trim()) return;

    const cleanCategory = faqCategory.trim().slice(0, 80) || 'Council Office';
    const cleanQuestion = faqQuestion.trim().slice(0, 300);
    const cleanAnswer = faqAnswer.trim().slice(0, 2000);

    if (editingFaqId) {
      let updatedFaq: FaqItem | null = null;
      let orderIndex = 0;
      const nextFaqs = faqs.map((f, idx) => {
        if (f.id !== editingFaqId) return f;
        orderIndex = idx;
        updatedFaq = {
          ...f,
          category: cleanCategory,
          question: cleanQuestion,
          answer: cleanAnswer,
        };
        return updatedFaq;
      });
      onSetFaqs(nextFaqs);
      if (updatedFaq) {
        void upsertFaqToFirestore(updatedFaq, orderIndex).catch(
          () => undefined
        );
      }
    } else {
      const createdFaq: FaqItem = {
        id: `faq-${Date.now()}`,
        category: cleanCategory,
        question: cleanQuestion,
        answer: cleanAnswer,
      };
      const nextFaqs = [...faqs, createdFaq];
      onSetFaqs(nextFaqs);
      void upsertFaqToFirestore(createdFaq, nextFaqs.length - 1).catch(
        () => undefined
      );
    }

    setDiscardPromptTarget(null);
    setFaqFormOpen(false);
    setEditingFaqId(null);
  };

  const deleteFaq = (faqId: string) => {
    onSetFaqs(faqs.filter((f) => f.id !== faqId));
    void deleteFaqFromFirestore(faqId).catch(() => undefined);
  };

  const renderDiscardBanner = (target: ActiveEditorModal, label: string) => (
    <AnimatePresence>
      {discardPromptTarget === target && (
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
                Discard ongoing {label} edits?
              </p>
              <p className="text-xs text-[#b4bac6]">
                Your changes are saved in draft. Tap Keep Editing to continue or Discard to exit.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDiscardPromptTarget(null)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#3ddc97] text-xs font-semibold text-[#042412] hover:bg-[#34c786] cursor-pointer"
            >
              Keep Editing
            </button>
            <button
              type="button"
              onClick={() => confirmDiscardEditor(target)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/15 text-xs font-semibold text-[#fca5a5] hover:bg-[#ef4444]/25 cursor-pointer"
            >
              Discard Changes
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <section className="w-full border-b border-white/[0.14]">
      <div className="mx-auto max-w-[1440px] border-x border-white/[0.14] bg-[#121620]">
        <div className="px-4 sm:px-8 lg:px-12 py-6 lg:py-8 space-y-6">
          <PageSubNav currentPage="admin" onNavigate={onNavigate} />

          {/* Header Banner (Karst Outlined Frame) */}
          <div className="border-b border-white/[0.14] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#f5f4f0]">
                SSC Admin Dashboard
              </h1>
              <p className="mt-1.5 inline-flex flex-wrap items-center gap-2 text-xs sm:text-sm font-medium text-[#949ba8]">
                <ShieldCheck
                  className="h-4 w-4 text-[#3ddc97]"
                  aria-hidden="true"
                />
                <span className="font-semibold text-[#f5f4f0]">
                  {official.name}
                </span>
                <span>({official.position})</span>
              </p>
            </div>

            <button
              type="button"
              onClick={openBrandingModal}
              className="gemini-cta inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider rounded-full whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
              <span>Edit Logo &amp; About SLAC Photo</span>
            </button>
          </div>

          {/* Resistive Admin Navigation Tabs */}
          <div className="pb-4 border-b border-white/[0.14]">
            <ResistiveFilterBar
              ariaLabel="Admin management sections"
              value={activeTab}
              onChange={setActiveTab}
              options={tabs.map((tab) => ({ value: tab.id, label: tab.label }))}
            />
          </div>

        {/* TAB 0: BRANDING, LOGO & ABOUT SLAC CARD PHOTO */}
        {activeTab === 'branding' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-[#f5f4f0]">
                  Website Logo, About SLAC Card Photo &amp; Stock Images
                </h2>
                <p className="text-xs sm:text-sm text-[#b4bac6]">
                  All assets are synced with ImageKit (ik.imagekit.io/slacssc) and Cloud Firestore.
                </p>
              </div>
              <button
                type="button"
                onClick={openBrandingModal}
                className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer"
              >
                <Edit3 className="h-4 w-4" aria-hidden="true" />
                <span>Open Photo &amp; Logo Editor</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Card 1: Website Logo */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#f5f4f0]">
                    Website Seal / Logo
                  </span>
                  <span className="text-xs font-semibold text-[#3ddc97]">
                    1:1 Square
                  </span>
                </div>
                <div className="aspect-square w-36 mx-auto rounded-xl border border-white/[0.1] bg-[#0b0e15] p-4 flex items-center justify-center overflow-hidden">
                  <img
                    src={
                      resolveImageUrl(
                        branding.customLogoUrl,
                        'w-400,c-at_max,f-auto,q-90'
                      ) || stripImageFramingHash(branding.customLogoUrl)
                    }
                    alt="Website Logo"
                    referrerPolicy="no-referrer"
                    style={getImageFramingStyle(branding.customLogoUrl, 'square')}
                    className="h-full w-full object-contain"
                  />
                </div>
                <ImageKitUploader
                  value={branding.customLogoUrl}
                  onChange={(nextUrl) =>
                    onUpdateBranding({
                      customLogoUrl:
                        nextUrl || siteConfig.brand.customLogoUrl,
                    })
                  }
                  folder="logo"
                  label="Upload or Adjust Logo"
                  aspect="square"
                  cardType="logo"
                />
              </div>

              {/* Card 2: About SLAC Card Photo */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#f5f4f0]">
                    About SLAC Card Photo
                  </span>
                  <span className="text-xs font-semibold text-[#facc15]">
                    4:3 Card
                  </span>
                </div>
                <div className="aspect-[4/3] w-full rounded-xl border border-white/[0.1] bg-[#0b0e15] overflow-hidden">
                  <img
                    src={
                      resolveImageUrl(
                        branding.aboutSlacImage,
                        'w-800,c-at_max,f-auto,q-85'
                      ) || stripImageFramingHash(branding.aboutSlacImage)
                    }
                    alt="About SLAC Card"
                    referrerPolicy="no-referrer"
                    style={getImageFramingStyle(
                      branding.aboutSlacImage,
                      'landscape'
                    )}
                    className="h-full w-full object-cover"
                  />
                </div>
                <ImageKitUploader
                  value={branding.aboutSlacImage}
                  onChange={(nextUrl) =>
                    onUpdateBranding({
                      aboutSlacImage:
                        nextUrl || siteConfig.councilSection.image,
                    })
                  }
                  folder="council-stock"
                  label="Upload or Adjust About SLAC Photo"
                  aspect="landscape"
                  cardType="about"
                />
              </div>

              {/* Card 3: Campus Stock / Fallback Photo */}
              <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 space-y-4 flex flex-col">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#f5f4f0]">
                    Campus Stock Photo
                  </span>
                  <span className="text-xs font-semibold text-[#38bdf8]">
                    16:9 Banner
                  </span>
                </div>
                <div className="aspect-[16/9] w-full rounded-xl border border-white/[0.1] bg-[#0b0e15] overflow-hidden">
                  <img
                    src={
                      resolveImageUrl(
                        branding.heroImage,
                        'w-800,c-at_max,f-auto,q-85'
                      ) || stripImageFramingHash(branding.heroImage)
                    }
                    alt="Campus Stock Photo"
                    referrerPolicy="no-referrer"
                    style={getImageFramingStyle(branding.heroImage, 'landscape')}
                    className="h-full w-full object-cover"
                  />
                </div>
                <ImageKitUploader
                  value={branding.heroImage}
                  onChange={(nextUrl) =>
                    onUpdateBranding({
                      heroImage: nextUrl || siteConfig.hero.backgroundImage,
                    })
                  }
                  folder="council-stock"
                  label="Upload or Adjust Stock Photo"
                  aspect="landscape"
                  cardType="cover"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: CUSTOM FILTERS */}
        {activeTab === 'filters' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {(
                [
                  {
                    key: 'announcements',
                    title: 'Announcement Filters',
                    icon: Megaphone,
                    value: newAnnFilter,
                    setter: setNewAnnFilter,
                    placeholder: 'e.g. Scholarships',
                  },
                  {
                    key: 'events',
                    title: 'Events Gallery Filters',
                    icon: Calendar,
                    value: newEvtFilter,
                    setter: setNewEvtFilter,
                    placeholder: 'e.g. Student Welfare',
                  },
                  {
                    key: 'forum',
                    title: 'Forum Topic Filters',
                    icon: MessageSquare,
                    value: newForumFilter,
                    setter: setNewForumFilter,
                    placeholder: 'e.g. Wi-Fi & Tech',
                  },
                ] as const
              ).map((section) => {
                const Icon = section.icon;
                const tags = filters[section.key];

                return (
                  <div
                    key={section.key}
                    className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 space-y-4 flex flex-col"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#181d29] text-[#3ddc97] border border-white/[0.1]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <h3 className="text-base font-bold text-[#f5f4f0]">
                        {section.title}
                      </h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-[#0b0e15] px-2.5 py-1.5 text-xs font-medium text-[#f5f4f0]"
                        >
                          <Tag
                            className="h-3 w-3 text-[#3ddc97]"
                            aria-hidden="true"
                          />
                          <span>{tag}</span>
                          {tags.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove ${tag} filter`}
                              onClick={() => removeFilterTag(section.key, tag)}
                              className="ml-0.5 text-[#949ba8] hover:text-[#f87171] cursor-pointer"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        addFilterTag(section.key, section.value);
                        section.setter('');
                      }}
                      className="mt-auto pt-2 flex gap-2"
                    >
                      <input
                        type="text"
                        value={section.value}
                        onChange={(e) => section.setter(e.target.value)}
                        placeholder={section.placeholder}
                        aria-label={`Add custom filter for ${section.title}`}
                        className="flex-1 min-h-[40px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-1.5 text-xs sm:text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                      <button
                        type="submit"
                        className="gemini-cta min-h-[40px] px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: MANAGE ANNOUNCEMENTS */}
        {activeTab === 'announcements' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#f5f4f0]">
                All Portal Announcements
              </h2>
              <button
                type="button"
                onClick={openNewAnnouncement}
                className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Announcement</span>
              </button>
            </div>

            <div className="space-y-3">
              {announcements.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/[0.08] bg-[#121620] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#3ddc97]">
                        {item.category}
                      </span>
                      <span className="text-[#949ba8] tabular-nums">
                        {item.date}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#f5f4f0]">
                      {item.title}
                    </h3>
                    <p className="text-sm text-[#b4bac6] line-clamp-2 break-words">
                      {item.summary}
                    </p>
                    <p className="text-xs text-[#949ba8]">{item.issuedBy}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditAnnouncement(item)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/[0.12] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${item.title}`}
                      onClick={() => deleteAnnouncement(item.id)}
                      className="inline-flex items-center justify-center min-h-[38px] min-w-[38px] rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: MANAGE EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#f5f4f0]">
                Upcoming Events Gallery Items
              </h2>
              <button
                type="button"
                onClick={openNewEvent}
                className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add Event</span>
              </button>
            </div>

            <div className="space-y-3">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="rounded-xl border border-white/[0.08] bg-[#121620] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#38bdf8]">
                        {evt.category}
                      </span>
                      <span className="text-[#949ba8] tabular-nums">
                        {evt.date} ({evt.time})
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#f5f4f0]">
                      {evt.title}
                    </h3>
                    <p className="text-sm text-[#b4bac6] line-clamp-2 break-words">
                      {evt.description}
                    </p>
                    <p className="text-xs text-[#949ba8]">{evt.location}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEditEvent(evt)}
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/[0.12] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${evt.title}`}
                      onClick={() => deleteEvent(evt.id)}
                      className="inline-flex items-center justify-center min-h-[38px] min-w-[38px] rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: MANAGE CUSTOM OFFICER TIMELINE & ROSTER */}
        {activeTab === 'officers' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-5 sm:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-[#f5f4f0] flex items-center gap-2">
                    <Users
                      className="h-4.5 w-4.5 text-[#38bdf8]"
                      aria-hidden="true"
                    />
                    <span>Officer Terms &amp; Roster</span>
                  </h2>
                </div>

                <form
                  onSubmit={handleAddCustomTerm}
                  className="flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    maxLength={32}
                    value={newTermInput}
                    onChange={(e) => setNewTermInput(e.target.value)}
                    placeholder="e.g. 2025–2026"
                    aria-label="New academic term"
                    className="w-40 sm:w-48 min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-xs sm:text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                  />
                  <button
                    type="submit"
                    className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Add Term</span>
                  </button>
                </form>
              </div>

              {officerTerms.length > 0 && activeOfficerRoster && (
                <div className="pt-3 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
                  <ResistiveFilterBar
                    ariaLabel="Select officer roster term"
                    compact
                    value={activeOfficerRoster.term}
                    onChange={(term) => {
                      setSelectedOfficerTerm(term);
                      setEditingOfficerId(null);
                    }}
                    options={officerTerms.map((roster) => ({
                      value: roster.term,
                      label: roster.term,
                    }))}
                  />

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={openNewOfficerEntry}
                      className="gemini-cta inline-flex items-center gap-1.5 min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Add Officer Entry</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void handleDeleteTerm(activeOfficerRoster.term)
                      }
                      className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Remove Term</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!activeOfficerRoster ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-6 sm:p-8 text-center">
                <p className="text-sm sm:text-base font-semibold text-[#f5f4f0]">
                  No council terms created yet
                </p>
                <p className="mt-1 text-xs sm:text-sm text-[#b4bac6]">
                  Enter a custom term above (such as 2025–2026) and click “Add Term” to start adding officers.
                </p>
              </div>
            ) : activeOfficerRoster.officers.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-6 sm:p-8 text-center space-y-3">
                <p className="text-sm sm:text-base font-semibold text-[#f5f4f0]">
                  No officers added to {activeOfficerRoster.term} yet
                </p>
                <p className="text-xs sm:text-sm text-[#b4bac6]">
                  Add officer positions and portraits to publish this term on the website.
                </p>
                <button
                  type="button"
                  onClick={openNewOfficerEntry}
                  className="gemini-cta inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add First Officer</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {activeOfficerRoster.officers.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-xl border border-white/[0.08] bg-[#121620] p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-[#3ddc97]">
                            {member.optional
                              ? `${member.position} (Optional)`
                              : member.position}
                          </span>
                        </div>
                        <p className="mt-1 text-base font-bold text-[#f5f4f0] truncate">
                          {member.name.trim() || 'Vacant'}
                        </p>
                        <p className="text-xs text-[#949ba8]">
                          {member.committee}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditOfficer(member)}
                          className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/[0.12] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => void deleteOfficerEntry(member.id)}
                          className="inline-flex items-center justify-center min-h-[38px] min-w-[38px] rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: GENERATE & MANAGE OFFICER ACCOUNTS */}
        {activeTab === 'accounts' && isWebAdmin && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#f5f4f0] flex items-center gap-2">
                <KeyRound
                  className="h-4.5 w-4.5 text-[#3ddc97]"
                  aria-hidden="true"
                />
                <span>Officer Accounts</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setDiscardPromptTarget(null);
                    setAccError('');
                    setAccFormOpen(true);
                  }}
                  className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Add Officer Account</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const isRevealed = Boolean(revealedAccIds[acc.id]);
                const isCopied = copiedAccId === acc.id;
                const adminCount = accounts.filter(
                  (a) => a.role === 'admin'
                ).length;
                const isPrimary = isPrimaryAdminUser(acc.email);
                const canDelete =
                  isWebAdmin &&
                  !isPrimary &&
                  !(acc.role === 'admin' && adminCount <= 1);

                return (
                  <div
                    key={acc.id}
                    className="card-elevated rounded-xl p-4 sm:p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {isPrimary ? (
                            <span className="font-semibold text-[#facc15]">
                              Web Admin (Primary)
                            </span>
                          ) : (
                            <select
                              aria-label={`Access role for ${acc.name}`}
                              value={acc.role}
                              onChange={(e) =>
                                updateAccountRole(
                                  acc.id,
                                  e.target.value as 'admin' | 'official'
                                )
                              }
                              className={`rounded-md border border-white/[0.12] bg-[#0b0e15] px-2 py-0.5 text-xs font-semibold cursor-pointer ${
                                acc.role === 'admin'
                                  ? 'text-[#facc15]'
                                  : 'text-[#3ddc97]'
                              }`}
                            >
                              <option value="admin">Web Admin</option>
                              <option value="official">SSC Official</option>
                            </select>
                          )}
                          <span className="text-[#949ba8]">{acc.position}</span>
                        </div>
                        <h3 className="mt-1 text-base font-bold text-[#f5f4f0] truncate">
                          {acc.name}
                        </h3>
                        <p className="text-xs text-[#b4bac6] truncate">
                          {acc.email}
                        </p>
                      </div>

                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Remove ${acc.email}`}
                          onClick={() => void deleteAccount(acc.id)}
                          className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {isWebAdmin && (
                      <div className="pt-2 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
                        <code className="text-xs font-mono text-[#3ddc97]">
                          {isRevealed ? acc.passcode : '••••••••••••'}
                        </code>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={
                              isRevealed ? 'Hide passcode' : 'Show passcode'
                            }
                            onClick={() =>
                              setRevealedAccIds((prev) => ({
                                ...prev,
                                [acc.id]: !prev[acc.id],
                              }))
                            }
                            className="inline-flex items-center justify-center min-h-[34px] min-w-[34px] rounded-lg border border-white/[0.1] bg-[#181d29] text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                          >
                            {isRevealed ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              rotateAccountPasscode(acc.id, acc.role)
                            }
                            className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-lg border border-white/[0.1] bg-[#181d29] text-[#b4bac6] hover:text-[#f5f4f0] cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            <span>Rotate</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void copyAccountLogin(acc)}
                            className="inline-flex items-center gap-1 min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg border border-white/[0.1] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                          >
                            {isCopied ? (
                              <>
                                <Check
                                  className="h-3 w-3 text-[#3ddc97]"
                                  aria-hidden="true"
                                />
                                <span className="text-[#3ddc97]">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" aria-hidden="true" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 6: FORUM TOPIC MODERATION */}
        {activeTab === 'forum' && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#f5f4f0]">
              Student Forum Discussions &amp; Topic Assignment
            </h2>

            <div className="space-y-3">
              {forumThreads.map((thread) => (
                <div
                  key={thread.id}
                  className="rounded-xl border border-white/[0.08] bg-[#121620] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#949ba8] tabular-nums">
                      <span className="font-semibold text-[#f5f4f0]">
                        {thread.author}
                      </span>
                      <span>
                        {thread.postedAt} ({thread.replies.length} replies)
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-[#f5f4f0]">
                      {thread.title}
                    </h3>
                    <p className="text-sm text-[#b4bac6] line-clamp-2">
                      {thread.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Topic filter for ${thread.title}`}
                      value={thread.topic}
                      onChange={(e) =>
                        updateThreadTopic(thread.id, e.target.value)
                      }
                      className="min-h-[38px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-2.5 py-1.5 text-xs font-medium text-[#f5f4f0]"
                    >
                      {Array.from(
                        new Set([...filters.forum, thread.topic])
                      ).map((topic) => (
                        <option key={topic} value={topic}>
                          {topic}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      aria-label={`Delete thread ${thread.title}`}
                      onClick={() => deleteThread(thread.id)}
                      className="inline-flex items-center justify-center min-h-[38px] min-w-[38px] rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 7: MANAGE FAQs */}
        {activeTab === 'faqs' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-[#f5f4f0]">FAQ</h2>
              <button
                type="button"
                onClick={openNewFaq}
                className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-4 py-2 text-sm font-semibold rounded-lg cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Add FAQ</span>
              </button>
            </div>

            {faqs.length === 0 ? (
              <div className="rounded-2xl border border-white/[0.08] bg-[#121620] p-6 sm:p-8 text-center">
                <p className="text-sm font-medium text-[#b4bac6]">
                  No FAQ entries yet. Click “Add FAQ” above to publish your first question.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {faqs.map((faq) => (
                  <div
                    key={faq.id}
                    className="rounded-xl border border-white/[0.08] bg-[#121620] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <span className="inline-block text-xs font-semibold text-[#3ddc97]">
                        {faq.category}
                      </span>
                      <h3 className="text-base font-bold text-[#f5f4f0]">
                        {faq.question}
                      </h3>
                      <p className="text-sm text-[#b4bac6] leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditFaq(faq)}
                        className="inline-flex items-center gap-1.5 min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg border border-white/[0.12] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.24] cursor-pointer"
                      >
                        <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${faq.question}`}
                        onClick={() => deleteFaq(faq.id)}
                        className="inline-flex items-center justify-center min-h-[38px] min-w-[38px] rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 text-[#f87171] hover:bg-[#ef4444]/20 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* PORTALED ADMIN POP-UP MODALS (PROTECTED BY DISCARD & KEEP EDITING FEATURE) */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {brandingModalOpen && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-branding-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => requestCloseEditor('branding')}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleSaveBrandingModal}
                  className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h3
                      id="admin-branding-modal-title"
                      className="text-lg font-bold text-[#f5f4f0]"
                    >
                      Edit Logo, About SLAC Photo &amp; Stock Images
                    </h3>
                    <button
                      type="button"
                      aria-label="Close branding editor"
                      onClick={() => requestCloseEditor('branding')}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {renderDiscardBanner('branding', 'logo and photo')}

                  <div className="p-6 space-y-4">
                    <ImageKitUploader
                      value={draftLogoUrl}
                      onChange={setDraftLogoUrl}
                      folder="logo"
                      label="Website Logo (1:1)"
                      aspect="square"
                      cardType="logo"
                    />

                    <ImageKitUploader
                      value={draftAboutImg}
                      onChange={setDraftAboutImg}
                      folder="council-stock"
                      label="About SLAC Card Photo (4:3)"
                      aspect="landscape"
                      cardType="about"
                    />

                    <ImageKitUploader
                      value={draftHeroImg}
                      onChange={setDraftHeroImg}
                      folder="council-stock"
                      label="Campus Stock Photo (16:9)"
                      aspect="landscape"
                      cardType="cover"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => requestCloseEditor('branding')}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Save Branding &amp; Photos
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}

            {annFormOpen && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-ann-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => requestCloseEditor('ann')}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={saveAnnouncement}
                  className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h3
                      id="admin-ann-modal-title"
                      className="text-lg font-bold text-[#f5f4f0]"
                    >
                      {editingAnnId ? 'Edit Announcement' : 'New Announcement'}
                    </h3>
                    <button
                      type="button"
                      aria-label="Close announcement form"
                      onClick={() => requestCloseEditor('ann')}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {renderDiscardBanner('ann', 'announcement')}

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Headline
                        </label>
                        <input
                          type="text"
                          required
                          value={annTitle}
                          onChange={(e) => setAnnTitle(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Category Filter
                        </label>
                        <select
                          value={annCategory}
                          onChange={(e) => setAnnCategory(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        >
                          {Array.from(
                            new Set([...filters.announcements, annCategory])
                          ).map((cat) => (
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
                          Display Date
                        </label>
                        <CalendarDatePicker
                          value={annDate}
                          onChange={setAnnDate}
                          placeholder="Select date"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Issued By
                        </label>
                        <input
                          type="text"
                          value={annIssuedBy}
                          onChange={(e) => setAnnIssuedBy(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Advisory Summary
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={annSummary}
                        onChange={(e) => setAnnSummary(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                      />
                    </div>

                    <ImageKitUploader
                      value={annImage}
                      onChange={setAnnImage}
                      folder="announcements"
                      label="Photo"
                      aspect="landscape"
                      cardType="announcement"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => requestCloseEditor('ann')}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Save Announcement
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}

            {evtFormOpen && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-evt-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => requestCloseEditor('evt')}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={saveEvent}
                  className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h3
                      id="admin-evt-modal-title"
                      className="text-lg font-bold text-[#f5f4f0]"
                    >
                      {editingEvtId ? 'Edit Upcoming Event' : 'New Upcoming Event'}
                    </h3>
                    <button
                      type="button"
                      aria-label="Close event form"
                      onClick={() => requestCloseEditor('evt')}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {renderDiscardBanner('evt', 'event')}

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Event Title
                        </label>
                        <input
                          type="text"
                          required
                          value={evtTitle}
                          onChange={(e) => setEvtTitle(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Category Filter
                        </label>
                        <select
                          value={evtCategory}
                          onChange={(e) => setEvtCategory(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        >
                          {Array.from(
                            new Set([...filters.events, evtCategory])
                          ).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Date
                        </label>
                        <CalendarDatePicker
                          value={evtDate}
                          onChange={setEvtDate}
                          placeholder="Select date"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Time
                        </label>
                        <ClockTimePicker
                          value={evtTime}
                          onChange={setEvtTime}
                          placeholder="Select time"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Campus Venue
                        </label>
                        <input
                          type="text"
                          required
                          value={evtLocation}
                          onChange={(e) => setEvtLocation(e.target.value)}
                          placeholder="e.g. College Auditorium"
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Description
                      </label>
                      <textarea
                        rows={3}
                        value={evtDesc}
                        onChange={(e) => setEvtDesc(e.target.value)}
                        className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                      />
                    </div>

                    <ImageKitUploader
                      value={evtImage}
                      onChange={setEvtImage}
                      folder="events"
                      label="Photo"
                      aspect="landscape"
                      cardType="event"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => requestCloseEditor('evt')}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Save Event
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}

            {officerFormOpen && activeOfficerRoster && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-officer-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => requestCloseEditor('officer')}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={saveOfficerEdit}
                  className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <div>
                      <h3
                        id="admin-officer-modal-title"
                        className="text-lg font-bold text-[#f5f4f0]"
                      >
                        {editingOfficerId
                          ? 'Edit Officer Entry'
                          : 'Add Officer Entry'}
                      </h3>
                      <p className="mt-0.5 text-xs font-semibold text-[#3ddc97]">
                        Term {activeOfficerRoster.term}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Close officer editor"
                      onClick={() => requestCloseEditor('officer')}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {renderDiscardBanner('officer', 'officer entry')}

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Position
                      </label>
                      <select
                        value={officerPositionInput}
                        onChange={(e) =>
                          setOfficerPositionInput(e.target.value)
                        }
                        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                      >
                        {SSC_POSITIONS.map((pos) => (
                          <option key={pos} value={pos}>
                            {pos}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Officer Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={officerNameInput}
                        onChange={(e) => setOfficerNameInput(e.target.value)}
                        placeholder="Full Name"
                        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                      />
                    </div>

                    <ImageKitUploader
                      value={officerImageInput}
                      onChange={setOfficerImageInput}
                      folder="officers"
                      label="Team Portrait Photo"
                      aspect="portrait"
                      cardType="portrait"
                    />

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => requestCloseEditor('officer')}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Save Officer
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}

            {accFormOpen && isWebAdmin && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-acc-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => requestCloseEditor('acc')}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={handleCreateAccount}
                  className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h3
                      id="admin-acc-modal-title"
                      className="text-lg font-bold text-[#f5f4f0]"
                    >
                      Create Officer Account
                    </h3>
                    <button
                      type="button"
                      aria-label="Close officer account generator"
                      onClick={() => requestCloseEditor('acc')}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {renderDiscardBanner('acc', 'officer account')}

                  <div className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          required
                          value={newAccName}
                          onChange={(e) => setNewAccName(e.target.value)}
                          placeholder="e.g. Alyssa Dela Cruz"
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Official Email
                        </label>
                        <input
                          type="email"
                          required
                          value={newAccEmail}
                          onChange={(e) => setNewAccEmail(e.target.value)}
                          placeholder="president@slacssc.org"
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Council Position
                        </label>
                        <select
                          value={newAccPosition}
                          onChange={(e) => setNewAccPosition(e.target.value)}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        >
                          {SSC_POSITIONS.map((pos) => (
                            <option key={pos} value={pos}>
                              {pos === 'Asst. Secretary'
                                ? 'Asst. Secretary (Optional)'
                                : pos}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                          Access Role
                        </label>
                        <select
                          value={newAccRole}
                          onChange={(e) => {
                            const role = e.target.value as 'admin' | 'official';
                            setNewAccRole(role);
                            setNewAccPasscode(createPasscode(role));
                          }}
                          className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0]"
                        >
                          <option value="admin">Web Admin</option>
                          <option value="official">SSC Official</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Academic Term
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={32}
                        value={newAccTerm}
                        onChange={(e) => setNewAccTerm(e.target.value)}
                        placeholder="e.g. 2025–2026"
                        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Generated Passcode
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          value={newAccPasscode}
                          onChange={(e) => setNewAccPasscode(e.target.value)}
                          className="flex-1 min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm font-mono text-[#3ddc97]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNewAccPasscode(createPasscode(newAccRole))
                          }
                          className="inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs font-semibold rounded-lg border border-white/[0.12] bg-[#181d29] text-[#f5f4f0] hover:border-white/[0.24] whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>New Code</span>
                        </button>
                      </div>
                    </div>

                    {accError && (
                      <p
                        role="alert"
                        className="text-xs font-medium text-[#f87171]"
                      >
                        {accError}
                      </p>
                    )}

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => requestCloseEditor('acc')}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta inline-flex items-center gap-1.5 min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>Create Officer Account</span>
                      </button>
                    </div>
                  </div>
                </motion.form>
              </motion.div>
            )}

            {faqFormOpen && (
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="admin-faq-modal-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                onClick={() => requestCloseEditor('faq')}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
              >
                <motion.form
                  initial={{ opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  onClick={(e) => e.stopPropagation()}
                  onSubmit={saveFaq}
                  className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-white/[0.12] bg-[#131519] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                    <h3
                      id="admin-faq-modal-title"
                      className="text-lg font-bold text-[#f5f4f0]"
                    >
                      {editingFaqId ? 'Edit FAQ Entry' : 'Add FAQ Entry'}
                    </h3>
                    <button
                      type="button"
                      aria-label="Close FAQ editor"
                      onClick={() => requestCloseEditor('faq')}
                      className="inline-flex min-h-[42px] min-w-[42px] items-center justify-center rounded-lg text-[#b4bac6] hover:text-[#f5f4f0] hover:bg-[#1a1d22] cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {renderDiscardBanner('faq', 'FAQ')}

                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Category
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={faqCategory}
                        onChange={(e) => setFaqCategory(e.target.value)}
                        placeholder="e.g. Council Office, Campus Events, Clearances"
                        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Question
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={300}
                        value={faqQuestion}
                        onChange={(e) => setFaqQuestion(e.target.value)}
                        placeholder="Enter the student question..."
                        className="w-full min-h-[42px] rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#b4bac6] mb-1">
                        Official Answer
                      </label>
                      <textarea
                        rows={4}
                        required
                        maxLength={2000}
                        value={faqAnswer}
                        onChange={(e) => setFaqAnswer(e.target.value)}
                        placeholder="Provide a clear, helpful response..."
                        className="w-full rounded-lg border border-white/[0.12] bg-[#0b0e15] px-3 py-2 text-sm text-[#f5f4f0] placeholder:text-[#949ba8]"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => requestCloseEditor('faq')}
                        className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#b4bac6] rounded-lg border border-white/[0.12] bg-[#181d29] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Save FAQ
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
