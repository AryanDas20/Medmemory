# MedMemory AI — Vanilla JavaScript + Firebase + Supabase Storage

MedMemory AI is a patient-health organiser and clinician collaboration workspace. This version uses **HTML, CSS, vanilla JavaScript, Node.js and Express**. Firebase handles authentication and application data. Supabase is used only as private file storage. There is no React, Vite, TypeScript, PostgreSQL or Supabase database in this version. **No Supabase SQL schema is needed:** application records live in Firestore; Supabase is a private object-storage bucket only.

## 1. Technology stack

| Area | Technology | Responsibility |
|---|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript modules | Responsive user interface, forms, realtime listeners and animations |
| Backend | Node.js + Express 5 | Authenticated API routes, AI calls, upload checks and privileged operations |
| Authentication | Firebase Authentication | Email/password sign-up, sign-in, verification and password reset |
| Application database | Cloud Firestore | Profiles, medical records, appointments, care connections, messages and notifications |
| File storage | Supabase Storage | Private reports, profile photos, cover photos and chat attachments |
| AI | Gemini API (optional) | Report extraction, health explanations, medicine context and clinician summaries |
| Agent integration | Agent37 personal agent (optional) | Opens the user's own Agent37 instance in a separate tab |

## 2. Run locally on macOS

### Prerequisites

- Node.js 20 or newer
- npm
- A Firebase project
- A Supabase project for file uploads

Check Node and npm:

```bash
node -v
npm -v
```

### Install and start

1. Extract this ZIP.
2. Open Terminal in the extracted `MedMemory AI` folder.
3. Install packages:

```bash
npm install
```

4. Configure server credentials as shell environment variables (or in your hosting provider’s server-side environment settings). This project intentionally has **no `.env` file** and does not load dotenv.
5. Check the source files:

```bash
npm run check
npm test
```

6. Start the Express server:

```bash
npm start
```

7. Open [http://localhost:3000](http://localhost:3000).

To stop the server, use `Ctrl + C` in Terminal.

## Configuration without a `.env` file

This package intentionally does not include `.env`, `.env.example`, or `dotenv`. The server reads configuration from ordinary process environment variables. For local development, set them in the same Terminal session before running `npm start`; on deployment, add them in the host’s server-side Environment Variables/Secrets panel. Example (replace values; do not commit this command or its secrets):

```bash
export FIREBASE_PROJECT_ID="your-firebase-project-id"
export FIREBASE_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/medmemory-service-account.json)"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-private-service-role-secret"
export GEMINI_API_KEY="your-gemini-key"
export AGENT37_INSTANCE_ID="your-agent37-instance-id"
npm start
```

For a multiline service-account JSON, use a secure shell method to set `FIREBASE_SERVICE_ACCOUNT_JSON`; never put private keys in source code, frontend configuration, screenshots, or Git. Public Firebase Web App config values can be set as `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_APP_ID`, and `FIREBASE_MESSAGING_SENDER_ID`. A public Firebase web API key is not an admin credential; enforce access with Firebase Authentication and Firestore rules.

## 3. Firebase setup

1. Create or open a project at [Firebase Console](https://console.firebase.google.com/).
2. Add a **Web App** in Project settings. Copy its `apiKey`, `authDomain`, `projectId`, `appId` and (if shown) `messagingSenderId` into the public Firebase configuration returned by `/api/config`. Set `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` and `FIREBASE_MESSAGING_SENDER_ID` in your server environment (these web-app values are public; security comes from Auth and Firestore rules).
3. Open **Authentication → Sign-in method** and enable **Email/Password**.
4. Create the default **Cloud Firestore** database.
5. In **Project settings → Service accounts**, generate a private key for the Firebase Admin SDK. Keep the downloaded JSON private. Set the complete JSON as `FIREBASE_SERVICE_ACCOUNT_JSON` in your server environment, or set `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` individually. Do not paste the service-account private key into frontend files or commit it.
6. Set `ADMIN_EMAILS` in your server environment to the email address that should receive the first administrator custom claim (comma-separated for multiple addresses). That user must sign in once after the server is configured; the server assigns the admin claim during `/api/bootstrap`.
7. Publish the included rules and indexes with the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,firestore:indexes
```

The rules intentionally deny client access to file metadata and privileged role changes. The Express API uses the Firebase Admin SDK for server-side operations.

## 4. Supabase Storage setup

1. Create a Supabase project at [Supabase](https://supabase.com/).
2. Set the project URL as the server-side `SUPABASE_URL` value.
3. In Project settings → API, copy the **service_role** secret to the server-side `SUPABASE_SERVICE_ROLE_KEY` value.
4. Keep that key only in your terminal environment or the hosting provider’s server environment variables. **Never put it in `public/app.js`, HTML, or any `VITE_` variable.**
5. The backend creates a bucket named `medmemory-private` on first upload if it does not exist. It is created as a private bucket with a 12 MB upload limit and a file-type allowlist. Set `SUPABASE_BUCKET` or `MAX_UPLOAD_MB` in the server environment if required.

Downloads are provided through short-lived signed URLs after the backend checks the authenticated user and care permissions.

## 5. Optional Gemini AI setup

Set your Gemini key as server-side `GEMINI_API_KEY` and optionally choose a model with `GEMINI_MODEL` (the default is `gemini-2.5-flash`). The key stays on the Express server.

Without a key, the built-in safety/rule layer still powers basic health chat and medicine-context checks. Pasted report text can use the local parser. Automatic reading of PDF/image report contents requires Gemini. A file can still be securely uploaded without automatic extraction.

AI is not a diagnosis or a prescription. Review all outputs and extracted report values against the original document. Do not use the system for emergency decisions.

## 6. Agent37 setup (optional)

Follow the Hackyard instructions you supplied:

1. Go to [agent37.com/personal](https://agent37.com/personal) — not the API/Cloud Sandbox page.
2. Select **Start free** and create the personal agent. The free personal flow described by Hackyard does not require entering card details.
3. Copy the instance ID from the Agent37 dashboard.
4. Set it as the server-side `AGENT37_INSTANCE_ID` value. The app uses the standard `https://INSTANCE_ID.agent37.app` address unless you provide a dashboard URL in `AGENT37_INSTANCE_URL`.
5. Restart the server. The Agent37 button opens the external agent in a separate tab.

This is a safe launch integration, not a claim that Agent37 has access to MedMemory's Firebase data. **No patient profile, report, conversation or health record is automatically sent to Agent37.** Do not paste identifying health data into another service unless you have assessed and authorised that data sharing. Do not use an API key or card details from the Cloud Sandbox page for this setup.

## 7. Feature guide

### Patient accounts and detailed profiles

- Email/password signup and login, password reset and email verification.
- Detailed personal profile: name, username, date of birth, gender, pronouns, optional sex-at-birth field, contact details, location, language, time zone, occupation and introduction.
- Emergency contact name, relationship and phone number.
- Health context: blood group, height, weight, primary physician, optional insurance provider and last four policy digits, and care preferences.
- Profile image and cover image uploads through private Supabase storage.
- Profile completion score, profile preview, profile link copy and visibility settings.
- Separate profile visibility, email/phone visibility, doctor-sharing, message permissions (including a nobody option), last-seen and read-receipt preferences. The message permission is enforced when creating a conversation and sending messages.
- Clinician profile fields for specialty, qualification, registration number, hospital and experience. Clinician access requires administrator review.

### Health record library

- Medical history: conditions, procedures, injuries, dates and notes.
- Allergies: allergen, reaction and severity.
- Medication list: name, dosage, frequency, dates and prescriber.
- Symptom log: symptom, date, severity, possible triggers and notes.
- Report and lab-result library.
- The profile includes emergency-contact details and privacy controls so essential information can be kept current.

### Reports and trends

- Upload PDF/image files to private Supabase Storage.
- Paste report text for local extraction when Gemini is not configured.
- Optional Gemini extraction of values, reference ranges and plain-language findings.
- Store extracted numeric results in Firestore to support a dated trend history.
- Short-lived signed download links; private files are not made public.

### Patient AI health guide

- Health questions can use the current patient's saved conditions, allergies, medications, symptoms and lab trends.
- Safety layer checks recorded allergies and selected medicine/condition conflicts.
- Injury-aware general advice can warn against activities that conflict with stored injury history.
- Red-flag symptom detection directs users to urgent help rather than normal chat guidance.
- Medicine-context check explains when an item needs a pharmacist/doctor review.

### Clinician workspace

- Clinician account application with specialty, qualification and registration details.
- Administrator review and server-assigned Firebase custom role claims.
- Patient directory only shows patients with an accepted care link and health sharing enabled.
- Patient overview with history, allergies, medications, reports and appointments.
- AI pre-visit brief to organise patient history.
- Consultation summary draft from clinician notes, diagnosis, plan and follow-up date.
- Follow-up watch on the clinician dashboard, with an in-app notification to the patient when a follow-up date is recorded. Timed reminders on the follow-up date are not yet scheduled.
- Clinician must review AI-generated documentation before using it.

### Care connections and appointments

- Patient sends a connection request to a visible verified clinician.
- Clinician accepts or declines a request.
- Patient can remove an approved connection.
- Health record sharing is separate from basic profile visibility.
- Patient requests an appointment with date, time, visit type and reason.
- Clinician can confirm or decline appointment requests.

### Realtime messaging

- Private one-to-one conversations for members of an accepted care connection.
- Firestore realtime message listener, message timestamps and unread/read indicators.
- Edit/delete own messages and react to received messages.
- File attachments stored privately in Supabase.
- Message notifications are written through the authenticated Express API.

### Notifications

- In-app notification centre with unread count.
- Message, care request, care acceptance and appointment notifications.
- Mark a single notification as read or mark all as read.
- Notification updates stream through Firestore while the app is open.

### Account settings

- Privacy preferences and profile visibility.
- In-app, email and push-notification preference fields.
- Dark/light appearance, compact layout and reduced-motion preference.
- Password update after reauthentication, email verification and refresh-token revocation.
- JSON data export and account deletion flow.
- Account deletion removes the account and its application data; administrators cannot delete their own account through this flow.

## 8. Security design

- Firebase ID tokens are verified by Express using `verifyIdToken(..., true)`.
- Role claims are read from verified tokens, not trusted from request JSON.
- Doctor roles are granted only by the admin API after reviewing the clinician application.
- Firestore rules restrict health record access to the owner, administrator or an approved clinician when `shareWithDoctors` is enabled.
- Direct conversations require an accepted care connection.
- Supabase Storage is private; the browser never receives the service-role secret.
- Upload type, size and profile-image category are checked by the API.
- API routes use rate limiting and Helmet security headers.
- No end-to-end encryption claim is made. Data is protected by provider security, server checks and Firestore rules, but the application does not implement client-side end-to-end message encryption.

## 9. Important configuration and current limitations

This ZIP is a working application foundation, not a certified electronic health record or a substitute for regulatory/privacy review. Before real patient use, you must complete security testing, backup/retention policies, legal review, incident response, and any local healthcare compliance requirements.

The following capabilities are **not represented as complete** in this version:

- Google/Apple OAuth, phone OTP and Firebase multi-factor authentication UI.
- Browser push delivery. The preference field is present, but Firebase Cloud Messaging keys and a service worker still need to be configured.
- Audio/voice messages, video consultations and group chats. Messaging is currently one-to-one within approved care connections.
- Typing indicators and full online-presence synchronization.
- General social following, public follower counts, user blocking and social-media-style recommendations. For a healthcare application, the main relationship is a patient-approved care connection.
- End-to-end encryption and message reporting/moderation workflow.
- Automated verification of clinician registration numbers. Administrators must independently verify credentials before approving applications.
- Clinical decision support validation and medical-device certification.
- Full medical-data retention handling across infrastructure backups and third-party providers after account deletion.

The app removes seeded demo accounts and demo patients. Create your own test patient and clinician account; use a separate admin email in `ADMIN_EMAILS` to review clinician applications.

## 10. Project structure

```text
MedMemory-AI/
├── public/
│   ├── index.html
│   ├── app.css
│   └── app.js
├── server/
│   ├── local.js
│   ├── firebase.js
│   ├── storage.js
│   ├── routes.js
│   └── ai.js
├── tests/
│   └── ai.test.js
├── docs/
│   └── FEATURE-GUIDE.md
├── firestore.rules
├── firestore.indexes.json
├── firebase.json
├── .gitignore
└── package.json
```
