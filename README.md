# Smart Council — SLAC Supreme Student Council Portal

Official student council portal for **St. Louis Anne Colleges (SLAC) Supreme Student Council (SSC)** connected to **Firebase (`smart-council-368be`)** and **ImageKit Cloud Storage (`https://ik.imagekit.io/slacssc`)**.

---

## 1. Prerequisites on Your Laptop

- **Node.js 20+** and **npm** installed (`node -v && npm -v`)
- **Firebase CLI** (can be run via `npx firebase-tools`)

---

## 2. Quick Setup & Local Development

1. Extract `smart-council-updated.zip` and open your terminal in the project folder:
   ```bash
   cd smart-council
   npm install
   ```

2. Your `.env` and `.env.example` are pre-configured with your ImageKit API credentials (`https://ik.imagekit.io/slacssc`):
   ```env
   IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/slacssc"
   VITE_IMAGEKIT_URL_ENDPOINT="https://ik.imagekit.io/slacssc"
   IMAGEKIT_PUBLIC_KEY="public_crsSe9M4B7Az8cXkO0XWZBjfRkY="
   VITE_IMAGEKIT_PUBLIC_KEY="public_crsSe9M4B7Az8cXkO0XWZBjfRkY="
   IMAGEKIT_PRIVATE_KEY="private_2GDDjhN6T/Xkoo7cuLN2pPRbUhU="
   VITE_IMAGEKIT_PRIVATE_KEY="private_2GDDjhN6T/Xkoo7cuLN2pPRbUhU="
   ```

3. Start the local development server on `http://localhost:3000`:
   ```bash
   npm run dev
   ```

---

## 3. Build & Deploy to Firebase (`smart-council-368be`)

1. Build the production bundle (`dist/`):
   ```bash
   npm run build
   ```

2. Deploy both **Firebase Hosting** and **Firestore Security Rules** to `smart-council-368be`:
   ```bash
   npx firebase-tools deploy --project smart-council-368be
   ```
