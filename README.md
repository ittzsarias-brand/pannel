# Pannel Dashboard

A mobile-first personal dashboard for tracking money (IQD and USD), inventory items, and private notes.

## Stack
- React + TypeScript + Vite
- Firebase Authentication (email/password)
- Cloud Firestore with per-user security rules and live snapshots
- Recharts and Lucide icons
- Firebase Hosting (optional)

## Firebase setup
1. Install Node.js LTS and run `npm install`.
2. Create a project at https://console.firebase.google.com/.
3. In Project settings, create a Web App and copy its Firebase configuration.
4. In Firebase Authentication > Sign-in method, enable **Email/Password**.
5. In Firestore Database, create a database.
6. Open Firestore Rules and publish the contents of `firestore.rules` from this repository. Do this before adding personal data.
7. Copy `.env.example` to `.env.local` and fill in the Firebase Web App configuration values.
8. Run `npm run dev`; run `npm run build` to check the production build.

## Environment variables
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Firebase web configuration values are identifiers, not admin credentials. Never add service-account private keys or other server secrets to frontend code or commit `.env.local`.

## Firestore collections
- `transactions`: title, amount, currency (`IQD` or `USD`), kind (`income` or `expense`), category, userId, createdAt.
- `trackedItems`: name, category, quantity, location, userId, createdAt.
- `notes`: title, body, userId, createdAt.

Each record must include `userId` equal to the authenticated user's Firebase UID. The supplied Firestore rules enforce owner-only reads and writes. Never publish permissive rules such as `allow read, write: if true`.

## Hosting
To deploy with Firebase Hosting, install the Firebase CLI, run `firebase login`, then `firebase init hosting` only if you need to link this folder to a Firebase project. Configure the build directory as `dist` and single-page app rewrites. Once configured, use `npm run build` and `firebase deploy`.

## Currency
IQD and USD balances are calculated separately. The app does not invent exchange rates or combine currencies into a misleading total.

## Privacy
Use a strong password and keep your GitHub repository private if you do not want the source code to be public. Configure Firestore Security Rules before storing real personal information. Email/password authentication does not itself secure database records; the rules do.
