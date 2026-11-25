# MedMemory AI: full project (frontend + AI backend)

Neon green / neon white site plus a complete serverless backend that matches every API call the app makes.

## What is inside
| Path | Purpose |
|---|---|
| `index.html`, `assets/` | Built website (neon theme, Conflict Guard Live on the landing page) |
| `api/index.js` | Vercel serverless entry for all `/api/*` routes |
| `server/routes.js` | Auth (JWT), patient records, reports, appointments, consult chat, doctor dashboard |
| `server/ai.js` | AI engine: Gemini plus a built-in safety layer (red-flag detection, conflict guard, medicine checker, report reader, doctor brief, consult summary) |
| `server/store.js` | Data store, demo seed data, optional PostgreSQL persistence |
| `server/selftest.js` | `npm test`: 29 automated API checks |
| `.env.example` | Environment variables |

## Deploy on Vercel (GitHub)
1. Upload everything in this folder to a GitHub repo (`package.json` must be in the root).
2. Vercel: Add New, Project, import the repo. Framework "Other", no build command.
3. Settings, Environment Variables:
   - `JWT_SECRET`: any long random string (required)
   - `GEMINI_API_KEY`: key from https://aistudio.google.com/apikey (enables the real AI; without it the rule engine answers)
   - `DATABASE_URL`: PostgreSQL URL (Neon / Supabase / Vercel Postgres) so data survives restarts (optional)
4. Deploy, then open `/api/health`. It shows `"ai":"gemini"` and `"db":"postgres"` when configured.

## Run locally
```
npm install
node server/local.js      # http://localhost:3000
npm test
```

## Demo accounts (password `demo123`)
Patients: riya@medmemory.in, aman@medmemory.in. Doctors: priya@medmemory.in, arjun@medmemory.in.

## Notes
- The AI never diagnoses or prescribes. A deterministic safety layer runs on every answer, even when Gemini is on.
- Vercel limits request bodies to about 4.5 MB, so report uploads are capped at 4 MB.
- Without `DATABASE_URL`, data lives in memory and resets when the serverless instance restarts (fine for demos).
