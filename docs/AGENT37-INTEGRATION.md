# Agent37 Cloud API integration

MedMemory's Agent37 assistant is an **authenticated in-app chat**. The browser sends a Firebase ID token and the message typed by the signed-in user to MedMemory's own `/api/agent37/*` routes. The Express/Vercel backend verifies the token, retrieves that account's server-held Agent37 session ID, and calls the configured Agent37 instance using the server-only Cloud API key.

## Important healthcare privacy boundary

**This integration does not send MedMemory profiles, patient records, medical history, allergies, medications, reports, lab results, appointments, chat attachments, or saved MedMemory conversations.** The backend forwards only the `message` string submitted in the chat box. It does not build a health-record prompt or attach files.

A user can still type sensitive information into the message box. The chat therefore displays a sharing acknowledgement and warns users not to enter names, dates of birth, patient identifiers, or identifiable health details unless their organisation has explicitly approved that data flow.

**The current deployment uses one configured Agent37 instance for all MedMemory accounts.** MedMemory stores a separate 32-character Agent37 session ID per Firebase UID and prevents one browser account from requesting another account's stored session through these API routes. That isolates the chat transcript lookup at the MedMemory API layer; it does **not** prove complete tenant isolation of Agent37's instance-level filesystem, memory, connected accounts, installed tools, or agent configuration. Keep this integration restricted to general, non-identifying assistance. Do not use it for PHI/PII or patient-specific clinical workflows until you have validated tenant isolation (for example, separately provisioned Agent37 profiles/instances with enforceable isolation), obtained the necessary contractual and legal approvals, and completed your organisation's privacy/security review. Agent37's general privacy statements are not a healthcare compliance certification.

Agent37 documents the Responses API as agentic by default: depending on the Agent37 instance/template, it may browse, run code, use a terminal, read/write files, and call connected tools. Configure the instance with least privilege, remove sensitive connected accounts, and do not grant it access to patient repositories or record systems. The backend integration itself does not give it Firebase or MedMemory record access. The assistant is informational only. It must not diagnose, prescribe, decide clinical urgency, or autonomously modify MedMemory records.

## 1. Create Agent37 Cloud credentials

1. Open [Agent37 Cloud API Keys](https://www.agent37.com/dashboard/cloud/api-keys).
2. Create or reveal a Cloud API key. The documented key format starts with `sk_live_`.
3. Copy the **instance ID** from the Agent37 instance dashboard. It must be exactly 10 lowercase letters/digits.
4. Confirm the instance is available and that its Cloud wallet has enough prepaid credit. Agent37 Cloud usage may require a funded wallet.

The documented instance API is `https://{instanceId}.agent37.app/v1/responses`; it uses the same Cloud key through the `X-Agent37-Key` header. The code derives the canonical HTTPS host from the instance ID and rejects a URL that points elsewhere.

## 2. Add server-only environment variables in Vercel

In Vercel → Project → Settings → Environment Variables, add:

| Variable | Value |
|---|---|
| `AGENT37_API_KEY` | Your actual `sk_live_...` secret |
| `AGENT37_INSTANCE_ID` | Your 10-character instance ID |
| `AGENT37_INSTANCE_URL` | `https://YOUR_INSTANCE_ID.agent37.app` |

Set them for the environments you deploy (Production, Preview, and/or Development). Replace the placeholder in the URL with the same instance ID. `AGENT37_INSTANCE_URL` is optional in code when the standard URL is used, but setting it explicitly makes configuration easier to review.

**Never** use `NEXT_PUBLIC_`, `VITE_`, or any browser-exposed variable for the key. Never add the key to `public/app.js`, HTML, Git, screenshots, or a checked-in `.env` file. The public `/api/config` response reports only whether the integration is enabled and the non-secret instance address; it never returns the API key.

Redeploy after setting or changing the environment variables. Vercel's function duration is configured to 300 seconds; the outbound request times out earlier to leave room for a clean JSON error response.

## 3. Routes included in this project

All three routes are mounted under `/api`, require a valid Firebase bearer token, and respond with `Cache-Control: no-store` where conversation content is returned.

| Method and path | Purpose |
|---|---|
| `POST /api/agent37/chat` | Requires `{ message, consentAccepted: true }`; sends the typed message only and returns `{ message, sessionId }` |
| `GET /api/agent37/history` | Loads the current Firebase user's Agent37 transcript |
| `DELETE /api/agent37/session` | Deletes the current conversation and its local session pointer |

The chat endpoint:

- requires the in-app data-sharing acknowledgement (`consentAccepted: true`) and records the acknowledgement version/time with the session pointer;
- verifies the Firebase ID token with Firebase Admin;
- limits a message to 1,500 characters and enforces a cross-instance per-account limit of 12 messages per 60-second window with an atomic Firestore transaction;
- obtains the session ID from the private Firestore document `agent37Sessions/{uid}` (the browser cannot supply a session ID);
- sends only `{ input, stream: false, mode: "chat", session_id? }` to Agent37;
- authenticates upstream with `X-Agent37-Key` from the server environment;
- stores only the account-to-session mapping in Firestore, not the chat transcript;
- does not accept a caller-supplied upstream URL, profile data, record IDs, files, or arbitrary Agent37 payload fields.

The backend reads history from `GET /v1/sessions/{id}` and creates/continues conversations using `POST /v1/responses`. A failed Agent37 turn can be returned in an HTTP 200 response with `status: "failed"`; the backend checks that field rather than relying on HTTP status alone.

Starting a new chat calls Agent37's `DELETE /v1/sessions/{id}` and removes the Firestore session pointer. If the configured instance has changed since that session was created, the app resets its local pointer but reports that the old transcript could not be deleted from the previous instance. Account deletion also attempts this remote transcript deletion; if Agent37 is unavailable, account deletion continues and the API returns `agent37SessionCleanup: false` so the app can surface a cleanup warning. Agent37 documents deletion as best-effort removal from the harness session store (some harnesses archive it rather than physically erase it); it does not erase the Agent37 instance itself, its files, memory, or connected accounts. This is not a substitute for a broader data-retention policy.

## 4. Local development

The project deliberately does not load `.env` files. Export credentials in the current shell session (use your real values, and do not commit shell history or credentials):

```bash
export AGENT37_API_KEY='sk_live_REPLACE_WITH_YOUR_KEY'
export AGENT37_INSTANCE_ID='abcdefgh12'
export AGENT37_INSTANCE_URL='https://abcdefgh12.agent37.app'
npm start
```

The Firebase Admin service account and Firebase web configuration must also be configured as described in the main README. Without Firebase Admin, the authenticated API routes return an authentication error; without Agent37 variables, the assistant opens its setup instructions rather than sending requests.

## 5. Firestore rules and deployment

The project includes deny-all client rules for `agent37Sessions/{uid}` and `agent37RateLimits/{uid}`. The server uses Firebase Admin, which bypasses client Firestore rules. Deploy the updated `firestore.rules` to the Firebase project along with the code. Do not grant browser access to the session-ID collection.

Before production use:

1. Confirm all three server environment variables are set in the intended Vercel environment.
2. Redeploy the Vercel project.
3. Sign in with Firebase and open the Agent37 assistant.
4. Accept the data-sharing acknowledgement, then send a harmless test such as: `Hello. Introduce yourself as the MedMemory general-purpose assistant. Do not claim access to MedMemory records.`
5. Confirm the response appears in the in-app chat and is restored after re-opening the chat.
6. Use **New chat** and confirm the old transcript is removed from the Agent37 session store.
7. Confirm the browser Network panel shows calls only to your own `/api/agent37/*` endpoints and no Agent37 key in frontend assets, requests, or responses.
8. Check `/api/health`; `agent37ChatConfigured` should be `true` after valid credentials are present.

Use `npm run check` and `npm test` before deployment. Apply Firestore rules separately from Vercel deployment.

## Official references

- [Agent37 Agent API — Send a message](https://www.agent37.com/docs/agents-api/chat.md)
- [Agent37 Agent API — Sessions](https://www.agent37.com/docs/agents-api/sessions.md)
- [Vercel Functions — Configure duration](https://vercel.com/docs/functions/configuring-functions/duration)
