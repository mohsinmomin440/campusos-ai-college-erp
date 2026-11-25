# Local Development Guide

## Setup Steps
1. Install root and functions dependencies:
   ```powershell
   npm install
   npm --prefix functions install
   ```
2. Copy `.env.example` to `.env` for local emulator development (`VITE_USE_FIREBASE_EMULATORS=true`).
3. Start the Firebase Emulator Suite (`Auth :9099`, `Functions :5001`, `Firestore :8080`, `Storage :9199`, `Hosting :5000`, `UI :4000`):
   ```powershell
   npm run emulators
   ```
4. Seed synthetic sample data into local emulators:
   ```powershell
   npm run seed:emulator
   ```
5. Launch the frontend dev server:
   ```powershell
   npm run dev
   ```
