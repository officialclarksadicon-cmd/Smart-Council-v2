/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Check, LogOut, RefreshCw, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  AnnouncementItem,
  FaqItem,
  ForumReply,
  ForumThread,
  GalleryEventItem,
  OfficerCommittee,
  OfficerMember,
  OfficerTermRoster,
  OfficialAccount,
  OfficialProfile,
  PageRoute,
  PortalBranding,
  PortalFilters,
  StudentProfile,
  siteConfig,
} from './siteConfig';
import type { AuthModalMode } from './components/OfficialAuthModal';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CurrentOfficersSection } from './components/CurrentOfficersSection';
import { CouncilInfoSection } from './components/CouncilInfoSection';
import { Footer } from './components/Footer';
import { EdgeStretchShell } from './components/EdgeStretchShell';
import { PageSkeleton } from './components/PageSkeleton';
import {
  OperationType,
  auth,
  autoSeedPortalToFirestore,
  collection,
  db,
  doc,
  getDoc,
  handleFirestoreError,
  inferCommitteeFromPosition,
  isFirebaseAuthenticated,
  isLegacySeededOfficerId,
  isPrimaryAdminUser,
  onAuthStateChanged,
  onSnapshot,
  query,
  signOut,
  syncFullPortalStateToFirestore,
  upsertAnnouncementToFirestore,
  upsertCouncilOfficerToFirestore,
  upsertEventToFirestore,
  upsertForumThreadToFirestore,
  updateStudentIdentityInFirestore,
  upsertPortalSettingsToFirestore,
  where,
} from './firebase';
import { isCorruptedImageUrl, sanitizeImageKitUrl } from './utils/imagekit';

import { AnnouncementsPage } from './pages/AnnouncementsPage';
import { EventsPage } from './pages/EventsPage';
import { OfficersPage } from './pages/OfficersPage';
import { FaqPage } from './pages/FaqPage';
import { ForumPage } from './pages/ForumPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

const ContactModal = lazy(() =>
  import('./components/ContactModal').then((m) => ({ default: m.ContactModal }))
);
const OfficialAuthModal = lazy(() =>
  import('./components/OfficialAuthModal').then((m) => ({
    default: m.OfficialAuthModal,
  }))
);

const STORAGE_KEY = 'smart_council_portal_v11';
const STUDENT_STORAGE_KEY = 'smart_council_student_v1';
const OFFICIAL_STORAGE_KEY = 'smart_council_official_v1';
const THEME_STORAGE_KEY = 'smart_council_theme_v2';
const VISITED_STORAGE_KEY = 'smart_council_visited_v1';
const SEEN_ITEMS_STORAGE_KEY = 'smart_council_seen_by_account_v3';

export type ThemeMode = 'dark' | 'light';

const VALID_PAGES: PageRoute[] = [
  'home',
  'announcements',
  'events',
  'officers',
  'faq',
  'forum',
  'admin',
];

function getInitialPageFromHash(): PageRoute {
  try {
    const hasVisited = window.localStorage.getItem(VISITED_STORAGE_KEY);
    if (!hasVisited) {
      window.localStorage.setItem(VISITED_STORAGE_KEY, '1');
      if (window.location.hash) {
        window.location.hash = '';
      }
      return 'home';
    }
  } catch {
    // Ignore storage errors
  }
  const hash = window.location.hash.replace('#', '') as PageRoute;
  return VALID_PAGES.includes(hash) ? hash : 'home';
}

interface SeenItemsState {
  announcements: Record<string, boolean>;
  events: Record<string, boolean>;
  forum: Record<string, boolean>;
}

type SeenByAccountState = Record<string, SeenItemsState>;

const EMPTY_SEEN_STATE: SeenItemsState = {
  announcements: {},
  events: {},
  forum: {},
};

function loadSeenByAccount(): SeenByAccountState {
  try {
    const raw = window.localStorage.getItem(SEEN_ITEMS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, Partial<SeenItemsState>>;
      if (parsed && typeof parsed === 'object') {
        const result: SeenByAccountState = {};
        for (const [acctKey, val] of Object.entries(parsed)) {
          result[acctKey] = {
            announcements: val?.announcements ?? {},
            events: val?.events ?? {},
            forum: val?.forum ?? {},
          };
        }
        return result;
      }
    }
  } catch {
    // Ignore
  }
  return {};
}

interface StoredPortalState {
  announcements: AnnouncementItem[];
  events: GalleryEventItem[];
  forumThreads: ForumThread[];
  officerTerms: OfficerTermRoster[];
  officialAccounts: OfficialAccount[];
  faqs?: FaqItem[];
  filters: PortalFilters;
  branding: PortalBranding;
  aiAutoSync: boolean;
}

const DEFAULT_BRANDING: PortalBranding = {
  customLogoUrl: siteConfig.brand.customLogoUrl,
  aboutSlacImage: siteConfig.councilSection.image,
  heroImage: siteConfig.hero.backgroundImage,
};

function sanitizeStoredAnnouncements(
  list: AnnouncementItem[]
): AnnouncementItem[] {
  return list.map((item) => ({
    ...item,
    image: item.image
      ? sanitizeImageKitUrl(item.image, '') || undefined
      : undefined,
  }));
}

function hydrateOfficerTermsClean(
  storedTerms: OfficerTermRoster[]
): OfficerTermRoster[] {
  return storedTerms
    .map((roster) => {
      const customOfficers = (roster.officers ?? [])
        .filter(
          (member) =>
            !isLegacySeededOfficerId(member.id) &&
            member.name.trim().length > 0
        )
        .map((member) => {
          const normalizedCommittee: OfficerCommittee =
            (member.committee as string) === 'Documentation'
              ? 'Documentary'
              : member.committee || inferCommitteeFromPosition(member.position);
          const normalizedPosition =
            member.position === 'Head Of Documentation'
              ? 'Head Of Documentary'
              : member.position;

          const cleanImg = member.image
            ? sanitizeImageKitUrl(member.image, '') || undefined
            : undefined;

          return {
            ...member,
            committee: normalizedCommittee,
            position: normalizedPosition,
            image: cleanImg,
          };
        });

      return {
        term: roster.term,
        officers: customOfficers,
      };
    })
    .filter((roster) => roster.officers.length > 0);
}

function hydrateEventsClean(
  storedEvents: GalleryEventItem[],
  fallbackHero = siteConfig.hero.backgroundImage
): GalleryEventItem[] {
  return storedEvents.map((evt) => ({
    ...evt,
    image: sanitizeImageKitUrl(evt.image, fallbackHero) || fallbackHero,
  }));
}

const LEGACY_SAMPLE_PASSCODES = new Set(['SLAC-ADMIN-2019', 'SLAC-SSC-2019']);

function resolveMigratedAccounts(
  _storedAccounts?: OfficialAccount[]
): OfficialAccount[] {
  // Always start with ONLY the primary admin account (official.clarksadicon@gmail.com).
  // Any additional officer accounts come strictly from the live Firestore councilAccounts collection.
  return siteConfig.officialsAuth.accounts.filter((acc) =>
    isPrimaryAdminUser(acc.email)
  );
}

function loadPortalState(): StoredPortalState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StoredPortalState>;
      const resolvedBranding: PortalBranding = {
        customLogoUrl:
          sanitizeImageKitUrl(
            parsed.branding?.customLogoUrl,
            DEFAULT_BRANDING.customLogoUrl
          ) || DEFAULT_BRANDING.customLogoUrl,
        aboutSlacImage:
          sanitizeImageKitUrl(
            parsed.branding?.aboutSlacImage,
            DEFAULT_BRANDING.aboutSlacImage
          ) || DEFAULT_BRANDING.aboutSlacImage,
        heroImage:
          sanitizeImageKitUrl(
            parsed.branding?.heroImage,
            DEFAULT_BRANDING.heroImage
          ) || DEFAULT_BRANDING.heroImage,
      };
      return {
        announcements: Array.isArray(parsed.announcements)
          ? sanitizeStoredAnnouncements(parsed.announcements)
          : siteConfig.announcements,
        events: Array.isArray(parsed.events)
          ? hydrateEventsClean(parsed.events, resolvedBranding.heroImage)
          : siteConfig.upcomingEvents,
        forumThreads: Array.isArray(parsed.forumThreads)
          ? parsed.forumThreads
          : siteConfig.forumThreads,
        officerTerms:
          Array.isArray(parsed.officerTerms) && parsed.officerTerms.length > 0
            ? hydrateOfficerTermsClean(parsed.officerTerms)
            : siteConfig.officerTerms,
        officialAccounts: resolveMigratedAccounts(parsed.officialAccounts),
        faqs:
          Array.isArray(parsed.faqs) && parsed.faqs.length > 0
            ? parsed.faqs
            : siteConfig.faqs,
        filters: parsed.filters?.announcements
          ? parsed.filters
          : siteConfig.defaultFilters,
        branding: resolvedBranding,
        aiAutoSync: false,
      };
    }
  } catch {
    // Fall back to starter config
  }

  return {
    announcements: siteConfig.announcements,
    events: siteConfig.upcomingEvents,
    forumThreads: siteConfig.forumThreads,
    officerTerms: siteConfig.officerTerms,
    officialAccounts: siteConfig.officialsAuth.accounts,
    faqs: siteConfig.faqs,
    filters: siteConfig.defaultFilters,
    branding: DEFAULT_BRANDING,
    aiAutoSync: false,
  };
}

/**
 * SMART COUNCIL — MAIN APPLICATION
 */
export default function App() {
  const [initialState] = useState<StoredPortalState>(loadPortalState);
  const [currentPage, setCurrentPage] = useState<PageRoute>(
    getInitialPageFromHash
  );
  const [contactOpen, setContactOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>('official');
  const [authNotification, setAuthNotification] = useState<{
    message: string;
    type: 'login' | 'logout' | 'refresh';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Facebook-Style Silhouette Loading & Top Refresh Progress Bar State
  const [isSkeletonLoading, setIsSkeletonLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [progressWidth, setProgressWidth] = useState<number>(30);
  const [progressVisible, setProgressVisible] = useState<boolean>(true);
  const [refreshTriggerCount, setRefreshTriggerCount] = useState<number>(0);

  // Per-Account Notification Badge Tracking (Guest, Student, or Admin/Official)
  const [seenByAccount, setSeenByAccount] =
    useState<SeenByAccountState>(loadSeenByAccount);

  const showAuthNotification = useCallback(
    (message: string, type: 'login' | 'logout' | 'refresh' = 'login') => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      setAuthNotification({ message, type });
      toastTimerRef.current = window.setTimeout(() => {
        setAuthNotification(null);
      }, 3600);
    },
    []
  );

  // Initial page boot silhouette & top progress bar completion
  useEffect(() => {
    const t1 = window.setTimeout(() => setProgressWidth(78), 120);
    const t2 = window.setTimeout(() => {
      setProgressWidth(100);
      setIsSkeletonLoading(false);
    }, 420);
    const t3 = window.setTimeout(() => {
      setProgressVisible(false);
      setProgressWidth(0);
    }, 680);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, []);

  const triggerTopProgressAndSkeleton = useCallback(
    (durationMs = 380, withSkeleton = false) => {
      setProgressVisible(true);
      setProgressWidth(32);
      if (withSkeleton) {
        setIsSkeletonLoading(true);
      }
      const t1 = window.setTimeout(
        () => setProgressWidth(80),
        Math.round(durationMs * 0.35)
      );
      const t2 = window.setTimeout(() => {
        setProgressWidth(100);
        setIsSkeletonLoading(false);
        setIsRefreshing(false);
      }, durationMs);
      const t3 = window.setTimeout(() => {
        setProgressVisible(false);
        setProgressWidth(0);
      }, durationMs + 180);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
        window.clearTimeout(t3);
      };
    },
    []
  );

  const handleRefreshWebsite = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTriggerCount((c) => c + 1);
    triggerTopProgressAndSkeleton(460, true);
  }, [triggerTopProgressAndSkeleton]);

  const [official, setOfficial] = useState<OfficialProfile | null>(() => {
    try {
      const saved = window.localStorage.getItem(OFFICIAL_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as OfficialProfile) : null;
    } catch {
      return null;
    }
  });
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Ignore storage access errors
    }
    return 'light';
  });
  const [student, setStudent] = useState<StudentProfile | null>(() => {
    try {
      const saved = window.localStorage.getItem(STUDENT_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as StudentProfile) : null;
    } catch {
      return null;
    }
  });

  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(
    initialState.announcements
  );
  const [events, setEvents] = useState<GalleryEventItem[]>(initialState.events);
  const [forumThreads, setForumThreads] = useState<ForumThread[]>(
    initialState.forumThreads
  );
  const [officerTerms, setOfficerTerms] = useState<OfficerTermRoster[]>(
    initialState.officerTerms
  );
  const [officialAccounts, setOfficialAccounts] = useState<OfficialAccount[]>(
    initialState.officialAccounts
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(
    initialState.faqs ?? siteConfig.faqs
  );
  const [filters, setFilters] = useState<PortalFilters>(initialState.filters);
  const [branding, setBranding] = useState<PortalBranding>(
    initialState.branding
  );

  // Active account key (guest, student, or official/admin)
  const activeAccountKey = useMemo(() => {
    if (official?.email) {
      return `official:${official.email.trim().toLowerCase()}`;
    }
    if (student) {
      const idPart = (
        student.identifier ||
        student.id ||
        student.name ||
        'student'
      )
        .trim()
        .toLowerCase();
      return `student:${idPart}`;
    }
    return 'guest';
  }, [official, student]);

  const seenItems: SeenItemsState = useMemo(
    () => seenByAccount[activeAccountKey] ?? EMPTY_SEEN_STATE,
    [seenByAccount, activeAccountKey]
  );

  useEffect(() => {
    document.title = 'Smart Council';
  }, []);

  // Persist seen items per account (guest, student, admin/official)
  useEffect(() => {
    try {
      window.localStorage.setItem(
        SEEN_ITEMS_STORAGE_KEY,
        JSON.stringify(seenByAccount)
      );
    } catch {
      // Ignore
    }
  }, [seenByAccount]);

  const markItemSeen = useCallback(
    (category: keyof SeenItemsState, id: string) => {
      if (!id) return;
      setSeenByAccount((prev) => {
        const acctState = prev[activeAccountKey] ?? EMPTY_SEEN_STATE;
        if (acctState[category][id]) return prev;
        return {
          ...prev,
          [activeAccountKey]: {
            ...acctState,
            [category]: {
              ...acctState[category],
              [id]: true,
            },
          },
        };
      });
    },
    [activeAccountKey]
  );

  // Automatically clear section notification badge when guest, student, or admin views the section
  useEffect(() => {
    if (
      currentPage !== 'announcements' &&
      currentPage !== 'events' &&
      currentPage !== 'forum'
    ) {
      return;
    }

    const idsToMark =
      currentPage === 'announcements'
        ? announcements.map((a) => a.id)
        : currentPage === 'events'
          ? events.map((e) => e.id)
          : forumThreads.map((f) => f.id);

    if (idsToMark.length === 0) return;

    setSeenByAccount((prev) => {
      const acctState = prev[activeAccountKey] ?? EMPTY_SEEN_STATE;
      const currentCategoryMap = acctState[currentPage];
      const hasUnseen = idsToMark.some((id) => !currentCategoryMap[id]);
      if (!hasUnseen) return prev;

      const updatedCategoryMap = { ...currentCategoryMap };
      for (const id of idsToMark) {
        updatedCategoryMap[id] = true;
      }

      return {
        ...prev,
        [activeAccountKey]: {
          ...acctState,
          [currentPage]: updatedCategoryMap,
        },
      };
    });
  }, [
    currentPage,
    activeAccountKey,
    announcements,
    events,
    forumThreads,
  ]);

  const unreadCounts = useMemo(
    () => ({
      announcements: announcements.filter(
        (a) => !seenItems.announcements[a.id]
      ).length,
      events: events.filter((e) => !seenItems.events[e.id]).length,
      forum: forumThreads.filter((f) => !seenItems.forum[f.id]).length,
    }),
    [announcements, events, forumThreads, seenItems]
  );

  // Keep latest state ref for background auto-seeding
  const latestStateRef = useRef({
    accounts: officialAccounts,
    officerTerms,
    announcements,
    events,
    forumThreads,
    faqs,
    filters,
    branding,
    aiAutoSync: false,
  });
  useEffect(() => {
    latestStateRef.current = {
      accounts: officialAccounts,
      officerTerms,
      announcements,
      events,
      forumThreads,
      faqs,
      filters,
      branding,
      aiAutoSync: false,
    };
  }, [
    officialAccounts,
    officerTerms,
    announcements,
    events,
    forumThreads,
    faqs,
    filters,
    branding,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const payload: StoredPortalState = {
          announcements,
          events,
          forumThreads,
          officerTerms,
          officialAccounts,
          faqs,
          filters,
          branding,
          aiAutoSync: false,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {
        // Ignore storage quota errors
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    announcements,
    events,
    forumThreads,
    officerTerms,
    officialAccounts,
    faqs,
    filters,
    branding,
  ]);

  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace('#', '') as PageRoute;
      setCurrentPage(VALID_PAGES.includes(hash) ? hash : 'home');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    try {
      if (student) {
        window.localStorage.setItem(
          STUDENT_STORAGE_KEY,
          JSON.stringify(student)
        );
      } else {
        window.localStorage.removeItem(STUDENT_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [student]);

  useEffect(() => {
    try {
      if (official) {
        window.localStorage.setItem(
          OFFICIAL_STORAGE_KEY,
          JSON.stringify(official)
        );
      } else {
        window.localStorage.removeItem(OFFICIAL_STORAGE_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
  }, [official]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  // 1. Live Firestore Listener: /announcements (Auto-repairs corrupted image strings)
  useEffect(() => {
    const annQuery = query(
      collection(db, 'announcements'),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      annQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setAnnouncements([]);
          return;
        }
        const docsWithTime = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdMillis =
            typeof d.createdAt?.toMillis === 'function'
              ? d.createdAt.toMillis()
              : Date.now();
          const rawImg = typeof d.image === 'string' ? d.image.trim() : '';
          const wasCorrupted = Boolean(rawImg && isCorruptedImageUrl(rawImg));
          const cleanImg = rawImg
            ? sanitizeImageKitUrl(rawImg, '') || undefined
            : undefined;

          const item: AnnouncementItem = {
            id: String(d.id ?? docSnap.id),
            title: String(d.title ?? ''),
            date: String(d.date ?? 'Today'),
            category: String(d.category ?? 'Campus Life'),
            summary: String(d.summary ?? ''),
            issuedBy: String(d.issuedBy ?? 'SLAC SSC'),
            image: cleanImg,
          };

          if (wasCorrupted && isFirebaseAuthenticated()) {
            void upsertAnnouncementToFirestore(item).catch(() => undefined);
          }

          return { item, createdMillis };
        });
        docsWithTime.sort((a, b) => b.createdMillis - a.createdMillis);
        setAnnouncements(docsWithTime.map((entry) => entry.item));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'announcements');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 2. Live Firestore Listener: /events (Auto-repairs corrupted image strings)
  useEffect(() => {
    const evtQuery = query(
      collection(db, 'events'),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      evtQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setEvents([]);
          return;
        }
        const fallbackImg =
          latestStateRef.current.branding.heroImage ||
          siteConfig.hero.backgroundImage;
        const docsWithTime = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdMillis =
            typeof d.createdAt?.toMillis === 'function'
              ? d.createdAt.toMillis()
              : Date.now();
          const rawImg = typeof d.image === 'string' ? d.image.trim() : '';
          const wasCorrupted = Boolean(rawImg && isCorruptedImageUrl(rawImg));
          const cleanImg =
            sanitizeImageKitUrl(rawImg, fallbackImg) || fallbackImg;

          const item: GalleryEventItem = {
            id: String(d.id ?? docSnap.id),
            title: String(d.title ?? ''),
            date: String(d.date ?? 'TBA'),
            time: String(d.time ?? 'TBA'),
            location: String(d.location ?? 'SLAC Campus'),
            category: String(d.category ?? 'Governance'),
            description: String(d.description ?? ''),
            image: cleanImg,
            imageAlt: String(d.imageAlt ?? `${d.title ?? 'SLAC'} event`),
          };

          if (wasCorrupted && isFirebaseAuthenticated()) {
            void upsertEventToFirestore(item).catch(() => undefined);
          }

          return { item, createdMillis };
        });
        docsWithTime.sort((a, b) => b.createdMillis - a.createdMillis);
        setEvents(docsWithTime.map((e) => e.item));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'events');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 3. Live Firestore Listener: /forumThreads
  useEffect(() => {
    const forumQuery = query(
      collection(db, 'forumThreads'),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      forumQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setForumThreads([]);
          return;
        }
        const docsWithTime = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdMillis =
            typeof d.createdAt?.toMillis === 'function'
              ? d.createdAt.toMillis()
              : Date.now();
          const rawReplies = Array.isArray(d.replies) ? d.replies : [];
          const replies: ForumReply[] = rawReplies.map(
            (r: Record<string, unknown>, idx: number) => ({
              id: String(r?.id ?? `rep-${idx}`),
              author: String(r?.author ?? 'SLAC Student'),
              yearLevel: String(r?.yearLevel ?? 'SLAC Student'),
              time: String(r?.time ?? 'Just now'),
              message: String(r?.message ?? ''),
            })
          );
          const item: ForumThread = {
            id: String(d.id ?? docSnap.id),
            author: String(d.author ?? 'SLAC Student'),
            yearLevel: String(d.yearLevel ?? 'SLAC Student'),
            postedAt: String(d.postedAt ?? 'Just now'),
            topic: String(d.topic ?? 'Suggestions'),
            title: String(d.title ?? ''),
            body: String(d.body ?? ''),
            supportCount: Number(d.supportCount) || 0,
            replies,
          };
          return { item, createdMillis };
        });
        docsWithTime.sort((a, b) => b.createdMillis - a.createdMillis);
        setForumThreads(docsWithTime.map((entry) => entry.item));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'forumThreads');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 4. Live Firestore Listener: /portalSettings (Filters + Branding Assets)
  useEffect(() => {
    const settingsQuery = query(
      collection(db, 'portalSettings'),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      settingsQuery,
      (snapshot) => {
        if (snapshot.empty) return;
        const configDoc =
          snapshot.docs.find((d) => d.id === 'config') ?? snapshot.docs[0];
        if (!configDoc) return;
        const d = configDoc.data();
        setFilters((prev) => ({
          announcements:
            Array.isArray(d.announcementFilters) &&
            d.announcementFilters.length > 0
              ? d.announcementFilters.map(String)
              : prev.announcements,
          events:
            Array.isArray(d.eventFilters) && d.eventFilters.length > 0
              ? d.eventFilters.map(String)
              : prev.events,
          forum:
            Array.isArray(d.forumFilters) && d.forumFilters.length > 0
              ? d.forumFilters.map(String)
              : prev.forum,
        }));
        setBranding((prev) => ({
          customLogoUrl:
            typeof d.customLogoUrl === 'string' &&
            !isCorruptedImageUrl(d.customLogoUrl)
              ? sanitizeImageKitUrl(d.customLogoUrl, prev.customLogoUrl)
              : prev.customLogoUrl,
          aboutSlacImage:
            typeof d.aboutSlacImage === 'string' &&
            !isCorruptedImageUrl(d.aboutSlacImage)
              ? sanitizeImageKitUrl(d.aboutSlacImage, prev.aboutSlacImage)
              : prev.aboutSlacImage,
          heroImage:
            typeof d.heroImage === 'string' && !isCorruptedImageUrl(d.heroImage)
              ? sanitizeImageKitUrl(d.heroImage, prev.heroImage)
              : prev.heroImage,
        }));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'portalSettings');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 5. Live Firestore Listener: /councilOfficers (Auto-repairs corrupted image strings)
  useEffect(() => {
    const officersQuery = query(
      collection(db, 'councilOfficers'),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      officersQuery,
      (snapshot) => {
        const customDocs = snapshot.docs
          .filter((docSnap) => {
            const d = docSnap.data();
            const docId = String(d.id ?? docSnap.id);
            const officerName = String(d.name ?? '').trim();
            return (
              !isLegacySeededOfficerId(docSnap.id) &&
              !isLegacySeededOfficerId(docId) &&
              officerName.length > 0
            );
          })
          .map((docSnap) => {
            const d = docSnap.data();
            const position = String(d.position ?? 'SSC Officer');
            const term = String(d.term ?? '2025–2026').trim();
            const rawImg = typeof d.image === 'string' ? d.image.trim() : '';
            const wasCorrupted = Boolean(rawImg && isCorruptedImageUrl(rawImg));
            const cleanImg = rawImg
              ? sanitizeImageKitUrl(rawImg, '') || undefined
              : undefined;

            const member: OfficerMember = {
              id: String(d.id ?? docSnap.id),
              position,
              committee:
                (d.committee as OfficerCommittee) ||
                inferCommitteeFromPosition(position),
              name: String(d.name ?? '').trim(),
              image: cleanImg,
              optional:
                typeof d.optional === 'boolean' ? d.optional : undefined,
            };

            if (wasCorrupted && isFirebaseAuthenticated()) {
              void upsertCouncilOfficerToFirestore(member, term).catch(
                () => undefined
              );
            }

            return {
              term,
              member,
            };
          });

        setOfficerTerms((prevTerms) => {
          const termMap = new Map<string, OfficerMember[]>();
          for (const entry of customDocs) {
            if (!entry.term) continue;
            const list = termMap.get(entry.term) ?? [];
            list.push(entry.member);
            termMap.set(entry.term, list);
          }

          for (const prevRoster of prevTerms) {
            if (
              prevRoster.term &&
              prevRoster.officers.length === 0 &&
              !termMap.has(prevRoster.term)
            ) {
              termMap.set(prevRoster.term, []);
            }
          }

          return Array.from(termMap.entries()).map(([term, officers]) => ({
            term,
            officers,
          }));
        });
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'councilOfficers');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 6. Live Firestore Listener: /faqs
  useEffect(() => {
    const faqsQuery = query(
      collection(db, 'faqs'),
      where('visibility', '==', 'public')
    );
    const unsubscribe = onSnapshot(
      faqsQuery,
      (snapshot) => {
        if (snapshot.empty) return;
        const docsWithOrder = snapshot.docs.map((docSnap, idx) => {
          const d = docSnap.data();
          const orderNum = typeof d.order === 'number' ? d.order : idx;
          const createdMillis =
            typeof d.createdAt?.toMillis === 'function'
              ? d.createdAt.toMillis()
              : idx;
          const item: FaqItem = {
            id: String(d.id ?? docSnap.id),
            category: String(d.category ?? 'Council Office'),
            question: String(d.question ?? ''),
            answer: String(d.answer ?? ''),
          };
          return { item, orderNum, createdMillis };
        });
        docsWithOrder.sort(
          (a, b) => a.orderNum - b.orderNum || a.createdMillis - b.createdMillis
        );
        setFaqs(docsWithOrder.map((entry) => entry.item));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'faqs');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 7. Live 2-Way Firestore Listener: /councilAccounts (Replaces state directly from DB; retains primary admin)
  useEffect(() => {
    const accountsQuery = query(
      collection(db, 'councilAccounts'),
      where('role', 'in', ['admin', 'official'])
    );
    const unsubscribe = onSnapshot(
      accountsQuery,
      (snapshot) => {
        const primaryAdmin: OfficialAccount = {
          id: 'acc-admin-1',
          email: 'official.clarksadicon@gmail.com',
          passcode: '123456',
          name: 'Clark Sadicon',
          position: 'Head Of Technical',
          role: 'admin',
        };
        const map = new Map<string, OfficialAccount>([
          [primaryAdmin.email.toLowerCase(), primaryAdmin],
        ]);

        for (const docSnap of snapshot.docs) {
          const d = docSnap.data();
          const email = String(d.email ?? '')
            .trim()
            .toLowerCase();
          if (!email) continue;
          map.set(email, {
            id: String(d.id ?? docSnap.id),
            email,
            passcode: String(d.passcode ?? '123456'),
            name: String(d.name ?? 'SSC Official'),
            position: String(d.position ?? 'Head Of Technical'),
            role: d.role === 'admin' ? 'admin' : 'official',
          });
        }

        setOfficialAccounts(Array.from(map.values()));
      },
      () => {
        // Ignore if unauthenticated guest
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount, official]);

  // 8. Listen to Firebase Auth state & sync unified councilAccounts
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      void autoSeedPortalToFirestore(latestStateRef.current);

      if (isPrimaryAdminUser(user.email)) {
        setOfficial((prev) =>
          prev ?? {
            id: 'acc-admin-1',
            email: 'official.clarksadicon@gmail.com',
            name: 'Clark Sadicon',
            position: 'Head Of Technical',
            role: 'admin',
          }
        );
      } else {
        void getDoc(doc(db, 'councilAccounts', user.uid))
          .then((snap) => {
            if (snap.exists()) {
              const d = snap.data();
              const resolvedRole: 'admin' | 'official' =
                d.role === 'admin' ? 'admin' : 'official';
              setOfficial((prev) =>
                prev ?? {
                  id: String(d.id ?? user.uid),
                  email: user.email ?? '',
                  name: String(d.name ?? user.displayName ?? 'SSC Official'),
                  position: String(d.position ?? 'SSC Officer'),
                  role: resolvedRole,
                }
              );
            }
          })
          .catch(() => undefined);
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  const openAuthModal = useCallback((mode: AuthModalMode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  }, []);

  const navigateTo = useCallback(
    (page: PageRoute) => {
      if (page === 'admin' && !official) {
        openAuthModal('official');
        return;
      }
      if (page === currentPage) {
        if (window.scrollY > 0) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
      setCurrentPage(page);
      const nextUrl =
        page === 'home'
          ? window.location.pathname + window.location.search
          : `${window.location.pathname}${window.location.search}#${page}`;
      window.history.replaceState(null, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [currentPage, official, openAuthModal]
  );

  const handleUpdateBranding = useCallback(
    (patch: Partial<PortalBranding>) => {
      setBranding((prev) => {
        const next: PortalBranding = {
          ...prev,
          ...patch,
        };
        void upsertPortalSettingsToFirestore(filters, false, next).catch(
          () => undefined
        );
        return next;
      });
    },
    [filters]
  );

  const handleAddAnnouncement = (created: AnnouncementItem) => {
    const updated = [created, ...announcements];
    setAnnouncements(updated);
    void upsertAnnouncementToFirestore(created).catch(() => undefined);
    showAuthNotification('Announcement published.', 'login');
  };

  const handleAddEvent = (created: GalleryEventItem) => {
    const updated = [created, ...events];
    setEvents(updated);
    void upsertEventToFirestore(created).catch(() => undefined);
    showAuthNotification('Event published.', 'login');
  };

  const handleUpdateStudentIdentity = useCallback(
    (nextName: string, nextYearCourse: string) => {
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              name: nextName,
              yearCourse: nextYearCourse,
            }
          : prev
      );
      void updateStudentIdentityInFirestore(nextName, nextYearCourse).catch(
        () => undefined
      );
      showAuthNotification('Student identity updated.', 'login');
    },
    [showAuthNotification]
  );

  const handleAddForumThread = (created: ForumThread) => {
    const updated = [created, ...forumThreads];
    setForumThreads(updated);

    const cleanTopic = created.topic.trim();
    if (
      cleanTopic &&
      !filters.forum.some(
        (existing) => existing.toLowerCase() === cleanTopic.toLowerCase()
      )
    ) {
      const nextFilters: PortalFilters = {
        ...filters,
        forum: [...filters.forum, cleanTopic],
      };
      setFilters(nextFilters);
      if (official) {
        void upsertPortalSettingsToFirestore(
          nextFilters,
          false,
          branding
        ).catch(() => undefined);
      }
    }

    void upsertForumThreadToFirestore(created, Boolean(official)).catch(
      () => undefined
    );
  };

  const handleAddForumReply = (threadId: string, reply: ForumReply) => {
    let targetThread: ForumThread | null = null;
    setForumThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        targetThread = { ...t, replies: [...t.replies, reply] };
        return targetThread;
      })
    );
    if (targetThread) {
      void upsertForumThreadToFirestore(targetThread, false).catch(
        () => undefined
      );
    }
  };

  const handleToggleForumSupport = (threadId: string, delta: number) => {
    let targetThread: ForumThread | null = null;
    setForumThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        targetThread = {
          ...t,
          supportCount: Math.max(0, t.supportCount + delta),
        };
        return targetThread;
      })
    );
    if (targetThread) {
      void upsertForumThreadToFirestore(targetThread, false).catch(
        () => undefined
      );
    }
  };

  const handleResetDefaults = () => {
    setAnnouncements(siteConfig.announcements);
    setEvents(siteConfig.upcomingEvents);
    setForumThreads(siteConfig.forumThreads);
    setOfficerTerms(siteConfig.officerTerms);
    setOfficialAccounts(siteConfig.officialsAuth.accounts);
    setFaqs(siteConfig.faqs);
    setFilters(siteConfig.defaultFilters);
    setBranding(DEFAULT_BRANDING);
    void syncFullPortalStateToFirestore({
      announcements: siteConfig.announcements,
      events: siteConfig.upcomingEvents,
      forumThreads: siteConfig.forumThreads,
      officerTerms: siteConfig.officerTerms,
      faqs: siteConfig.faqs,
      filters: siteConfig.defaultFilters,
      branding: DEFAULT_BRANDING,
      aiAutoSync: false,
    });
  };

  return (
    <MotionConfig reducedMotion="never">
      <div className="relative min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)] overflow-x-clip">
        {/* Top Refresh & Navigation Progress Bar */}
        <AnimatePresence>
          {progressVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed top-0 left-0 right-0 z-[80] h-[3px] bg-transparent pointer-events-none"
            >
              <div
                style={{ width: `${progressWidth}%` }}
                className="h-full bg-[#2f6f4e] transition-[width] duration-200 ease-out"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. Header Section */}
        <Header
          currentPage={currentPage}
          official={official}
          student={student}
          theme={theme}
          customLogoUrl={branding.customLogoUrl}
          unreadCounts={unreadCounts}
          onToggleTheme={() =>
            setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
          }
          onNavigate={navigateTo}
          onOpenAuth={openAuthModal}
          onUpdateStudentIdentity={handleUpdateStudentIdentity}
          onSignOutOfficial={() => {
            setOfficial(null);
            if (!student && auth.currentUser) {
              void signOut(auth);
            }
            setCurrentPage('home');
            window.location.hash = '';
            window.scrollTo({ top: 0, behavior: 'auto' });
            showAuthNotification('Signed out.', 'logout');
          }}
          onSignOutStudent={() => {
            setStudent(null);
            if (!official && auth.currentUser) {
              void signOut(auth);
            }
            setCurrentPage('home');
            window.location.hash = '';
            window.scrollTo({ top: 0, behavior: 'auto' });
            showAuthNotification('Signed out.', 'logout');
          }}
        />

        {/* Login / Logout / Refresh Status Notification Toast */}
        <AnimatePresence>
          {authNotification && (
            <motion.div
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm rounded-xl border border-white/[0.14] bg-[#121620] px-4 py-3 shadow-lg flex items-center gap-3"
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg shrink-0 ${
                  authNotification.type === 'login' ||
                  authNotification.type === 'refresh'
                    ? 'bg-[#3ddc97]/15 text-[#3ddc97]'
                    : 'bg-[#facc15]/15 text-[#facc15]'
                }`}
              >
                {authNotification.type === 'login' ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : authNotification.type === 'refresh' ? (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <p className="text-xs sm:text-sm font-semibold text-[#f5f4f0]">
                {authNotification.message}
              </p>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => setAuthNotification(null)}
                className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-[#949ba8] hover:text-[#f5f4f0] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <EdgeStretchShell isRefreshing={isRefreshing} onPullRefresh={handleRefreshWebsite}>
          {/* 2. Active Page View (with Facebook-Style Silhouette Loading State) */}
          <main className="flex flex-col flex-1">
            {isSkeletonLoading ? (
              <PageSkeleton page={currentPage} />
            ) : (
              <>
                <div
                  className={currentPage === 'home' ? 'block' : 'hidden'}
                  aria-hidden={currentPage !== 'home'}
                >
                  <HeroSection
                    announcements={announcements}
                    events={events}
                    forumThreads={forumThreads}
                    theme={theme}
                    customLogoUrl={branding.customLogoUrl}
                    isActive={currentPage === 'home'}
                    unreadCounts={unreadCounts}
                    onToggleTheme={() =>
                      setTheme((prev) =>
                        prev === 'dark' ? 'light' : 'dark'
                      )
                    }
                    onNavigate={navigateTo}
                  />
                  <CurrentOfficersSection
                    officerTerms={officerTerms}
                    onNavigate={navigateTo}
                  />
                  <CouncilInfoSection
                    aboutImage={branding.aboutSlacImage}
                    customLogoUrl={branding.customLogoUrl}
                    official={official}
                    onUpdateBranding={handleUpdateBranding}
                    onOpenContact={() => setContactOpen(true)}
                  />
                </div>

                {currentPage === 'announcements' && (
                  <AnnouncementsPage
                    announcements={announcements}
                    filterOptions={filters.announcements}
                    official={official}
                    seenIds={seenItems.announcements}
                    onMarkSeen={(id) => markItemSeen('announcements', id)}
                    onNavigate={navigateTo}
                    onAddAnnouncement={handleAddAnnouncement}
                  />
                )}
                {currentPage === 'events' && (
                  <EventsPage
                    events={events}
                    filterOptions={filters.events}
                    official={official}
                    seenIds={seenItems.events}
                    onMarkSeen={(id) => markItemSeen('events', id)}
                    onNavigate={navigateTo}
                    onAddEvent={handleAddEvent}
                  />
                )}
                {currentPage === 'officers' && (
                  <OfficersPage
                    terms={officerTerms}
                    official={official}
                    onNavigate={navigateTo}
                  />
                )}
                {currentPage === 'faq' && (
                  <FaqPage
                    faqs={faqs}
                    official={official}
                    onNavigate={navigateTo}
                  />
                )}
                {currentPage === 'forum' && (
                  <ForumPage
                    threads={forumThreads}
                    filterOptions={filters.forum}
                    official={official}
                    student={student}
                    seenIds={seenItems.forum}
                    onMarkSeen={(id) => markItemSeen('forum', id)}
                    onOpenStudentAuth={() => openAuthModal('student')}
                    onNavigate={navigateTo}
                    onAddThread={handleAddForumThread}
                    onAddReply={handleAddForumReply}
                    onToggleSupport={handleToggleForumSupport}
                  />
                )}
                {currentPage === 'admin' && official && (
                  <AdminDashboardPage
                    official={official}
                    announcements={announcements}
                    events={events}
                    forumThreads={forumThreads}
                    officerTerms={officerTerms}
                    accounts={officialAccounts}
                    faqs={faqs}
                    filters={filters}
                    branding={branding}
                    onNavigate={navigateTo}
                    onSetAnnouncements={setAnnouncements}
                    onSetEvents={setEvents}
                    onSetForumThreads={setForumThreads}
                    onSetOfficerTerms={setOfficerTerms}
                    onSetAccounts={setOfficialAccounts}
                    onSetFaqs={setFaqs}
                    onSetFilters={setFilters}
                    onUpdateBranding={handleUpdateBranding}
                    onResetDefaults={handleResetDefaults}
                    onNotify={showAuthNotification}
                  />
                )}
                {currentPage === 'admin' && !official && (
                  <div className="w-full py-10 px-6 text-center space-y-4">
                    <div className="mx-auto max-w-md rounded-2xl border border-white/[0.08] bg-[#121620] p-6 sm:p-8 space-y-4">
                      <h1 className="text-2xl font-bold text-[#f5f4f0]">
                        SSC Official Sign-In Required
                      </h1>
                      <p className="text-sm text-[#b4bac6]">
                        Sign in with an officer or admin account to open the dashboard.
                      </p>
                      <button
                        type="button"
                        onClick={() => openAuthModal('official')}
                        className="gemini-cta min-h-[44px] px-5 py-2.5 text-sm font-semibold rounded-lg cursor-pointer"
                      >
                        Open Official Sign In
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>

          {/* 3. Footer Section (Full Footer on Home Only, Very Bottom Bar on Other Pages) */}
          <Footer
            currentPage={currentPage}
            customLogoUrl={branding.customLogoUrl}
            onNavigate={navigateTo}
            onOpenContact={() => setContactOpen(true)}
            onOpenOfficialAuth={() => openAuthModal('official')}
          />
        </EdgeStretchShell>

        {/* Contact SSC Dialog */}
        {contactOpen && (
          <Suspense fallback={null}>
            <ContactModal
              isOpen={contactOpen}
              onClose={() => setContactOpen(false)}
            />
          </Suspense>
        )}

        {/* Separated Student & Official Auth Dialog */}
        {authModalOpen && (
          <Suspense fallback={null}>
            <OfficialAuthModal
              isOpen={authModalOpen}
              initialMode={authMode}
              accounts={officialAccounts}
              currentStudent={student}
              onClose={() => setAuthModalOpen(false)}
              onSignInOfficial={(signedOfficial) => {
                setOfficial(signedOfficial);
                setCurrentPage('home');
                window.location.hash = '';
                window.scrollTo({ top: 0, behavior: 'auto' });
                showAuthNotification(
                  `Signed in as ${signedOfficial.name}.`,
                  'login'
                );
              }}
              onSignInStudent={(signedStudent) => {
                setStudent(signedStudent);
                setCurrentPage('home');
                window.location.hash = '';
                window.scrollTo({ top: 0, behavior: 'auto' });
                showAuthNotification(
                  `Signed in as ${signedStudent.name}.`,
                  'login'
                );
              }}
              onContinueAsGuest={() => {
                if (student) {
                  showAuthNotification(
                    'Signed out.',
                    'logout'
                  );
                }
                setStudent(null);
                setCurrentPage('home');
                window.location.hash = '';
                window.scrollTo({ top: 0, behavior: 'auto' });
              }}
            />
          </Suspense>
        )}
      </div>
    </MotionConfig>
  );
}
