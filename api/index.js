'use strict';

// Explicit Vercel serverless function. vercel.json rewrites /api/* here,
// and the Express app (server/local.js) handles the original path.
module.exports = require('../server/local');
