'use strict';

const admin = require('firebase-admin');

function parseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try { return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON); }
    catch { throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };
  return null;
}

function initFirebase() {
  if (admin.apps.length) return admin.app();
  const serviceAccount = parseServiceAccount();
  if (!serviceAccount) {
    throw new Error("Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY) in your terminal environment or hosting provider server-side environment settings. This project does not use a .env file.");
  }
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.projectId || process.env.FIREBASE_PROJECT_ID
  });
}

function firebaseReady() { return admin.apps.length > 0; }
function db() { initFirebase(); return admin.firestore(); }
function auth() { initFirebase(); return admin.auth(); }
function fieldValue() { initFirebase(); return admin.firestore.FieldValue; }

module.exports = { admin, initFirebase, firebaseReady, db, auth, fieldValue };
