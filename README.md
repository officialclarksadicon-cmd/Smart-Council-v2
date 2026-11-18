# Smart Council — SLAC Supreme Student Council Portal (`v2.3`)

Official web portal for the **St. Louis Anne Colleges Supreme Student Council (SLAC SSC)**, built with React 19, Vite, Tailwind CSS 4, Firebase Authentication, Cloud Firestore, Cloud Functions (2nd Gen), and ImageKit CDN.

- **Live Portal**: `https://smart-council.web.app`
- **Firebase Project**: `smart-council-368be`
- **ImageKit Endpoint**: `https://ik.imagekit.io/slacssc`

---

## 1. Local Setup & Environment Variables

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Fill in your server-side credentials in `.env`:
   - `IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/slacssc`
   - `IMAGEKIT_PUBLIC_KEY=<your_imagekit_public_key>`
   - `IMAGEKIT_PRIVATE_KEY=<your_imagekit_private_key>`
   - `VITE_IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/slacssc`
   - `VITE_APP_CHECK_SITE_KEY=<your_recaptcha_site_key>` *(optional, enables Firebase App Check)*

   > **Security Rule**: Never prefix `IMAGEKIT_PRIVATE_KEY` with `VITE_` and never commit `.env` to Git.

4. Start the development server on port `3000`:
   ```bash
   npm run dev
   ```

---

## 2. How to Rotate ImageKit API Keys

Because an earlier prototype commit included fallback ImageKit API keys in source control, rotate them immediately:

1. Sign in to the [ImageKit Dashboard](https://imagekit.io/dashboard) and navigate to **Developer Options → API Keys**.
2. Locate the previously exposed private/public key pair and click **Create New Key Pair** (or **Roll / Regenerate Key**).
3. Copy the newly generated **Public Key** and **Private Key**.
4. Update your local `.env` file (`IMAGEKIT_PUBLIC_KEY` and `IMAGEKIT_PRIVATE_KEY`) and your Cloud Functions secrets:
   ```bash
   firebase functions:secrets:set IMAGEKIT_PUBLIC_KEY
   firebase functions:secrets:set IMAGEKIT_PRIVATE_KEY
   ```
5. Disable/delete the old key pair in the ImageKit Dashboard once the new deployment is verified.

---

## 3. How to Onboard a Council Officer

Passcodes are no longer stored in Firestore or in client state. Authentication uses **Firebase Authentication** (Email/Password or Google Sign-In) backed by **Custom Claims** (`role: 'admin' | 'official'`) and verified `/councilAccounts/{uid}` records.

1. Sign in to the portal as the Primary Web Admin (`official.clarksadicon@gmail.com`) and open **SSC Suite → Officer Accounts**.
2. Click **Add Account**, enter the officer's **Full Name**, **Official Email**, **Council Position**, **Access Role** (`official` or `admin`), and **Academic Term**, then click **Create Account**.
3. The portal provisions their `/councilAccounts` profile, adds them to the `/councilOfficers` term roster, and sends a **Firebase Auth Password Setup / Reset Email** link to their email address.
4. On the sign-in modal (**Sign In → Council Official**), officers can sign in with **Google** or **Email & Password**, or click **Send Password Setup / Reset Link** at any time.

---

## 4. Verification, Build & Deployment

Run the full verification suite before deploying:

```bash
# Type-check & lint (TypeScript + ESLint + Firestore security rules)
npm run lint

# Build production bundle
npm run build
```

Deploy to Firebase Hosting (`smart-council.web.app`) and Firestore Security Rules:

```bash
npx firebase-tools deploy --only hosting:smart-council,firestore:rules --project smart-council-368be
```

If using Cloud Functions (2nd Gen, requires Firebase Blaze plan):

```bash
cd functions && npm install && npm run build && cd ..
npx firebase-tools deploy --only functions,hosting:smart-council,firestore:rules --project smart-council-368be
```

---

## 5. Rollback Plan

- **Hosting Rollback**:
  1. Open [Firebase Console → Hosting → smart-council → Releases](https://console.firebase.google.com/project/smart-council-368be/hosting/sites/smart-council).
  2. Click the three-dot menu next to the last known good release and select **Rollback**, or run:
     ```bash
     npx firebase-tools hosting:clone smart-council:<previous_version_id> smart-council:live --project smart-council-368be
     ```
- **Firestore Rules Rollback**:
  Open **Firebase Console → Firestore Database → Rules → Releases** and restore the previous ruleset version.
- **Git Branch Rollback**:
  All v2.3 release changes are isolated on branch `release/v2.3` so `main` remains untouched until merge.
