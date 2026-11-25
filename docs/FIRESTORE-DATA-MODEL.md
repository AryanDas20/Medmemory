# Firestore data model overview

Firestore is the only application database. There is no SQL schema. Core collections used by the app include:

- `profiles/{uid}` — account/profile and patient health profile fields
- `careLinks/{patientUid_doctorUid}` — care-sharing relationship and status
- `medicalRecords/{recordId}` — medical history and record metadata
- `reports/{reportId}` — report metadata and Supabase object path
- `appointments/{appointmentId}` — appointment records
- `consultations/{consultationId}` — consultation summaries and follow-up metadata
- `conversations/{conversationId}` and message subcollections — authorized conversation data
- `notifications/{notificationId}` — user notification records

Exact fields and access constraints are enforced by `firestore.rules`, `firestore.indexes.json`, and the Express API. Supabase stores only the file object; Firestore stores the reference and metadata.
