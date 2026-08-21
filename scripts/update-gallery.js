#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   UPDATE-GALLERY.JS
   Updates an EXISTING gallery — keeps the same link (slug).

   Two modes (you'll be asked which one to use):

   ── ADD NEW ONLY (fast) ──
   Compares your local social/ + original/ folders against what's
   already in gallery.json. Any filename already listed is SKIPPED
   (no re-upload, dimensions carried over as-is). Only new files
   are uploaded and measured. Both ZIPs are still rebuilt from your
   full local folder either way (fast, local-only work).
   Assumption: same filename = unchanged content. If you've
   re-edited an existing photo under the same filename, its
   changes will NOT be picked up in this mode — use Full Refresh
   instead.

   ── FULL REFRESH ──
   Re-uploads everything and fully mirrors your local folder —
   including removing photos from the gallery that you've deleted
   locally. Use this whenever you've re-edited existing photos.

   The hero image is always re-uploaded in both modes (small file,
   no meaningful cost).

   USAGE:
     node update-gallery.js
═══════════════════════════════════════════════════════════ */

require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const archiver  = require('archiver');
const prompts   = require('prompts');
const sizeOf    = require('image-size').default || require('image-size');
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');

/* ── Validate environment ── */
const REQUIRED_ENV = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required .env values: ' + missing.join(', '));
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});
const BUCKET = process.env.R2_BUCKET_NAME;

/* ════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════ */

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB'];
  let val = bytes;
  let i = -1;
  do { val /= 1024; i++; } while (val >= 1024 && i < units.length - 1);
  return val.toFixed(val >= 10 ? 0 : 1) + ' ' + units[i];
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.png': 'image/png', '.webp': 'image/webp',
    '.gif': 'image/gif', '.zip': 'application/zip',
    '.json': 'application/json'
  }[ext] || 'application/octet-stream';
}

function getImageDimensions(localPath) {
  try {
    const dims = sizeOf(localPath);
    return { w: dims.width, h: dims.height };
  } catch (err) {
    console.warn(`   ⚠️  Could not read dimensions for ${path.basename(localPath)} — will fall back to browser detection.`);
    return { w: null, h: null };
  }
}

async function uploadFile(localPath, r2Key) {
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: r2Key, Body: body, ContentType: mimeFor(localPath)
  }));
  return body.length;
}

async function uploadBuffer(buffer, r2Key, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET, Key: r2Key, Body: buffer, ContentType: contentType
  }));
  return buffer.length;
}

async function fetchExistingGalleryJson(slug) {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: BUCKET, Key: `galleries/${slug}/gallery.json`
    }));
    const chunks = [];
    for await (const chunk of res.Body) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch (err) {
    return null;
  }
}

function buildZip(folderPath) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.directory(folderPath, false);
    archive.finalize();
  });
}

/* ════════════════════════════════════════════════════════
   MAIN
════════════════════════════════════════════════════════ */

async function main() {
  console.log('\n🔄  Nikolai Nesterov — Update Existing Gallery\n');

  const { slug } = await prompts({
    type: 'text',
    name: 'slug',
    message: 'Existing gallery slug (the part after ?g= in the client link):',
    validate: (val) => val.trim().length ? true : 'Required.'
  });

  if (!slug) { console.log('\nCancelled.\n'); return; }

  console.log('🔍  Looking up existing gallery...');
  const existing = await fetchExistingGalleryJson(slug);

  if (!existing) {
    console.error(`\n❌  No gallery found with slug "${slug}". Check it's correct and try again.\n`);
    return;
  }

  console.log(`✅  Found: "${existing.title}" (${existing.date})\n`);

  const { mode } = await prompts({
    type: 'select',
    name: 'mode',
    message: 'How would you like to update this gallery?',
    choices: [
      {
        title: 'Add new only  (fast — skips unchanged files, just adds new ones)',
        value: 'merge'
      },
      {
        title: 'Full refresh  (re-uploads everything, mirrors local folder exactly — use if you re-edited existing photos)',
        value: 'full'
      }
    ]
  });

  if (!mode) { console.log('\nCancelled.\n'); return; }

  const answers = await prompts([
    {
      type: 'text',
      name: 'sourceFolder',
      message: mode === 'merge'
        ? 'Path to the LOCAL folder (should contain the full set — old + new photos):'
        : 'Path to the LOCAL folder containing ALL photos (this fully replaces the gallery content):',
      validate: (val) => fs.existsSync(val) ? true : 'That folder does not exist.'
    }
  ]);

  if (!answers.sourceFolder) { console.log('\nCancelled.\n'); return; }

  const sourceFolder = path.resolve(answers.sourceFolder);
  const socialDir   = path.join(sourceFolder, 'social');
  const originalDir = path.join(sourceFolder, 'original');
  const heroPath     = path.join(sourceFolder, existing.hero);

  if (!fs.existsSync(socialDir))   { console.error('❌ Missing /social folder.');   process.exit(1); }
  if (!fs.existsSync(originalDir)) { console.error('❌ Missing /original folder.'); process.exit(1); }
  if (!fs.existsSync(heroPath))    { console.error(`❌ Hero image not found: ${existing.hero}`); process.exit(1); }

  const socialFiles = fs.readdirSync(socialDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const originalFiles = fs.readdirSync(originalDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

  if (!socialFiles.length)   { console.error('❌ No images found in /social.');   process.exit(1); }
  if (!originalFiles.length) { console.error('❌ No images found in /original.'); process.exit(1); }

  const prefix = `galleries/${slug}`;

  /* Build a lookup of existing photos' dimensions, keyed by filename */
  const existingDims = {};
  (existing.photos || []).forEach((p) => {
    const file = typeof p === 'string' ? p : p.file;
    if (typeof p === 'object' && p.w && p.h) {
      existingDims[file] = { w: p.w, h: p.h };
    }
  });
  const existingFilenames = new Set(Object.keys(existingDims).length
    ? Object.keys(existingDims)
    : (existing.photos || []).map((p) => (typeof p === 'string' ? p : p.file)));

  /* ── Always re-upload hero ── */
  console.log('⬆️   Re-uploading hero image...');
  await uploadFile(heroPath, `${prefix}/${existing.hero}`);

  const photoDimensions = {};

  if (mode === 'merge') {
    /* ═══ ADD NEW ONLY ═══ */
    const newSocialFiles = socialFiles.filter((f) => !existingFilenames.has(f));
    const skippedCount = socialFiles.length - newSocialFiles.length;

    console.log(`\n📊  ${newSocialFiles.length} new photo(s) to upload, ${skippedCount} unchanged (skipped).\n`);

    /* Carry over dimensions for unchanged files */
    socialFiles.forEach((f) => {
      if (existingDims[f]) photoDimensions[f] = existingDims[f];
    });

    if (newSocialFiles.length) {
      console.log(`⬆️   Uploading ${newSocialFiles.length} new social images (reading dimensions)...`);
      for (const file of newSocialFiles) {
        const localPath = path.join(socialDir, file);
        photoDimensions[file] = getImageDimensions(localPath);
        await uploadFile(localPath, `${prefix}/social/${file}`);
        process.stdout.write('.');
      }
      console.log(' done');

      console.log(`⬆️   Uploading ${newSocialFiles.length} new original images...`);
      for (const file of newSocialFiles) {
        const originalPath = path.join(originalDir, file);
        if (fs.existsSync(originalPath)) {
          await uploadFile(originalPath, `${prefix}/original/${file}`);
          process.stdout.write('.');
        } else {
          console.warn(`\n   ⚠️  No matching original found for "${file}" — skipped in /original.`);
        }
      }
      console.log(' done');
    } else {
      console.log('   Nothing new to upload.');
    }

  } else {
    /* ═══ FULL REFRESH ═══ */
    console.log(`\n⬆️   Uploading ${socialFiles.length} social images (reading dimensions)...`);
    for (const file of socialFiles) {
      const localPath = path.join(socialDir, file);
      photoDimensions[file] = getImageDimensions(localPath);
      await uploadFile(localPath, `${prefix}/social/${file}`);
      process.stdout.write('.');
    }
    console.log(' done');

    console.log(`⬆️   Uploading ${originalFiles.length} original images...`);
    for (const file of originalFiles) {
      await uploadFile(path.join(originalDir, file), `${prefix}/original/${file}`);
      process.stdout.write('.');
    }
    console.log(' done');
  }

  /* ── Rebuild both ZIPs from the local folder (always — cheap, local work) ── */
  console.log('\n📦  Rebuilding social ZIP...');
  const socialZipBuffer = await buildZip(socialDir);
  await uploadBuffer(socialZipBuffer, `${prefix}/downloads/social-all.zip`, 'application/zip');
  console.log(`    social-all.zip — ${formatBytes(socialZipBuffer.length)}`);

  console.log('📦  Rebuilding original ZIP...');
  const originalZipBuffer = await buildZip(originalDir);
  await uploadBuffer(originalZipBuffer, `${prefix}/downloads/original-all.zip`, 'application/zip');
  console.log(`    original-all.zip — ${formatBytes(originalZipBuffer.length)}`);

  /* ── Update gallery.json ── */
  const updatedJson = {
    ...existing,
    photos: socialFiles.map((file) => {
      const dims = photoDimensions[file] || {};
      const entry = { file };
      if (dims.w && dims.h) { entry.w = dims.w; entry.h = dims.h; }
      return entry;
    }),
    counts: {
      social: socialFiles.length,
      original: originalFiles.length
    },
    sizes: {
      socialZip: formatBytes(socialZipBuffer.length),
      originalZip: formatBytes(originalZipBuffer.length)
    }
  };

  console.log('\n📝  Updating gallery.json...');
  await uploadBuffer(
    Buffer.from(JSON.stringify(updatedJson, null, 2)),
    `${prefix}/gallery.json`,
    'application/json'
  );

  console.log(`\n✅  Gallery updated successfully (${mode === 'merge' ? 'add new only' : 'full refresh'}) — link is unchanged:\n`);
  console.log('   https://nikolainesterov.ca/gallery/?g=' + slug + '\n');
}

main().catch((err) => {
  console.error('\n❌  Something went wrong:\n', err);
  process.exit(1);
});
