# MedMemory AI — Plain-English feature guide

## Patient area

**Dashboard:** A quick overview of your health library, profile completeness and the next actions you may want to take. It is a helpful starting point, not a medical assessment.

**My profile:** A detailed personal identity page. It keeps your contact information, emergency contact, location, optional health essentials and communication preferences together. You can also choose what the public profile shows. Medical records are kept in a separate part of the database and are not automatically made public.

**Health records:** A structured place to record earlier conditions, injuries, allergies, medicines and symptoms. Dates and notes matter: they help you remember what happened and help your doctor understand the timeline.

**Reports and trends:** Save report files privately. When Gemini is configured, the app can extract some lab values and explain the wording in everyday English. Extracted values can be compared over time. Always check the original lab report because automatic reading can misread a number, unit or reference range.

**AI health guide:** Ask general questions using your saved health context. It can highlight an allergy or an injury-related conflict and can suggest questions to take to your doctor. It cannot examine you, confirm a diagnosis or safely prescribe medicine.

**Appointments:** Browse clinician profiles that are set to visible and send a visit request with your preferred time and reason. A clinician can confirm or decline the request.

**Care connections:** A clinician is not automatically allowed to read your records just because you booked an appointment. You send a request, the clinician accepts, and you keep the separate `shareWithDoctors` control enabled to let that clinician read your health history. You can remove the link later.

**Messages:** Private one-to-one chat with a person in your accepted care network. Messages update live while the app is open. You can attach a file, edit or remove your own message, react to a message and see read status. The application does not claim end-to-end encryption.

**Notifications:** A central list of care requests, appointment updates and messages. Mark items read individually or clear the unread state in one action.

## Clinician area

**My patients:** Shows patients who approved the clinician and enabled medical-record sharing. A clinician cannot search for arbitrary private patient records by guessing a user ID.

**Patient overview:** Brings together the profile details and medical information the patient has chosen to share, including conditions, allergies, current medicines, reports, appointments and previous consultation notes. A clinician can open a dedicated real-time chat from an active care connection.

**AI history brief:** Produces a short pre-visit summary from the shared record so the clinician can prepare more quickly. It is a draft; the clinician must review it against the source record.

**Consultation summary:** Turns the clinician's own notes into a structured summary with the visit reason, diagnosis, findings, plan and follow-up. It must be reviewed before being used in a medical record. When a follow-up date is entered, the patient receives an in-app notification and the date appears in the clinician's follow-up watch. The app does not yet send scheduled reminders on the date itself.

## Account and privacy

**Profile visibility** applies to basic profile information. **Health sharing** is a separate switch for health-record access. A public profile does not make health history public.

**Reduced motion** turns down decorative movement for users who prefer a calmer interface. The site also respects the operating system's reduced-motion preference.

**Download data** creates a JSON file for the user's profile, health records, preferences and notifications. **Delete account** is a destructive action and asks for typed confirmation.

## Agent37

The Agent37 button opens the personal agent configured in the server environment. It is kept separate from patient records. MedMemory does not send a patient's private information to the external agent automatically.
