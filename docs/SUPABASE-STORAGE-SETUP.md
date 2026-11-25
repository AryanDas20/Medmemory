# Supabase Storage setup (storage only)

MedMemory uses Firebase Authentication + Firestore for identity and all application records. Supabase is **only** used for private file objects. Do not enable Supabase Auth, Database, Edge Functions or Realtime for this app.

## Create the private bucket

1. Open Supabase Dashboard → Storage → New bucket.
2. Name it `medmemory-private`.
3. Keep **Public bucket OFF**.
4. Set a 12 MB file limit and allow only the file types used by the app (JPEG, PNG, WebP, PDF, plain text, audio and MP4).
5. Save.

The Express server can also create the bucket on first upload when the server-side service-role key is configured. Creating it manually is recommended so you can confirm it is private.

## Server credentials (no `.env` file)

Set these only in the server process environment or your hosting provider's server-side secrets panel:

- `SUPABASE_URL` — project URL
- `SUPABASE_SERVICE_ROLE_KEY` — secret service-role key
- `SUPABASE_BUCKET` — optional; defaults to `medmemory-private`
- `MAX_UPLOAD_MB` — optional; defaults to `12`

Never put the service-role key in `public/`, browser JavaScript, HTML, Firebase client configuration, or Git. The API verifies the Firebase ID token and checks ownership/care permissions before upload or download. Downloads are short-lived signed URLs.

## Database schema

There is **no SQL schema** for Supabase. File metadata (owner UID, bucket, object path, content type, size and related record ID) is stored in Firestore. The file bytes are stored in Supabase Storage.
