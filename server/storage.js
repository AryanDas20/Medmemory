'use strict';

const { createClient } = require('@supabase/supabase-js');
let client;
let bucketReady;

function storageClient() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the server environment.');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

async function ensurePrivateBucket() {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const supabase = storageClient();
    const name = process.env.SUPABASE_BUCKET || 'medmemory-private';
    const { data, error } = await supabase.storage.getBucket(name);
    if (!error && data) return name;
    const created = await supabase.storage.createBucket(name, {
      public: false,
      fileSizeLimit: `${Number(process.env.MAX_UPLOAD_MB || 12)}MB`,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'video/mp4']
    });
    if (created.error && !/already exists/i.test(created.error.message || '')) {
      bucketReady = null;
      throw created.error;
    }
    return name;
  })();
  return bucketReady;
}

async function uploadPrivate({ path, buffer, contentType }) {
  const bucket = await ensurePrivateBucket();
  const { data, error } = await storageClient().storage.from(bucket).upload(path, buffer, {
    contentType, upsert: false, cacheControl: '3600'
  });
  if (error) throw error;
  return { bucket, path: data.path };
}

async function signedDownload(path, expiresIn = 300) {
  const bucket = await ensurePrivateBucket();
  const { data, error } = await storageClient().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

async function removePrivate(path) {
  const bucket = await ensurePrivateBucket();
  const { error } = await storageClient().storage.from(bucket).remove([path]);
  if (error) throw error;
}

module.exports = { ensurePrivateBucket, uploadPrivate, signedDownload, removePrivate };
