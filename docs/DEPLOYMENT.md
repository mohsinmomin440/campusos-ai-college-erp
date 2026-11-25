# Production Deployment Guide

## Option A: Free Spark + Vercel Serverless Architecture (₹0/month)
1. **Firebase Spark Project (`campusos-erp-24bca088`):**
   - Hosts Firebase Authentication, Cloud Firestore `(default)`, and Firebase Hosting (`https://campusos-erp-24bca088.web.app`).
   - Enable **Email/Password** in Firebase Console → Authentication → Sign-in method, and add your Vercel domain under Authorized domains.
   - Deploy Firestore rules and indexes (`firebase deploy --only firestore,hosting`).
2. **Vercel Free Hobby (`api/[action].js` + `vercel.json`):**
   - Hosts the Vite SPA and Node.js Serverless API (`/api/*`) sharing `functions/src/core/handlers.js`.
   - Required Vercel Environment Variables:
     - Public `VITE_FIREBASE_*` keys + `VITE_USE_FIREBASE_EMULATORS=false`
     - Secret `FIREBASE_SERVICE_ACCOUNT_JSON` (from Firebase Console → Service Accounts → Generate new private key)
     - Optional secret `GEMINI_API_KEY` (to activate Gemini AI endpoints)
     - Optional secret `PAYMENT_WEBHOOK_SECRET` (for online payment webhook verification)
   - Deploy via `vercel deploy --prod --yes`.

## Option B: Full Firebase Blaze Deployment
1. Upgrade the Firebase project to Blaze plan in Firebase Console.
2. Configure server secrets:
   ```powershell
   firebase functions:secrets:set GEMINI_API_KEY
   firebase functions:secrets:set PAYMENT_WEBHOOK_SECRET
   ```
3. Clear `VITE_API_BASE_URL` in `.env`, rebuild (`npm run build`), and deploy (`firebase deploy`).

## First-Time Platform Setup
After deploying, open `/register`, create the initial owner account, verify email, and complete **First-Time Production Setup** on the dashboard (`bootstrapPlatform`) to initialize the first `Platform Super Admin` and primary college tenant.
