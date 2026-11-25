'use strict';
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { initFirebase } = require('./firebase');
const { buildRouter } = require('./routes');

const app = express();
const port = Number(process.env.PORT || 3000);

app.disable('x-powered-by');
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://www.gstatic.com', 'https://www.googleapis.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://api.fontshare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://api.fontshare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://identitytoolkit.googleapis.com', 'https://securetoken.googleapis.com', 'https://firestore.googleapis.com', 'https://firebase.googleapis.com', 'https://www.googleapis.com', 'https://*.googleapis.com', 'https://generativelanguage.googleapis.com', 'https://*.supabase.co', 'wss://*.firebaseio.com'],
      frameSrc: ["'self'", 'https://*.agent37.app'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  }
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));

try { initFirebase(); }
catch (error) { console.warn('[MedMemory] Firebase Admin will initialize when configured:', error.message); }

app.use('/api', buildRouter());
app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir, { extensions: ['html'], index: 'index.html', maxAge: '1h' }));
app.get(/.*/, (_req, res, next) => res.sendFile(path.join(publicDir, 'index.html'), err => { if (err) next(err); }));

app.use((error, _req, res, _next) => {
  console.error('[MedMemory API]', error.message);
  const status = error.status || (error.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: status >= 500 ? 'The request could not be completed. Check server configuration and logs.' : error.message });
});

if (require.main === module) {
  app.listen(port, () => console.log(`MedMemory AI running at http://localhost:${port}`));
}

module.exports = app;
