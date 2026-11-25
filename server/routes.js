'use strict';

const express = require('express');
const multer = require('multer');
const { db, auth, fieldValue } = require('./firebase');
const ai = require('./ai');
const storage = require('./storage');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 12) * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'video/mp4']);
    cb(allowed.has(file.mimetype) ? null : new Error('That file type is not supported.'), allowed.has(file.mimetype));
  }
});

const now = () => new Date().toISOString();
const adminEmails = () => (process.env.ADMIN_EMAILS || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
const safeName = value => String(value || '').trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, 120);
const cleanText = (value, max = 1500) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
const fail = (status, message) => Object.assign(new Error(message), { status });
const toArray = snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

async function verifyAuth(req, _res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) throw fail(401, 'Please sign in to continue.');
    req.identity = await auth().verifyIdToken(token, true);
    req.uid = req.identity.uid;
    req.role = req.identity.role || 'patient';
    next();
  } catch (error) { next(error.status ? error : fail(401, 'Your session has expired. Please sign in again.')); }
}
function requireRole(...roles) {
  return (req, _res, next) => roles.includes(req.role) ? next() : next(fail(403, 'You do not have permission to open this section.'));
}
function idParam(value) {
  const text = String(value || '');
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(text)) throw fail(400, 'Invalid record identifier.');
  return text;
}

async function readSubcollection(uid, name, limit = 100) {
  const snap = await db().collection('profiles').doc(uid).collection(name).orderBy('createdAt', 'desc').limit(limit).get().catch(async () => db().collection('profiles').doc(uid).collection(name).limit(limit).get());
  return toArray(snap);
}
async function buildRecord(uid) {
  const profileSnap = await db().collection('profiles').doc(uid).get();
  const profile = profileSnap.exists ? profileSnap.data() : {};
  const [history, allergies, medications, symptoms, reports, labs] = await Promise.all([
    readSubcollection(uid, 'medicalHistory'), readSubcollection(uid, 'allergies'),
    readSubcollection(uid, 'medications'), readSubcollection(uid, 'symptoms'),
    readSubcollection(uid, 'reports'), readSubcollection(uid, 'labResults')
  ]);
  const trendMap = new Map();
  labs.forEach(lab => {
    const name = lab.test_name || lab.testName || 'Lab test';
    if (!trendMap.has(name)) trendMap.set(name, []);
    trendMap.get(name).push({ date: lab.date || lab.createdAt?.slice?.(0, 10) || '', value: Number(lab.value), unit: lab.unit || '', status: lab.status || 'unknown', normal_range: lab.normal_range || lab.normalRange || '' });
  });
  const trends = [...trendMap.entries()].map(([test, points]) => {
    points.sort((a, b) => a.date.localeCompare(b.date));
    const latest = points.at(-1), previous = points.at(-2);
    return { test, unit: latest.unit, normal_range: latest.normal_range, direction: !previous || latest.value === previous.value ? 'flat' : latest.value > previous.value ? 'up' : 'down', change: previous ? latest.value - previous.value : 0, points, previous, latest };
  });
  const age = profile.age || (profile.dateOfBirth ? Math.max(0, Math.floor((Date.now() - new Date(profile.dateOfBirth).getTime()) / 31557600000)) : null);
  const u = await auth().getUser(uid);
  return {
    user: { id: uid, name: profile.displayName || u.displayName || 'Patient', email: u.email || '' },
    profile: { ...profile, age, gender: profile.gender || profile.sexAtBirth || '', blood_group: profile.blood_group || profile.bloodGroup || '' },
    history: history.map(x => ({ ...x, name: x.name || x.condition || x.title || 'Medical history', date: x.date || x.startDate || '' })),
    allergies: allergies.map(x => ({ ...x, allergen: x.allergen || x.name || '' })),
    medications: medications.map(x => ({ ...x, name: x.name || x.medicine || '' })),
    symptoms, reports, trends
  };
}
async function hasCareAccess(doctorUid, patientUid) {
  const [link, profile] = await Promise.all([
    db().collection('careLinks').doc(`${patientUid}_${doctorUid}`).get(),
    db().collection('profiles').doc(patientUid).get()
  ]);
  return link.exists && link.data().status === 'accepted' && profile.exists && profile.data().shareWithDoctors === true;
}
function mapRole(role) { return ['patient', 'doctor', 'admin'].includes(role) ? role : 'patient'; }

router.get('/config', (_req, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      appId: process.env.FIREBASE_APP_ID || '',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || ''
    },
    agent37: {
      instanceId: process.env.AGENT37_INSTANCE_ID || '',
      instanceUrl: process.env.AGENT37_INSTANCE_URL || (process.env.AGENT37_INSTANCE_ID ? `https://${process.env.AGENT37_INSTANCE_ID}.agent37.app` : ''),
      embedUrl: process.env.AGENT37_EMBED_URL || ''
    },
    uploadLimitMb: Number(process.env.MAX_UPLOAD_MB || 12)
  });
});
router.get('/health', (_req, res) => res.json({ ok: true, firebaseAdminConfigured: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON || !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY), supabaseStorageConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY), ai: ai.aiOn() ? 'gemini' : 'rules-only' }));

router.use(verifyAuth);

router.post('/bootstrap', async (req, res, next) => {
  try {
    const user = await auth().getUser(req.uid);
    const email = (user.email || '').toLowerCase();
    let role = mapRole(req.identity.role);
    if (adminEmails().includes(email) && role !== 'admin') {
      await auth().setCustomUserClaims(req.uid, { ...(user.customClaims || {}), role: 'admin' });
      role = 'admin';
    }
    const ref = db().collection('profiles').doc(req.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      const displayName = safeName(user.displayName || email.split('@')[0] || 'New member');
      const profile = {
        uid: req.uid, email, displayName, username: '', role,
        profileVisibility: 'private', shareWithDoctors: false,
        createdAt: now(), updatedAt: now(), onboardingComplete: false,
        profileCompletion: 0, verifiedEmail: !!user.emailVerified
      };
      await ref.set(profile);
      await db().collection('publicProfiles').doc(req.uid).set({ uid: req.uid, displayName, username: '', role, visible: false, createdAt: now(), updatedAt: now() });
    } else if (snap.data().role !== role) {
      await ref.set({ role, updatedAt: now() }, { merge: true });
    }
    res.json({ role, profile: (await ref.get()).data(), refreshToken: role !== (req.identity.role || 'patient') });
  } catch (error) { next(error); }
});

router.put('/profile', async (req, res, next) => {
  try {
    const allowed = [
      'displayName', 'username', 'bio', 'avatarPath', 'coverPath', 'dateOfBirth', 'age', 'gender', 'sexAtBirth',
      'blood_group', 'bloodGroup', 'height_cm', 'heightCm', 'weight_kg', 'weightKg', 'phone', 'phoneCountryCode',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation', 'city', 'state', 'country',
      'preferredLanguage', 'timezone', 'profileVisibility', 'emailVisibility', 'phoneVisibility', 'shareWithDoctors',
      'allowMessagesFrom', 'showOnlineStatus', 'showLastSeen', 'readReceipts', 'onboardingComplete', 'pronouns',
      'occupation', 'insuranceProvider', 'insurancePolicyLast4', 'primaryPhysician', 'healthcareNotes', 'website', 'avatarUrl', 'coverUrl',
      'socialLinks', 'profileCompletion', 'specialty', 'qualification', 'registrationNumber', 'hospital', 'experienceYears',
      'languages', 'consultationFee', 'doctorBio', 'verifiedEmail'
    ];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    if ('displayName' in patch) patch.displayName = safeName(patch.displayName);
    if ('bio' in patch) patch.bio = cleanText(patch.bio, 500);
    if ('username' in patch) patch.username = cleanText(patch.username, 30).toLowerCase().replace(/[^a-z0-9._]/g, '');
    if ('profileVisibility' in patch && !['private', 'care-team', 'public'].includes(patch.profileVisibility)) throw fail(400, 'Invalid profile visibility option.');
    if ('email' in req.body || 'role' in req.body || 'uid' in req.body || 'createdAt' in req.body) throw fail(400, 'Identity, account role and creation date cannot be changed here.');
    if (patch.username) {
      const matches = await db().collection('publicProfiles').where('username', '==', patch.username).limit(2).get();
      if (matches.docs.some(d => d.id !== req.uid)) throw fail(409, 'That username is already in use. Choose another one.');
    }
    patch.updatedAt = now();
    const ref = db().collection('profiles').doc(req.uid);
    await ref.set(patch, { merge: true });
    const after = (await ref.get()).data();
    const publicPatch = {
      uid: req.uid, displayName: after.displayName || '', username: after.username || '',
      bio: after.bio || '', avatarPath: after.avatarPath || '', role: req.role,
      specialty: after.specialty || '', qualification: after.qualification || '', hospital: after.hospital || '',
      city: after.city || '', country: after.country || '', visible: after.profileVisibility === 'public', updatedAt: now()
    };
    await db().collection('publicProfiles').doc(req.uid).set(publicPatch, { merge: true });
    res.json({ profile: after });
  } catch (error) { next(error); }
});

router.post('/doctor/apply', async (req, res, next) => {
  try {
    if (req.role === 'doctor' || req.role === 'admin') throw fail(400, 'This account already has a staff role.');
    const values = {
      uid: req.uid, fullName: safeName(req.body.fullName), specialty: cleanText(req.body.specialty, 80),
      qualification: cleanText(req.body.qualification, 120), registrationNumber: cleanText(req.body.registrationNumber, 80),
      hospital: cleanText(req.body.hospital, 140), experienceYears: Number(req.body.experienceYears || 0),
      phone: cleanText(req.body.phone, 32), notes: cleanText(req.body.notes, 600), status: 'pending', submittedAt: now()
    };
    if (!values.fullName || !values.specialty || !values.qualification || !values.registrationNumber) throw fail(400, 'Name, specialty, qualification and medical registration number are required.');
    await db().collection('doctorApplications').doc(req.uid).set(values, { merge: true });
    res.json({ ok: true, status: 'pending' });
  } catch (error) { next(error); }
});

router.get('/admin/doctor-applications', requireRole('admin'), async (_req, res, next) => {
  try { const snap = await db().collection('doctorApplications').where('status', '==', 'pending').orderBy('submittedAt', 'desc').get(); res.json(toArray(snap)); }
  catch (error) { next(error); }
});
router.post('/admin/doctors/:uid/approve', requireRole('admin'), async (req, res, next) => {
  try {
    const targetUid = idParam(req.params.uid);
    const appRef = db().collection('doctorApplications').doc(targetUid);
    const appSnap = await appRef.get();
    if (!appSnap.exists || appSnap.data().status !== 'pending') throw fail(404, 'No pending doctor application was found.');
    const existing = await auth().getUser(targetUid);
    const existingProfile = await db().collection('profiles').doc(targetUid).get();
    await auth().setCustomUserClaims(targetUid, { ...(existing.customClaims || {}), role: 'doctor' });
    const a = appSnap.data();
    await db().collection('profiles').doc(targetUid).set({ role: 'doctor', displayName: a.fullName || existing.displayName || 'Doctor', specialty: a.specialty, qualification: a.qualification, registrationNumber: a.registrationNumber, hospital: a.hospital, experienceYears: a.experienceYears, phone: a.phone, doctorBio: a.notes, updatedAt: now() }, { merge: true });
    await db().collection('publicProfiles').doc(targetUid).set({ uid: targetUid, displayName: a.fullName || existing.displayName || 'Doctor', role: 'doctor', specialty: a.specialty, qualification: a.qualification, hospital: a.hospital, visible: existingProfile.exists && existingProfile.data().profileVisibility === 'public', updatedAt: now() }, { merge: true });
    await appRef.set({ status: 'approved', reviewedAt: now(), reviewedBy: req.uid }, { merge: true });
    res.json({ ok: true, role: 'doctor', reauthenticationRequired: true });
  } catch (error) { next(error); }
});
router.post('/admin/doctors/:uid/reject', requireRole('admin'), async (req, res, next) => {
  try {
    const targetUid = idParam(req.params.uid);
    await db().collection('doctorApplications').doc(targetUid).set({ status: 'rejected', reviewNote: cleanText(req.body.note, 400), reviewedAt: now(), reviewedBy: req.uid }, { merge: true });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/ai/chat', requireRole('patient'), async (req, res, next) => {
  try {
    const message = cleanText(req.body.message, 1800);
    if (!message) throw fail(400, 'Please enter a question.');
    const record = await buildRecord(req.uid);
    const history = await readSubcollection(req.uid, 'aiChats', 12);
    const result = await ai.chat(message, record, history.map(x => ({ role: x.role, content: x.content })));
    const ref = db().collection('profiles').doc(req.uid).collection('aiChats');
    const batch = db().batch();
    batch.set(ref.doc(), { role: 'user', content: message, createdAt: now() });
    batch.set(ref.doc(), { role: 'assistant', content: result.content, meta: result.meta, createdAt: now() });
    await batch.commit();
    res.json(result);
  } catch (error) { next(error); }
});
router.post('/ai/medicine-check', requireRole('patient'), async (req, res, next) => {
  try {
    const medicine = cleanText(req.body.medicine, 140);
    if (!medicine) throw fail(400, 'Enter a medicine name to check.');
    res.json(ai.medicineCheck(medicine, await buildRecord(req.uid)));
  } catch (error) { next(error); }
});
router.post('/ai/doctor-brief/:patientUid', requireRole('doctor', 'admin'), async (req, res, next) => {
  try {
    const patientUid = idParam(req.params.patientUid);
    if (req.role !== 'admin' && !(await hasCareAccess(req.uid, patientUid))) throw fail(403, 'This patient has not shared their medical record with you.');
    res.json(await ai.brief(await buildRecord(patientUid), cleanText(req.body.reason, 300)));
  } catch (error) { next(error); }
});
router.post('/ai/consultation-summary/:patientUid', requireRole('doctor', 'admin'), async (req, res, next) => {
  try {
    const patientUid = idParam(req.params.patientUid);
    if (req.role !== 'admin' && !(await hasCareAccess(req.uid, patientUid))) throw fail(403, 'This patient has not shared their medical record with you.');
    const notes = cleanText(req.body.notes, 6000);
    if (!notes) throw fail(400, 'Add consultation notes before generating a summary.');
    const result = await ai.consultSummary({ notes, diagnosis: cleanText(req.body.diagnosis, 1000), prescription: cleanText(req.body.prescription, 2000), follow_up_date: req.body.followUpDate || null, reason: cleanText(req.body.reason, 500) }, [], await buildRecord(patientUid));
    res.json(result);
  } catch (error) { next(error); }
});

router.post('/reports/read', requireRole('patient'), upload.single('file'), async (req, res, next) => {
  try {
    const reportText = cleanText(req.body.text, 50000);
    if (!req.file && !reportText) throw fail(400, 'Upload a report or paste its text.');
    let fileRecord = null;
    if (req.file) fileRecord = await saveUpload(req, req.file, 'medical-report');
    let parsed;
    try {
      parsed = await ai.readReport(req.file && ai.aiOn() ? { file: { mime: req.file.mimetype, data: req.file.buffer } } : { text: reportText });
    } catch (error) {
      if (req.file && !ai.aiOn() && !reportText) {
        parsed = { title: req.file.originalname, report_type: 'Medical document', summary: 'The file was saved securely. Add GEMINI_API_KEY to enable automatic extraction from uploaded PDFs and images.', key_findings: [], values: [] };
      } else throw error;
    }
    res.json({ ...parsed, file: fileRecord });
  } catch (error) { next(error); }
});

async function saveUpload(req, file, category) {
  const ext = (file.originalname.match(/\.([a-z0-9]{1,8})$/i) || [])[1]?.toLowerCase() || 'dat';
  const objectPath = `${req.uid}/${category}/${Date.now()}-${require('node:crypto').randomBytes(5).toString('hex')}.${ext}`;
  const stored = await storage.uploadPrivate({ path: objectPath, buffer: file.buffer, contentType: file.mimetype });
  const doc = {
    ownerUid: req.uid, path: stored.path, bucket: stored.bucket, category,
    filename: safeName(file.originalname || 'upload'), contentType: file.mimetype,
    size: file.size, createdAt: now()
  };
  const ref = await db().collection('fileRecords').add(doc);
  const url = await storage.signedDownload(stored.path, 300);
  return { id: ref.id, filename: doc.filename, contentType: doc.contentType, size: doc.size, path: doc.path, signedUrl: url, createdAt: doc.createdAt };
}
router.post('/storage/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw fail(400, 'Choose a file to upload.');
    const category = ['avatar', 'cover', 'medical-report', 'attachment', 'voice-note'].includes(req.body.category) ? req.body.category : 'attachment';
    if (['avatar', 'cover'].includes(category) && !['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) throw fail(400, 'Profile and cover images must be JPG, PNG or WebP.');
    const result = await saveUpload(req, req.file, category);
    res.status(201).json(result);
  } catch (error) { next(error); }
});
router.get('/storage/:id/url', async (req, res, next) => {
  try {
    const ref = await db().collection('fileRecords').doc(idParam(req.params.id)).get();
    if (!ref.exists) throw fail(404, 'File not found.');
    const file = ref.data();
    const allowed = file.ownerUid === req.uid || req.role === 'admin' || req.role === 'doctor' && await hasCareAccess(req.uid, file.ownerUid);
    if (!allowed) throw fail(403, 'You do not have permission to view this file.');
    res.json({ url: await storage.signedDownload(file.path, 300), expiresIn: 300 });
  } catch (error) { next(error); }
});

router.post('/notifications', async (req, res, next) => {
  try {
    const type = cleanText(req.body.type, 40);
    const targetUid = idParam(req.body.targetUid);
    const title = cleanText(req.body.title, 100);
    const body = cleanText(req.body.body, 300);
    let authorised = false;
    if (type === 'care-request') {
      const request = await db().collection('careRequests').doc(`${req.uid}_${targetUid}`).get();
      authorised = !!request.exists && request.data().status === 'pending' && request.data().patientUid === req.uid && request.data().doctorUid === targetUid;
    } else if (type === 'care-accepted') {
      const request = await db().collection('careRequests').doc(`${targetUid}_${req.uid}`).get();
      authorised = req.role === 'doctor' && !!request.exists && request.data().status === 'accepted';
    } else if (type === 'appointment') {
      const appointmentId = idParam(req.body.appointmentId);
      const appointment = await db().collection('appointments').doc(appointmentId).get();
      authorised = !!appointment.exists && appointment.data().patientUid === req.uid && appointment.data().doctorUid === targetUid;
    } else if (type === 'appointment-update') {
      const appointmentId = idParam(req.body.appointmentId);
      const appointment = await db().collection('appointments').doc(appointmentId).get();
      authorised = !!appointment.exists && appointment.data().doctorUid === req.uid && appointment.data().patientUid === targetUid && ['booked', 'declined'].includes(appointment.data().status);
    } else if (type === 'follow-up') {
      const consultationId = idParam(req.body.consultationId);
      const consultation = await db().collection('profiles').doc(targetUid).collection('consultations').doc(consultationId).get();
      authorised = req.role === 'doctor' && await hasCareAccess(req.uid, targetUid)
        && consultation.exists && consultation.data().createdBy === req.uid
        && !!consultation.data().followUpDate
        && consultation.data().followUpDate === cleanText(req.body.followUpDate, 20);
    }
    if (!authorised) throw fail(403, 'You cannot create this notification for that account.');
    await db().collection('notifications').doc(targetUid).collection('items').add({
      type, title: title || 'MedMemory update', body, fromUid: req.uid,
      read: false, createdAt: now(), ...(req.body.appointmentId ? { appointmentId: cleanText(req.body.appointmentId, 128) } : {}), ...(type === 'follow-up' ? { followUpDate: cleanText(req.body.followUpDate, 20) } : {})
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.post('/notify', async (req, res, next) => {
  try {
    const conversationId = idParam(req.body.conversationId);
    const conversation = await db().collection('conversations').doc(conversationId).get();
    if (!conversation.exists || !(conversation.data().memberUids || []).includes(req.uid)) throw fail(403, 'You are not a member of this conversation.');
    const memberUids = conversation.data().memberUids || [];
    const targetUid = req.body.targetUid;
    if (!memberUids.includes(targetUid) || targetUid === req.uid) throw fail(400, 'Invalid notification recipient.');
    const sender = await auth().getUser(req.uid);
    await db().collection('notifications').doc(targetUid).collection('items').add({
      type: 'message', title: 'New message', body: `${safeName(sender.displayName || sender.email || 'Someone')} sent you a message.`,
      conversationId, fromUid: req.uid, read: false, createdAt: now()
    });
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/doctor/patients', requireRole('doctor', 'admin'), async (req, res, next) => {
  try {
    if (req.role === 'admin') {
      const snap = await db().collection('profiles').where('role', '==', 'patient').limit(100).get();
      const patients = snap.docs.map(d => ({ uid: d.id, profile: d.data() }));
      return res.json(patients);
    }
    const links = await db().collection('careLinks').where('doctorUid', '==', req.uid).where('status', '==', 'accepted').get();
    const uids = new Set(links.docs.map(d => d.data().patientUid));
    const patients = await Promise.all([...uids].map(async uid => {
      if (!uid) return null;
      const profile = await db().collection('profiles').doc(uid).get();
      if (!profile.exists || profile.data().shareWithDoctors !== true) return null;
      const [history, allergies, meds, reports, consultations, appts] = await Promise.all([
        readSubcollection(uid, 'medicalHistory', 30), readSubcollection(uid, 'allergies', 30),
        readSubcollection(uid, 'medications', 30), readSubcollection(uid, 'reports', 20),
        readSubcollection(uid, 'consultations', 20),
        db().collection('appointments').where('doctorUid', '==', req.uid).where('patientUid', '==', uid).get()
      ]);
      const raw = profile.data();
      const sharedProfile = {
        displayName: raw.displayName || '', dateOfBirth: raw.dateOfBirth || '', gender: raw.gender || '',
        bloodGroup: raw.bloodGroup || raw.blood_group || '', height_cm: raw.height_cm || '', weight_kg: raw.weight_kg || '',
        city: raw.city || '', country: raw.country || '', healthcareNotes: raw.healthcareNotes || '',
        phone: raw.phoneVisibility === 'care-team' ? (raw.phone || '') : ''
      };
      return { uid, profile: sharedProfile, history, allergies, medications: meds, reports, consultations, appointments: toArray(appts) };
    }));
    res.json(patients.filter(Boolean));
  } catch (error) { next(error); }
});

router.post('/account/revoke-sessions', async (req, res, next) => {
  try {
    await auth().revokeRefreshTokens(req.uid);
    res.json({ ok: true, message: 'Other sessions have been revoked.' });
  } catch (error) { next(error); }
});

router.delete('/account/delete', async (req, res, next) => {
  try {
    const uid = req.uid;
    const user = await auth().getUser(uid);
    if (user.customClaims?.role === 'admin') throw fail(400, 'Administrator accounts must be transferred or disabled by another administrator before deletion.');
    // Delete owned private files from Supabase before removing their Firestore metadata.
    const files = await db().collection('fileRecords').where('ownerUid', '==', uid).get();
    for (const file of files.docs) {
      try { await storage.removePrivate(file.data().path); } catch (e) { console.warn('File cleanup needs review:', e.message); }
      await file.ref.delete();
    }
    // Remove the user's messages from conversations and remove their membership.
    const conversations = await db().collection('conversations').where('memberUids', 'array-contains', uid).get();
    for (const conversation of conversations.docs) {
      const messages = await conversation.ref.collection('messages').get();
      for (const message of messages.docs) await message.ref.delete();
      await conversation.ref.delete();
    }
    for (const name of ['profiles', 'publicProfiles', 'userSettings', 'doctorApplications', 'notifications', 'careLinks', 'careRequests']) {
      const ref = db().collection(name).doc(uid);
      await db().recursiveDelete(ref).catch(() => ref.delete());
    }
    for (const name of ['appointments']) {
      const [asPatient, asDoctor] = await Promise.all([db().collection(name).where('patientUid', '==', uid).get(), db().collection(name).where('doctorUid', '==', uid).get()]);
      for (const snap of [asPatient, asDoctor]) for (const d of snap.docs) await d.ref.delete();
    }
    // Remove deterministic care link/request documents involving this user.
    for (const name of ['careLinks', 'careRequests']) {
      const [asPatient, asDoctor] = await Promise.all([
        db().collection(name).where('patientUid', '==', uid).get(),
        db().collection(name).where('doctorUid', '==', uid).get()
      ]);
      for (const snap of [asPatient, asDoctor]) for (const d of snap.docs) await d.ref.delete();
    }
    await auth().deleteUser(uid);
    res.json({ ok: true });
  } catch (error) { next(error); }
});

router.get('/export', async (req, res, next) => {
  try {
    const profile = await db().collection('profiles').doc(req.uid).get();
    const names = ['medicalHistory', 'allergies', 'medications', 'symptoms', 'reports', 'labResults', 'aiChats'];
    const collections = {};
    for (const name of names) collections[name] = await readSubcollection(req.uid, name, 500);
    const [settings, notifications] = await Promise.all([
      db().collection('userSettings').doc(req.uid).get(),
      db().collection('notifications').doc(req.uid).collection('items').limit(300).get()
    ]);
    res.json({ exportedAt: now(), profile: profile.data() || {}, settings: settings.data() || {}, collections, notifications: toArray(notifications) });
  } catch (error) { next(error); }
});

module.exports = { buildRouter: () => router };
