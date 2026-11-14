# Implementation Plan — Full-Site Claude Editorial Typography, Color-Coded Karst Architecture & Balanced Layout System

## 1. Fix the Desktop Header Collision Bug (`image_951bf252.png`)
- **Root Cause**: When an SSC Official is signed in (`Clark Sadicon — Head Of Technical` + the extra `Admin` nav link), the 7 horizontal nav items (`gap-6 lg:gap-8`) collide with the right-hand theme toggle and user badge on intermediate desktop viewports (`768px–1200px`).
- **Fix**:
  - Give the desktop header a 3-zone non-overlapping flex layout inside the `max-w-[1440px]` bar: Brand on the left (`shrink-0`), centered navigation (`flex-1 min-w-0 flex items-center justify-center gap-3 lg:gap-5 xl:gap-7 overflow-x-auto no-scrollbar`), and right-side controls (`shrink-0 flex items-center gap-2 pl-2 border-l border-white/[0.12]`).
  - Keep the signed-in Official/Student identity badge compact (`max-w-[148px] xl:max-w-[190px]`) with monospace role/year tags so `Forum`, `FAQ`, and `Admin` never overlap the theme toggle or profile pill at any screen width.

---

## 2. Claude AI Typography System (`https://claude.com/download` + `image_5866d37d.png`)
- **Editorial Serif Headings (`--font-display`)**: Load **Newsreader** (variable optical-size literary serif matching Claude's Copernicus / Tiempos Text) for `h1`, `h2`, `h3`, modal titles, and section headers.
- **Humanist Sans-Serif Body (`--font-sans`)**: Keep **DM Sans** / **Plus Jakarta Sans** for body copy, form inputs, and navigation links.
- **Technical Monospace Accents (`--font-mono`)**: Load **JetBrains Mono** for uppercase window-header tags (`PROMPT` / `CODE` / `FINAL` style), academic year badges (`A.Y. 2025–2026`), role pills, dates, and counters (`tabular-nums`).
- **Text Animations Preserved**: Keep all `WordRevealText` per-word upward reveals and `ScrollReveal` transitions across the entire site.

---

## 3. Intentional Balance: Where to Use Boxy Outlines vs. Rounded Cards
To avoid making the interface feel overly rigid or monotone, we will balance **Karst Boxy Architectural Frames** with **Rounded Interactive Cards** and **Claude Color-Coded Tags**:

| Surface / Component | Outer Structural Frame | Inner Interactive Cards & Controls | Color-Coded Accents (`Green`, `Yellow/Amber`, `Red/Terracotta`) |
| :--- | :--- | :--- | :--- |
| **Home Page** (`Hero`, `Officers`, `About`, `Support`) | **Boxy (`rounded-none`)** `max-w-[1440px]` 1px outlined grid cells + window-header strip | **Pill (`rounded-full`)** primary CTAs, **Rounded (`rounded-xl`)** Officer portrait cards | Terracotta/Amber active focus tags, Sage Green advisory tags, Coral-Red event tags, Honey-Yellow forum tags |
| **Mobile Burger Menu** (`Header.tsx`) | **Boxy (`rounded-none`)** full-width dropdown sheet anchored at `top-16` with a Claude window-header bar (`● ● ●` + `MENU` / `SETTINGS` mono tags) & `1px` section dividers | **Rounded (`rounded-xl`)** navigation buttons, theme toggle card, and Student/Official identity card inside the sheet | Active route highlighted in Sage Green; Student badge in Warm Amber-Yellow; Official badge in Mint-Green; unread counts in Coral-Red |
| **Login & Account Modal** (`OfficialAuthModal.tsx`) | **Balanced Window Card (`rounded-2xl` outer dialog with a boxy `1px` bordered Claude top window bar)** featuring `● ● ●` dots + `AUTH` / `STUDENT` / `OFFICIAL` mono status tags | **Rounded (`rounded-xl`)** mode switcher tabs (`Student Portal` in Warm Amber-Yellow vs. `Officer & Admin` in Sage Green), rounded input fields, and pill (`rounded-full`) submit CTA | Student mode accented with Warm Amber/Terracotta (`#E8985E` / `#8E631D`); Official mode accented with Botanical Green (`#2B5B42`); validation errors in Soft Coral-Red |
| **Admin Dashboard** (`AdminDashboardPage.tsx`) | **Boxy (`rounded-none`)** `max-w-[1440px]` Karst workspace shell with top window bar (`● ● ●` + `CONSOLE` / `FIRESTORE` / `LIVE` mono tags) & `1px` bordered control header | **Rounded (`rounded-2xl` / `rounded-xl`)** management cards for Announcements, Events, Officers, Accounts, FAQs, and editor modals | Tab-specific color coding: Green for Branding & Officers, Amber-Yellow for Filters, Forum & FAQs, Terracotta-Red for Events & Security/Passcodes |
| **Inner Portal Pages** (`Announcements`, `Events`, `Officers`, `Forum`, `FAQ`) | **Boxy (`rounded-none`)** `max-w-[1440px]` Karst outer frame with top window-header bar, breadcrumb strip, and `1px` section dividers | **Rounded (`rounded-2xl`)** announcement cards, event gallery cards, officer portraits, forum thread/reply cards, and FAQ accordions | Multi-color category tags (`Academic` in Amber, `Campus Life` in Green, `Urgent/Governance` in Terracotta-Red, `Suggestions` in Honey-Yellow) |
| **Supporting Modals** (`ContactModal`, `Identity Settings`) | **Windowed Modal (`rounded-2xl`)** with top `1px` bordered Claude status bar (`● ● ●` + monospace tag) | **Rounded (`rounded-xl`)** form inputs and **Pill (`rounded-full`)** primary action buttons | Warm Amber & Botanical Green status pills |
