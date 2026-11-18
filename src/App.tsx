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
import { Check, LogOut, RefreshCw, WifiOff, X } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import {
  AnnouncementItem,
  CouncilTask,
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
import {
  OfficialAuthModal,
  type AuthModalMode,
} from './components/OfficialAuthModal';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { CurrentOfficersSection } from './components/CurrentOfficersSection';
import { CouncilInfoSection } from './components/CouncilInfoSection';
import { Footer } from './components/Footer';
import { EdgeStretchShell } from './components/EdgeStretchShell';
import { PageSkeleton } from './components/PageSkeleton';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  OperationType,
  PRIMARY_ADMIN_UID,
  SITE_VISITS_DOC_ID,
  addForumReplyInFirestore,
  auth,
  collection,
  createAssignedTaskInFirestore,
  db,
  deleteAssignedTaskFromFirestore,
  deleteForumThreadFromFirestore,
  doc,
  getDoc,
  handleFirestoreError,
  incrementSiteVisitsInFirestore,
  inferCommitteeFromPosition,
  isFirebaseAuthenticated,
  isLegacySeededOfficerId,
  isPrimaryAdminUser,
  limit,
  onAuthStateChanged,
  onSnapshot,
  query,
  resolveUserRoleClaim,
  signOut,
  toggleForumSupportTransactionInFirestore,
  updateAssignedTaskStatusInFirestore,
  updateStudentIdentityInFirestore,
  upsertAnnouncementToFirestore,
  upsertCouncilOfficerToFirestore,
  upsertEventToFirestore,
  upsertForumThreadToFirestore,
  upsertPortalSettingsToFirestore,
  where,
} from './firebase';
import { isCorruptedImageUrl, sanitizeImageKitUrl } from './utils/imagekit';

// Route-level code splitting (Phase 2)
const AnnouncementsPage = lazy(() =>
  import('./pages/AnnouncementsPage').then((m) => ({
    default: m.AnnouncementsPage,
  }))
);
const EventsPage = lazy(() =>
  import('./pages/EventsPage').then((m) => ({ default: m.EventsPage }))
);
const OfficersPage = lazy(() =>
  import('./pages/OfficersPage').then((m) => ({ default: m.OfficersPage }))
);
const FaqPage = lazy(() =>
  import('./pages/FaqPage').then((m) => ({ default: m.FaqPage }))
);
const ForumPage = lazy(() =>
  import('./pages/ForumPage').then((m) => ({ default: m.ForumPage }))
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  }))
);
const ContactModal = lazy(() =>
  import('./components/ContactModal').then((m) => ({ default: m.ContactModal }))
);

const STUDENT_STORAGE_KEY = 'smart_council_student_v1';
const OFFICIAL_STORAGE_KEY = 'smart_council_official_v1';
const THEME_STORAGE_KEY = 'smart_council_theme_v2';
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

const PAGE_TITLES: Record<PageRoute, string> = {
  home: 'Smart Council — SLAC Supreme Student Council',
  announcements: 'Announcements — Smart Council',
  events: 'Upcoming Events — Smart Council',
  officers: 'Council Officers — Smart Council',
  faq: 'Frequently Asked Questions — Smart Council',
  forum: 'Student Forum — Smart Council',
  admin: 'SSC Suite — Smart Council',
};

function getPageFromLocationHash(): PageRoute {
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

const DEFAULT_BRANDING: PortalBranding = {
  customLogoUrl: siteConfig.brand.customLogoUrl,
  aboutSlacImage: siteConfig.councilSection.image,
};

/**
 * SMART COUNCIL — MAIN APPLICATION
 */
export default function App() {
  const [currentPage, setCurrentPage] = useState<PageRoute>(
    getPageFromLocationHash
  );
  const [contactOpen, setContactOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthModalMode>('official');
  const [authNotification, setAuthNotification] = useState<{
    message: string;
    type: 'login' | 'logout' | 'refresh';
  } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Network Online / Offline Status Banner (Phase 1 & Phase 5)
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Real Data Readiness Tracking for Route Skeletons (Phase 3)
  const [minBootElapsed, setMinBootElapsed] = useState<boolean>(false);
  const [readyCollections, setReadyCollections] = useState<{
    announcements: boolean;
    events: boolean;
    forum: boolean;
    officers: boolean;
    faqs: boolean;
  }>({
    announcements: false,
    events: false,
    forum: false,
    officers: false,
    faqs: false,
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [progressWidth, setProgressWidth] = useState<number>(30);
  const [progressVisible, setProgressVisible] = useState<boolean>(true);
  const [refreshTriggerCount, setRefreshTriggerCount] = useState<number>(0);

  // Per-Account Notification Badge Tracking
  const [seenByAccount, setSeenByAccount] =
    useState<SeenByAccountState>(loadSeenByAccount);

  // Real-Time Total Website Visits Counter (/siteStats/visits)
  const [totalVisits, setTotalVisits] = useState<number>(0);
  const [authReadyUid, setAuthReadyUid] = useState<string | null>(
    () => auth.currentUser?.uid ?? null
  );

  // Real-Time SSC Suite Assigned Tasks (/tasks)
  const [councilTasks, setCouncilTasks] = useState<CouncilTask[]>([]);

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

  // Minimum 150ms threshold so cached IndexedDB snapshots don't cause a sub-frame skeleton flash
  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setProgressWidth(85);
      setMinBootElapsed(true);
    }, 150);
    // Fallback safety cap in case offline / first boot takes > 1.8s
    const tFallback = window.setTimeout(() => {
      setReadyCollections({
        announcements: true,
        events: true,
        forum: true,
        officers: true,
        faqs: true,
      });
    }, 1800);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(tFallback);
    };
  }, []);

  const isCurrentRouteDataReady = useMemo(() => {
    if (!minBootElapsed) return false;
    if (currentPage === 'home') {
      return readyCollections.announcements && readyCollections.events;
    }
    if (currentPage === 'announcements') return readyCollections.announcements;
    if (currentPage === 'events') return readyCollections.events;
    if (currentPage === 'officers') return readyCollections.officers;
    if (currentPage === 'forum') return readyCollections.forum;
    if (currentPage === 'faq') return readyCollections.faqs;
    return true;
  }, [currentPage, minBootElapsed, readyCollections]);

  useEffect(() => {
    if (!isCurrentRouteDataReady) return;
    setProgressWidth(100);
    const t = window.setTimeout(() => {
      setProgressVisible(false);
      setProgressWidth(0);
    }, 220);
    return () => window.clearTimeout(t);
  }, [isCurrentRouteDataReady]);

  const triggerTopProgress = useCallback((durationMs = 320) => {
    setProgressVisible(true);
    setProgressWidth(35);
    const t1 = window.setTimeout(
      () => setProgressWidth(82),
      Math.round(durationMs * 0.4)
    );
    const t2 = window.setTimeout(() => {
      setProgressWidth(100);
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
  }, []);

  const handleRefreshWebsite = useCallback(() => {
    setIsRefreshing(true);
    setRefreshTriggerCount((c) => c + 1);
    triggerTopProgress(420);
  }, [triggerTopProgress]);

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
    siteConfig.announcements
  );
  const [events, setEvents] = useState<GalleryEventItem[]>(
    siteConfig.upcomingEvents
  );
  const [forumThreads, setForumThreads] = useState<ForumThread[]>(
    siteConfig.forumThreads
  );
  const [officerTerms, setOfficerTerms] = useState<OfficerTermRoster[]>(
    siteConfig.officerTerms
  );
  const [officialAccounts, setOfficialAccounts] = useState<OfficialAccount[]>(
    siteConfig.officialsAuth.accounts
  );
  const [faqs, setFaqs] = useState<FaqItem[]>(siteConfig.faqs);
  const [filters, setFilters] = useState<PortalFilters>(
    siteConfig.defaultFilters
  );
  const [branding, setBranding] = useState<PortalBranding>(DEFAULT_BRANDING);

  const brandingRef = useRef(branding);
  useEffect(() => {
    brandingRef.current = branding;
  }, [branding]);

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

  // Per-route document title updates (Phase 5)
  useEffect(() => {
    document.title = PAGE_TITLES[currentPage] || 'Smart Council';
  }, [currentPage]);

  // Persist seen items per account in localStorage
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

  // Automatically clear section notification badge when user views the section
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

  // Support browser Back / Forward buttons via popstate and hashchange (Phase 5)
  useEffect(() => {
    const syncRouteFromUrl = () => {
      setCurrentPage(getPageFromLocationHash());
    };
    window.addEventListener('hashchange', syncRouteFromUrl);
    window.addEventListener('popstate', syncRouteFromUrl);
    return () => {
      window.removeEventListener('hashchange', syncRouteFromUrl);
      window.removeEventListener('popstate', syncRouteFromUrl);
    };
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

  // 1. Live Firestore Listener: /announcements (Bounded with limit(50))
  useEffect(() => {
    const annQuery = query(
      collection(db, 'announcements'),
      where('visibility', '==', 'public'),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      annQuery,
      (snapshot) => {
        setReadyCollections((prev) =>
          prev.announcements ? prev : { ...prev, announcements: true }
        );
        if (snapshot.empty) {
          setAnnouncements([]);
          return;
        }
        const docsWithTime = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const publishedMillis =
            typeof d.publishedAt?.toMillis === 'function'
              ? d.publishedAt.toMillis()
              : typeof d.createdAt?.toMillis === 'function'
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
            publishedAt: publishedMillis,
            category: String(d.category ?? 'Campus Life'),
            summary: String(d.summary ?? ''),
            issuedBy: String(d.issuedBy ?? 'SLAC SSC'),
            image: cleanImg,
          };

          if (wasCorrupted && isFirebaseAuthenticated()) {
            void upsertAnnouncementToFirestore(item).catch(() => undefined);
          }

          return { item, publishedMillis };
        });
        docsWithTime.sort((a, b) => b.publishedMillis - a.publishedMillis);
        setAnnouncements(docsWithTime.map((entry) => entry.item));
      },
      (error) => {
        setReadyCollections((prev) => ({ ...prev, announcements: true }));
        try {
          handleFirestoreError(error, OperationType.LIST, 'announcements');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 2. Live Firestore Listener: /events (Bounded with limit(50))
  useEffect(() => {
    const evtQuery = query(
      collection(db, 'events'),
      where('visibility', '==', 'public'),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      evtQuery,
      (snapshot) => {
        setReadyCollections((prev) =>
          prev.events ? prev : { ...prev, events: true }
        );
        if (snapshot.empty) {
          setEvents([]);
          return;
        }
        const fallbackImg =
          brandingRef.current.aboutSlacImage || siteConfig.councilSection.image;
        const docsWithTime = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const startsMillis =
            typeof d.startsAt?.toMillis === 'function'
              ? d.startsAt.toMillis()
              : typeof d.createdAt?.toMillis === 'function'
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
            startsAt: startsMillis,
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

          return { item, startsMillis };
        });
        docsWithTime.sort((a, b) => b.startsMillis - a.startsMillis);
        setEvents(docsWithTime.map((e) => e.item));
      },
      (error) => {
        setReadyCollections((prev) => ({ ...prev, events: true }));
        try {
          handleFirestoreError(error, OperationType.LIST, 'events');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount]);

  // 3. Live Firestore Listener: /forumThreads (Bounded with limit(50))
  useEffect(() => {
    const forumQuery = query(
      collection(db, 'forumThreads'),
      where('visibility', '==', 'public'),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      forumQuery,
      (snapshot) => {
        setReadyCollections((prev) =>
          prev.forum ? prev : { ...prev, forum: true }
        );
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
              authorUid:
                typeof r?.authorUid === 'string' ? r.authorUid : undefined,
              yearLevel: String(r?.yearLevel ?? 'SLAC Student'),
              time: String(r?.time ?? 'Just now'),
              message: String(r?.message ?? ''),
            })
          );
          const item: ForumThread = {
            id: String(d.id ?? docSnap.id),
            author: String(d.author ?? 'SLAC Student'),
            authorUid: typeof d.authorUid === 'string' ? d.authorUid : undefined,
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
        setReadyCollections((prev) => ({ ...prev, forum: true }));
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
      where('visibility', '==', 'public'),
      limit(5)
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

  // 5. Live Firestore Listener: /councilOfficers (Scoped to Home, Officers, and Admin pages)
  useEffect(() => {
    if (
      currentPage !== 'home' &&
      currentPage !== 'officers' &&
      currentPage !== 'admin'
    ) {
      return;
    }
    const officersQuery = query(
      collection(db, 'councilOfficers'),
      where('visibility', '==', 'public'),
      limit(150)
    );
    const unsubscribe = onSnapshot(
      officersQuery,
      (snapshot) => {
        setReadyCollections((prev) =>
          prev.officers ? prev : { ...prev, officers: true }
        );
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
        setReadyCollections((prev) => ({ ...prev, officers: true }));
        try {
          handleFirestoreError(error, OperationType.LIST, 'councilOfficers');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [currentPage, refreshTriggerCount]);

  // 6. Live Firestore Listener: /faqs (Scoped to FAQ and Admin pages)
  useEffect(() => {
    if (currentPage !== 'faq' && currentPage !== 'admin') {
      return;
    }
    const faqsQuery = query(
      collection(db, 'faqs'),
      where('visibility', '==', 'public'),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      faqsQuery,
      (snapshot) => {
        setReadyCollections((prev) =>
          prev.faqs ? prev : { ...prev, faqs: true }
        );
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
        setReadyCollections((prev) => ({ ...prev, faqs: true }));
        try {
          handleFirestoreError(error, OperationType.LIST, 'faqs');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [currentPage, refreshTriggerCount]);

  // 7. Live Firestore Listener: /councilAccounts (Strictly for authenticated Officials & Admins; no passcodes)
  useEffect(() => {
    if (!official || !auth.currentUser) {
      return;
    }
    const accountsQuery = query(
      collection(db, 'councilAccounts'),
      where('role', 'in', ['admin', 'official']),
      limit(50)
    );
    const unsubscribe = onSnapshot(
      accountsQuery,
      (snapshot) => {
        const primaryAdmin: OfficialAccount = {
          id: 'acc-admin-1',
          authUid: PRIMARY_ADMIN_UID,
          email: 'official.clarksadicon@gmail.com',
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
          const docId = String(d.id ?? docSnap.id);
          const resolvedUid = isPrimaryAdminUser(email)
            ? PRIMARY_ADMIN_UID
            : typeof d.authUid === 'string' && d.authUid.trim()
              ? d.authUid.trim()
              : docId;
          map.set(email, {
            id: docId,
            authUid: resolvedUid,
            email,
            name: String(d.name ?? 'SSC Official'),
            position: String(d.position ?? 'Head Of Technical'),
            role: d.role === 'admin' ? 'admin' : 'official',
          });
        }

        setOfficialAccounts(Array.from(map.values()));
      },
      () => {
        // Ignore if user does not hold official/admin claim
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount, official, authReadyUid]);

  // 8. Listen to Firebase Auth state & verify Custom Role Claim / councilAccounts record
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setAuthReadyUid(user ? user.uid : null);
      if (!user) return;

      if (isPrimaryAdminUser(user.email)) {
        setOfficial((prev) =>
          prev
            ? { ...prev, authUid: user.uid || PRIMARY_ADMIN_UID }
            : {
                id: 'acc-admin-1',
                authUid: user.uid || PRIMARY_ADMIN_UID,
                email: 'official.clarksadicon@gmail.com',
                name: 'Clark Sadicon',
                position: 'Head Of Technical',
                role: 'admin',
              }
        );
        return;
      }

      const claimRole = await resolveUserRoleClaim(user);
      try {
        const snap = await getDoc(doc(db, 'councilAccounts', user.uid));
        if (snap.exists()) {
          const d = snap.data();
          const resolvedRole: 'admin' | 'official' =
            d.role === 'admin' || claimRole === 'admin' ? 'admin' : 'official';
          setOfficial((prev) =>
            prev
              ? { ...prev, authUid: user.uid, role: resolvedRole }
              : {
                  id: String(d.id ?? user.uid),
                  authUid: user.uid,
                  email: user.email ?? '',
                  name: String(d.name ?? user.displayName ?? 'SSC Official'),
                  position: String(d.position ?? 'SSC Officer'),
                  role: resolvedRole,
                }
          );
        }
      } catch {
        // Ignore if student user
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // 9. Live Firestore Listener: /tasks (Scoped to authenticated Officials & Admins)
  useEffect(() => {
    const activeUid =
      authReadyUid ||
      official?.authUid ||
      (official && isPrimaryAdminUser(official.email)
        ? PRIMARY_ADMIN_UID
        : official?.id);

    if (!official || !activeUid || !auth.currentUser) {
      setCouncilTasks([]);
      return;
    }

    const isAdminOfficer =
      official.role === 'admin' || isPrimaryAdminUser(official.email);

    const tasksQuery = isAdminOfficer
      ? query(collection(db, 'tasks'), limit(100))
      : query(
          collection(db, 'tasks'),
          where('assignedToUid', '==', auth.currentUser.uid),
          limit(100)
        );

    const unsubscribe = onSnapshot(
      tasksQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setCouncilTasks([]);
          return;
        }
        const docsWithTime = snapshot.docs.map((docSnap) => {
          const d = docSnap.data();
          const createdMillis =
            typeof d.createdAt?.toMillis === 'function'
              ? d.createdAt.toMillis()
              : Date.now();
          const completedIso =
            typeof d.completedAt?.toDate === 'function'
              ? d.completedAt.toDate().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : null;
          const createdIso =
            typeof d.createdAt?.toDate === 'function'
              ? d.createdAt.toDate().toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Just now';

          const item: CouncilTask = {
            id: String(d.id ?? docSnap.id),
            title: String(d.title ?? ''),
            description: String(d.description ?? ''),
            assignedToUid: String(d.assignedToUid ?? ''),
            assignedToName: String(d.assignedToName ?? 'SSC Officer'),
            status: d.status === 'completed' ? 'completed' : 'pending',
            createdBy: String(d.createdBy ?? ''),
            createdAt: createdIso,
            completedAt: completedIso,
          };
          return { item, createdMillis };
        });
        docsWithTime.sort((a, b) => b.createdMillis - a.createdMillis);
        setCouncilTasks(docsWithTime.map((entry) => entry.item));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'tasks');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [refreshTriggerCount, official, authReadyUid]);

  // 10. Live Real-Time Firestore Listener: /siteStats/visits (Scoped to Admin Dashboard)
  useEffect(() => {
    if (currentPage !== 'admin' && !official) return;
    const visitsRef = doc(db, 'siteStats', SITE_VISITS_DOC_ID);
    const unsubscribe = onSnapshot(
      visitsRef,
      (snap) => {
        if (!snap.exists()) {
          setTotalVisits(0);
          return;
        }
        const d = snap.data();
        setTotalVisits(Math.max(0, Number(d.visits) || 0));
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, 'siteStats/visits');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );
    return () => unsubscribe();
  }, [currentPage, official, refreshTriggerCount]);

  // Record atomic +1 visit once per browser session via sessionStorage
  useEffect(() => {
    const sessionKey = 'smart_council_session_visit_v3';
    try {
      if (window.sessionStorage.getItem(sessionKey)) return;
      window.sessionStorage.setItem(sessionKey, '1');
    } catch {
      return;
    }

    void incrementSiteVisitsInFirestore();
  }, []);

  const openAuthModal = useCallback((mode: AuthModalMode) => {
    setAuthMode(mode);
    setAuthModalOpen(true);
  }, []);

  // Push history state on route navigation so browser Back/Forward works naturally (Phase 5)
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
      window.history.pushState({ page }, '', nextUrl);
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [currentPage, official, openAuthModal]
  );

  // Optimistic updates with state rollback and toast notification on failure (Phase 1)
  const handleAddCouncilTask = useCallback(
    (created: CouncilTask) => {
      const prevTasks = councilTasks;
      setCouncilTasks((prev) => [created, ...prev]);
      void createAssignedTaskInFirestore(created)
        .then(() => {
          showAuthNotification(
            `Task assigned to ${created.assignedToName}.`,
            'login'
          );
        })
        .catch(() => {
          setCouncilTasks(prevTasks);
          showAuthNotification(
            'Failed to assign task. Changes rolled back.',
            'logout'
          );
        });
    },
    [councilTasks, showAuthNotification]
  );

  const handleToggleCouncilTask = useCallback(
    (taskId: string) => {
      const currentUid =
        auth.currentUser?.uid ||
        official?.authUid ||
        (official && isPrimaryAdminUser(official.email)
          ? PRIMARY_ADMIN_UID
          : official?.id);
      const target = councilTasks.find((t) => t.id === taskId);
      if (!target || !currentUid || target.assignedToUid !== currentUid) {
        showAuthNotification(
          'Only the assigned council officer can update this task status.',
          'logout'
        );
        return;
      }
      const prevTasks = councilTasks;
      const nextStatus: 'pending' | 'completed' =
        target.status === 'completed' ? 'pending' : 'completed';
      const nowLabel =
        nextStatus === 'completed'
          ? new Date().toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : null;

      setCouncilTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: nextStatus, completedAt: nowLabel }
            : t
        )
      );
      void updateAssignedTaskStatusInFirestore(taskId, nextStatus).catch(() => {
        setCouncilTasks(prevTasks);
        showAuthNotification(
          'Failed to update task status. Changes rolled back.',
          'logout'
        );
      });
    },
    [councilTasks, official, showAuthNotification]
  );

  const handleDeleteCouncilTask = useCallback(
    (taskId: string) => {
      const prevTasks = councilTasks;
      setCouncilTasks((prev) => prev.filter((t) => t.id !== taskId));
      void deleteAssignedTaskFromFirestore(taskId).catch(() => {
        setCouncilTasks(prevTasks);
        showAuthNotification(
          'Failed to delete task. Changes rolled back.',
          'logout'
        );
      });
    },
    [councilTasks, showAuthNotification]
  );

  const handleUpdateBranding = useCallback(
    (patch: Partial<PortalBranding>) => {
      setBranding((prev) => {
        const next: PortalBranding = {
          ...prev,
          ...patch,
        };
        void upsertPortalSettingsToFirestore(filters, false, next).catch(() => {
          setBranding(prev);
          showAuthNotification(
            'Failed to update portal branding. Changes rolled back.',
            'logout'
          );
        });
        return next;
      });
    },
    [filters, showAuthNotification]
  );

  const handleAddAnnouncement = (created: AnnouncementItem) => {
    const prevAnnouncements = announcements;
    setAnnouncements([created, ...announcements]);
    void upsertAnnouncementToFirestore(created)
      .then(() => {
        showAuthNotification('Announcement published.', 'login');
      })
      .catch(() => {
        setAnnouncements(prevAnnouncements);
        showAuthNotification(
          'Failed to publish announcement. Changes rolled back.',
          'logout'
        );
      });
  };

  const handleAddEvent = (created: GalleryEventItem) => {
    const prevEvents = events;
    setEvents([created, ...events]);
    void upsertEventToFirestore(created)
      .then(() => {
        showAuthNotification('Event published.', 'login');
      })
      .catch(() => {
        setEvents(prevEvents);
        showAuthNotification(
          'Failed to publish event. Changes rolled back.',
          'logout'
        );
      });
  };

  const handleUpdateStudentIdentity = useCallback(
    (nextName: string, nextYearCourse: string) => {
      const prevStudent = student;
      setStudent((prev) =>
        prev
          ? {
              ...prev,
              name: nextName,
              yearCourse: nextYearCourse,
            }
          : prev
      );
      void updateStudentIdentityInFirestore(nextName, nextYearCourse)
        .then(() => {
          showAuthNotification('Student identity updated.', 'login');
        })
        .catch(() => {
          setStudent(prevStudent);
          showAuthNotification(
            'Failed to update student identity. Changes rolled back.',
            'logout'
          );
        });
    },
    [student, showAuthNotification]
  );

  const handleAddForumThread = (created: ForumThread) => {
    const prevThreads = forumThreads;
    const threadWithUid: ForumThread = {
      ...created,
      authorUid: auth.currentUser?.uid || created.authorUid,
    };
    setForumThreads([threadWithUid, ...forumThreads]);

    const cleanTopic = threadWithUid.topic.trim();
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

    void upsertForumThreadToFirestore(threadWithUid, Boolean(official)).catch(
      () => {
        setForumThreads(prevThreads);
        showAuthNotification(
          'Please sign in to post a forum discussion.',
          'logout'
        );
      }
    );
  };

  const handleAddForumReply = (threadId: string, reply: ForumReply) => {
    const prevThreads = forumThreads;
    const replyWithUid: ForumReply = {
      ...reply,
      authorUid: auth.currentUser?.uid || reply.authorUid,
    };
    let targetThread: ForumThread | null = null;
    setForumThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        targetThread = { ...t, replies: [...t.replies, replyWithUid] };
        return targetThread;
      })
    );
    if (targetThread) {
      void addForumReplyInFirestore(targetThread, replyWithUid).catch(() => {
        setForumThreads(prevThreads);
        showAuthNotification(
          'Please sign in to reply to this discussion.',
          'logout'
        );
      });
    }
  };

  const handleDeleteForumThread = (threadId: string) => {
    const prevThreads = forumThreads;
    setForumThreads((prev) => prev.filter((t) => t.id !== threadId));
    void deleteForumThreadFromFirestore(threadId)
      .then(() => {
        showAuthNotification('Thread removed.', 'logout');
      })
      .catch(() => {
        setForumThreads(prevThreads);
        showAuthNotification(
          'Only the thread author or a moderator can delete this thread.',
          'logout'
        );
      });
  };

  const handleDeleteForumReply = (threadId: string, replyId: string) => {
    const prevThreads = forumThreads;
    let targetThread: ForumThread | null = null;
    setForumThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        targetThread = {
          ...t,
          replies: t.replies.filter((r) => r.id !== replyId),
        };
        return targetThread;
      })
    );
    if (targetThread) {
      void upsertForumThreadToFirestore(targetThread, false)
        .then(() => {
          showAuthNotification('Reply removed.', 'logout');
        })
        .catch(() => {
          setForumThreads(prevThreads);
          showAuthNotification(
            'Failed to remove reply. Changes rolled back.',
            'logout'
          );
        });
    }
  };

  const handleToggleForumSupport = (threadId: string, delta: number) => {
    const prevThreads = forumThreads;
    setForumThreads((prev) =>
      prev.map((t) =>
        t.id === threadId
          ? { ...t, supportCount: Math.max(0, t.supportCount + delta) }
          : t
      )
    );
    void toggleForumSupportTransactionInFirestore(threadId, delta)
      .then((verifiedCount) => {
        setForumThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, supportCount: verifiedCount } : t
          )
        );
      })
      .catch(() => {
        setForumThreads(prevThreads);
        showAuthNotification(
          'Sign in to support a forum discussion.',
          'logout'
        );
      });
  };

  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
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

          {/* Offline Network Status Banner (Phase 1 & Phase 5) */}
          <AnimatePresence>
            {isOffline && (
              <motion.div
                role="status"
                aria-live="polite"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full bg-[#b5483a] text-[#fffdf8] px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 z-[90]"
              >
                <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  You are currently offline. Viewing cached portal data — changes
                  will sync when reconnected.
                </span>
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
              window.history.pushState({ page: 'home' }, '', window.location.pathname);
              window.scrollTo({ top: 0, behavior: 'auto' });
              showAuthNotification('Signed out.', 'logout');
            }}
            onSignOutStudent={() => {
              setStudent(null);
              if (!official && auth.currentUser) {
                void signOut(auth);
              }
              setCurrentPage('home');
              window.history.pushState({ page: 'home' }, '', window.location.pathname);
              window.scrollTo({ top: 0, behavior: 'auto' });
              showAuthNotification('Signed out.', 'logout');
            }}
          />

          {/* Login / Logout / Refresh / Error Status Notification Toast */}
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

          <EdgeStretchShell
            isRefreshing={isRefreshing}
            onPullRefresh={handleRefreshWebsite}
          >
            {/* 2. Active Page View (with Real Data-Bound Silhouette Loading State) */}
            <main className="flex flex-col flex-1">
              {!isCurrentRouteDataReady ? (
                <PageSkeleton page={currentPage} />
              ) : (
                <Suspense fallback={<PageSkeleton page={currentPage} />}>
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
                      onDeleteThread={handleDeleteForumThread}
                      onDeleteReply={handleDeleteForumReply}
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
                      tasks={councilTasks}
                      totalVisits={totalVisits}
                      theme={theme}
                      onToggleTheme={() =>
                        setTheme((prev) =>
                          prev === 'dark' ? 'light' : 'dark'
                        )
                      }
                      onSignOutOfficial={() => {
                        setOfficial(null);
                        if (!student && auth.currentUser) {
                          void signOut(auth);
                        }
                        setCurrentPage('home');
                        window.history.pushState(
                          { page: 'home' },
                          '',
                          window.location.pathname
                        );
                        window.scrollTo({ top: 0, behavior: 'auto' });
                        showAuthNotification('Signed out.', 'logout');
                      }}
                      onNavigate={navigateTo}
                      onSetAnnouncements={setAnnouncements}
                      onSetEvents={setEvents}
                      onSetForumThreads={setForumThreads}
                      onSetOfficerTerms={setOfficerTerms}
                      onSetAccounts={setOfficialAccounts}
                      onSetFaqs={setFaqs}
                      onSetFilters={setFilters}
                      onUpdateBranding={handleUpdateBranding}
                      onAddTask={handleAddCouncilTask}
                      onToggleTask={handleToggleCouncilTask}
                      onDeleteTask={handleDeleteCouncilTask}
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
                          Sign in with an officer or admin account to open SSC
                          Suite.
                        </p>
                        <button
                          type="button"
                          onClick={() => openAuthModal('official')}
                          className="gemini-cta min-h-[42px] px-5 py-2 text-sm font-semibold rounded-lg cursor-pointer"
                        >
                          Open Official Sign In
                        </button>
                      </div>
                    </div>
                  )}
                </Suspense>
              )}
            </main>

            {/* 3. Footer Section */}
            {currentPage !== 'admin' && (
              <Footer
                currentPage={currentPage}
                customLogoUrl={branding.customLogoUrl}
                onNavigate={navigateTo}
                onOpenContact={() => setContactOpen(true)}
                onOpenOfficialAuth={() => openAuthModal('official')}
              />
            )}
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
          <OfficialAuthModal
            isOpen={authModalOpen}
            initialMode={authMode}
            accounts={officialAccounts}
            currentStudent={student}
            onClose={() => setAuthModalOpen(false)}
            onSignInOfficial={(signedOfficial) => {
              setOfficial(signedOfficial);
              setCurrentPage('home');
              window.history.pushState(
                { page: 'home' },
                '',
                window.location.pathname
              );
              window.scrollTo({ top: 0, behavior: 'auto' });
              showAuthNotification(
                `Signed in as ${signedOfficial.name}.`,
                'login'
              );
            }}
            onSignInStudent={(signedStudent) => {
              setStudent(signedStudent);
              setCurrentPage('home');
              window.history.pushState(
                { page: 'home' },
                '',
                window.location.pathname
              );
              window.scrollTo({ top: 0, behavior: 'auto' });
              showAuthNotification(
                `Signed in as ${signedStudent.name}.`,
                'login'
              );
            }}
            onContinueAsGuest={() => {
              if (student) {
                showAuthNotification('Signed out.', 'logout');
              }
              setStudent(null);
              setCurrentPage('home');
              window.history.pushState(
                { page: 'home' },
                '',
                window.location.pathname
              );
              window.scrollTo({ top: 0, behavior: 'auto' });
            }}
          />
        </div>
      </MotionConfig>
    </ErrorBoundary>
  );
}
