/**
 * ============================================================================
 * SMART COUNCIL — SLAC SUPREME STUDENT COUNCIL CONFIGURATION (PRODUCTION)
 * ============================================================================
 * Clean production configuration for St. Louis Anne Colleges Supreme Student
 * Council (SLAC SSC). Live announcements, events, forum threads, and council
 * officers are synchronized directly from Cloud Firestore (smart-council-368be)
 * and ImageKit Cloud Storage (https://ik.imagekit.io/slacssc).
 */

export const IMAGEKIT_CAMPUS_HERO =
  '/assets/aistudio/caroline-badran-xTmez98cqAM-unsplash_385fef1d.jpg';
export const IMAGEKIT_COUNCIL_OFFICE =
  'https://ik.imagekit.io/slacssc/smart-council/council-stock/council-office_axkKY8UNt.jpg';
export const IMAGEKIT_DEFAULT_LOGO =
  'https://ik.imagekit.io/slacssc/smart-council/logo/ssc-logo_yvq35sFUH.png';

export const SLAC_COLLEGE_DEPARTMENTS = [
  'College Of Education',
  'College Of Computer Studies',
  'College Of Accountancy',
  'College Of Business Administration',
  'College Of Hospitality Management',
] as const;

export const SLAC_YEAR_LEVELS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
] as const;

export const SSC_POSITIONS = [
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
] as const;

export type PageRoute =
  | 'home'
  | 'announcements'
  | 'events'
  | 'officers'
  | 'faq'
  | 'forum'
  | 'admin';

export interface NavItem {
  label: string;
  page: PageRoute;
}

export interface OfficialAccount {
  id: string;
  email: string;
  passcode: string;
  name: string;
  position: string;
  role: 'admin' | 'official';
}

export interface OfficialProfile {
  id: string;
  email: string;
  name: string;
  position: string;
  role: 'admin' | 'official';
}

export interface StudentProfile {
  id: string;
  name: string;
  identifier: string;
  yearCourse: string;
  photoURL?: string;
}

export interface AnnouncementItem {
  id: string;
  date: string;
  category: string;
  title: string;
  summary: string;
  issuedBy: string;
  image?: string;
}

export interface GalleryEventItem {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  category: string;
  description: string;
  image: string;
  imageAlt: string;
}

export type OfficerCommittee =
  | 'Executive Board'
  | 'Year Level Representatives'
  | 'Information'
  | 'Documentary'
  | 'Technical';

export interface OfficerMember {
  id: string;
  position: string;
  committee: OfficerCommittee;
  name: string;
  image?: string;
  optional?: boolean;
}

export interface OfficerTermRoster {
  term: string;
  officers: OfficerMember[];
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface ForumReply {
  id: string;
  author: string;
  yearLevel: string;
  time: string;
  message: string;
}

export interface ForumThread {
  id: string;
  author: string;
  yearLevel: string;
  postedAt: string;
  topic: string;
  title: string;
  body: string;
  supportCount: number;
  replies: ForumReply[];
}

export interface PortalFilters {
  announcements: string[];
  events: string[];
  forum: string[];
}

export interface PortalBranding {
  customLogoUrl: string;
  aboutSlacImage: string;
  heroImage: string;
}

export const siteConfig = {
  /* --------------------------------------------------------------------------
   * 1. LOGO & BRAND SETTINGS
   * -------------------------------------------------------------------------- */
  brand: {
    name: 'Smart Council',
    fullName: 'SLAC Supreme Student Council (SSC)',
    institution: 'St. Louis Anne Colleges — San Pedro, Laguna',
    customLogoUrl: IMAGEKIT_DEFAULT_LOGO as string,
    imagekitEndpoint: 'https://ik.imagekit.io/slacssc',
  },

  /* --------------------------------------------------------------------------
   * 2. OFFICIAL COUNCIL DETAILS & SOCIAL LINKS
   * -------------------------------------------------------------------------- */
  councilInfo: {
    establishedYear: '2019',
    officeLocation: 'Second Floor, College Building',
    availabilityTitle: 'Mon–Sat, 8:00 AM – 5:00 PM (Closed Sundays)',
    availabilityNote:
      'Open Monday to Saturday from 8:00 AM to 5:00 PM. Closed on Sundays.',
    supportEmail: 'counciltechsupport@gmail.com',
    facebookPageUrl: 'https://www.facebook.com/officialpageslacssc',
    facebookPageName: 'SLAC Supreme Student Council',
    facebookPathLabel: 'facebook.com/officialpageslacssc',
  },

  /* --------------------------------------------------------------------------
   * 3. WEB-ADMIN PROVISIONED DATABASE ROSTER
   * -------------------------------------------------------------------------- */
  officialsAuth: {
    accounts: [
      {
        id: 'acc-admin-1',
        email: 'official.clarksadicon@gmail.com',
        passcode: '123456',
        name: 'Clark Sadicon',
        position: 'Head Of Technical',
        role: 'admin',
      },
    ] as OfficialAccount[],
  },

  /* --------------------------------------------------------------------------
   * 4. HEADER NAVIGATION
   * -------------------------------------------------------------------------- */
  header: {
    navItems: [
      { label: 'Home', page: 'home' },
      { label: 'Announcements', page: 'announcements' },
      { label: 'Events', page: 'events' },
      { label: 'Officers', page: 'officers' },
      { label: 'Forum', page: 'forum' },
      { label: 'FAQ', page: 'faq' },
    ] as NavItem[],
    primaryButtonText: 'Sign In',
  },

  /* --------------------------------------------------------------------------
   * 5. DEFAULT CUSTOM FILTER TAGS
   * -------------------------------------------------------------------------- */
  defaultFilters: {
    announcements: ['Urgent', 'Academic', 'Campus Life'],
    events: ['Governance', 'Orientation', 'Outreach', 'Academic'],
    forum: [
      'Campus Facilities',
      'Academics',
      'Student Activities',
      'Suggestions',
    ],
  } as PortalFilters,

  /* --------------------------------------------------------------------------
   * 6. BODY SECTION 1: HERO
   * -------------------------------------------------------------------------- */
  hero: {
    backgroundImage: IMAGEKIT_CAMPUS_HERO,
    backgroundImageAlt:
      'SLAC students gathered inside a modern college lecture auditorium',
    eyebrow: 'SLAC Student Council',
    headline: 'Campus updates and student voice in one place.',
    introduction:
      'Official advisories, events, council archive, and open student discussions for SLAC.',
    primaryCtaText: 'Check Announcements',
    secondaryCtaText: 'Student Forum',
  },

  /* --------------------------------------------------------------------------
   * 7. BODY SECTION 2: COUNCIL HERITAGE & UNIFIED STUDENT SUPPORT
   * -------------------------------------------------------------------------- */
  councilSection: {
    eyebrow: 'About SLAC SSC',
    heading: 'Serving the SLAC student body since 2019.',
    description:
      'We represent SLAC students, support campus organizations, and share verified council updates.',
    image: IMAGEKIT_COUNCIL_OFFICE,
    imageAlt:
      'Supreme Student Council officers and students collaborating around campus study tables',
    pillars: [
      {
        title: 'Established 2019',
        detail: 'Official student council of St. Louis Anne Colleges.',
      },
      {
        title: 'Student Representation',
        detail: 'Bringing student concerns to school administration.',
      },
      {
        title: 'Verified Updates',
        detail: 'Campus memos synced with our official Facebook page.',
      },
    ],
    supportCard: {
      title: 'Student Support Desk',
      description:
        'Need help with permits, concerns, or club records? Reach us online anytime.',
      emailButtonLabel: 'Email Support',
      copyButtonLabel: 'Copy',
      onlineFormLabel: 'Send Online Message',
    },
  },

  /* --------------------------------------------------------------------------
   * 8. ANNOUNCEMENTS PAGE DATA (SYNCED FROM CLOUD FIRESTORE)
   * -------------------------------------------------------------------------- */
  announcements: [] as AnnouncementItem[],

  /* --------------------------------------------------------------------------
   * 9. UPCOMING EVENTS GALLERY (SYNCED FROM CLOUD FIRESTORE)
   * -------------------------------------------------------------------------- */
  upcomingEvents: [] as GalleryEventItem[],

  /* --------------------------------------------------------------------------
   * 10. OFFICERS GALLERY ARCHIVE (CUSTOMIZABLE TIMELINE — SYNCED FROM FIRESTORE)
   * -------------------------------------------------------------------------- */
  officerTerms: [] as OfficerTermRoster[],

  /* --------------------------------------------------------------------------
   * 11. FAQ PAGE DATA
   * -------------------------------------------------------------------------- */
  faqs: [
    {
      id: 'faq-1',
      category: 'Council Office',
      question:
        'Where is the Supreme Student Council office and what are the open hours?',
      answer:
        'Our office room is located on the Second Floor of the College Building and is open Monday to Saturday from 8:00 AM to 5:00 PM (closed on Sundays). Outside office hours, please email counciltechsupport@gmail.com or message our Facebook page.',
    },
    {
      id: 'faq-2',
      category: 'Council History',
      question: 'When was Smart Council formally established?',
      answer:
        'This council was formally established in 2019 as the official Supreme Student Council (SSC) governing body of St. Louis Anne Colleges (SLAC).',
    },
    {
      id: 'faq-3',
      category: 'Campus Events',
      question: 'Do upcoming SSC events require seat reservations?',
      answer:
        'No. Our campus events and assemblies do not require seat reservations. Simply check the Upcoming Events Gallery for the date, time, and venue.',
    },
    {
      id: 'faq-4',
      category: 'SSC Officials',
      question: 'How do SSC Official and Admin accounts work?',
      answer:
        'Official accounts are pre-provisioned directly in the portal database by the Web Admin. Signed-in officials and admins can access the Admin Dashboard to publish announcements, events, officer rosters, and AI-assisted custom filters.',
    },
    {
      id: 'faq-5',
      category: 'Student Support Desk',
      question:
        'How can students reach the SSC Support Desk when the office is closed?',
      answer:
        'Use the Send Online Message form on the home page or email counciltechsupport@gmail.com directly for permits, clearances, or club records. You can also start a discussion thread in the Student Forum anytime.',
    },
  ] as FaqItem[],

  /* --------------------------------------------------------------------------
   * 12. FORUM PAGE DATA (SYNCED FROM CLOUD FIRESTORE)
   * -------------------------------------------------------------------------- */
  forumThreads: [] as ForumThread[],

  /* --------------------------------------------------------------------------
   * 13. FOOTER SECTION TEMPLATE
   * -------------------------------------------------------------------------- */
  footer: {
    description:
      'Official student portal of the St. Louis Anne Colleges Supreme Student Council.',
    copyright: '© 2026 Smart Council — SLAC SSC (Est. 2019).',
    bottomNote:
      'Official Student Governance & Campus Services Portal — San Pedro, Laguna',
  },
};
