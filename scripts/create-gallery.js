#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   CREATE-GALLERY.JS
   Local script for creating private client photo galleries.

   USAGE:
     1. cd scripts
     2. npm install          (only needed once)
     3. cp .env.example .env  and fill in your R2 credentials
     4. node create-gallery.js

   Prepare a folder on your computer shaped like this first:

     my-shoot/
       hero.jpg
       social/
         photo-01.jpg
         photo-02.jpg
         ...
       original/
         photo-01.jpg
         photo-02.jpg
         ...

   (filenames in social/ and original/ should match — same
   photo, two resolutions)

   The script will:
     - Ask you for the source folder path, client/gallery title,
       shoot date, and an optional expiry date
     - Generate a random unguessable slug
     - Upload hero + all social + all original images to R2
     - Build two ZIPs (social-all.zip, original-all.zip) and
       upload them
     - Write and upload gallery.json with all metadata
     - Print the finished client link
═══════════════════════════════════════════════════════════ */

require('dotenv').config();

const fs         = require('fs');
const path       = require('path');
const crypto     = require('crypto');
const os         = require('os');
const archiver   = require('archiver');
const prompts    = require('prompts');
const sizeOf     = require('image-size').default || require('image-size');
const {
  S3Client,
  PutObjectCommand
} = require('@aws-sdk/client-s3');

/* ── Validate environment ── */
const REQUIRED_ENV = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_BUCKET_NAME'];
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n❌ Missing required .env values: ' + missing.join(', '));
  console.error('   Copy .env.example to .env and fill in your R2 credentials.\n');
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

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function randomSuffix(len = 8) {
  return crypto.randomBytes(len).toString('base64url').slice(0, len).toLowerCase();
}

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

async function uploadFile(localPath, r2Key) {
  const body = fs.readFileSync(localPath);
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: body,
    ContentType: mimeFor(localPath)
  }));
  return body.length;
}

async function uploadBuffer(buffer, r2Key, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buffer,
    ContentType: contentType
  }));
  return buffer.length;
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
  console.log('\n📸  Nikolai Nesterov — Private Gallery Creator\n');

  const answers = await prompts([
    {
      type: 'text',
      name: 'sourceFolder',
      message: 'Path to the shoot folder (contains hero.jpg, social/, original/):',
      validate: (val) => fs.existsSync(val) ? true : 'That folder does not exist.'
    },
    {
      type: 'text',
      name: 'title',
      message: 'Gallery / client title (e.g. "John & Jane Smith"):',
      validate: (val) => val.trim().length ? true : 'Required.'
    },
    {
      type: 'text',
      name: 'date',
      message: 'Shoot date (YYYY-MM-DD):',
      validate: (val) => /^\d{4}-\d{2}-\d{2}$/.test(val) ? true : 'Use format YYYY-MM-DD'
    },
    {
      type: 'text',
      name: 'expires',
      message: 'Expiry date, optional — leave blank for no expiry (YYYY-MM-DD):',
      validate: (val) => (!val || /^\d{4}-\d{2}-\d{2}$/.test(val)) ? true : 'Use format YYYY-MM-DD or leave blank'
    },
    {
      type: 'text',
      name: 'heroFile',
      message: 'Hero image filename (must exist in the shoot folder root, e.g. hero.jpg):',
      initial: 'hero.jpg'
    }
  ]);

  if (!answers.sourceFolder) {
    console.log('\nCancelled.\n');
    return;
  }

  const sourceFolder = path.resolve(answers.sourceFolder);
  const socialDir     = path.join(sourceFolder, 'social');
  const originalDir   = path.join(sourceFolder, 'original');
  const heroPath       = path.join(sourceFolder, answers.heroFile);

  /* ── Validate structure ── */
  if (!fs.existsSync(socialDir))   { console.error('❌ Missing /social folder.');   process.exit(1); }
  if (!fs.existsSync(originalDir)) { console.error('❌ Missing /original folder.'); process.exit(1); }
  if (!fs.existsSync(heroPath))    { console.error(`❌ Hero image not found: ${answers.heroFile}`); process.exit(1); }

  const socialFiles = fs.readdirSync(socialDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  const originalFiles = fs.readdirSync(originalDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

  if (!socialFiles.length)   { console.error('❌ No images found in /social.');   process.exit(1); }
  if (!originalFiles.length) { console.error('❌ No images found in /original.'); process.exit(1); }

  /* ── Generate slug ── */
  const slug = `${slugify(answers.title)}-${randomSuffix(8)}`;
  console.log(`\n🔑  Generated slug: ${slug}\n`);

  const prefix = `galleries/${slug}`;

  /* ── Upload hero ── */
  console.log('⬆️   Uploading hero image...');
  await uploadFile(heroPath, `${prefix}/${answers.heroFile}`);

  /* ── Upload social images + read dimensions locally ── */
  console.log(`⬆️   Uploading ${socialFiles.length} social images (reading dimensions)...`);
  const photoDimensions = {};
  for (const file of socialFiles) {
    const localPath = path.join(socialDir, file);
    photoDimensions[file] = getImageDimensions(localPath);
    await uploadFile(localPath, `${prefix}/social/${file}`);
    process.stdout.write('.');
  }
  console.log(' done');

  /* ── Upload original images ── */
  console.log(`⬆️   Uploading ${originalFiles.length} original images...`);
  for (const file of originalFiles) {
    await uploadFile(path.join(originalDir, file), `${prefix}/original/${file}`);
    process.stdout.write('.');
  }
  console.log(' done');

  /* ── Build + upload ZIPs ── */
  console.log('📦  Building social ZIP...');
  const socialZipBuffer = await buildZip(socialDir);
  await uploadBuffer(socialZipBuffer, `${prefix}/downloads/social-all.zip`, 'application/zip');
  console.log(`    social-all.zip — ${formatBytes(socialZipBuffer.length)}`);

  console.log('📦  Building original ZIP (this may take a while for large files)...');
  const originalZipBuffer = await buildZip(originalDir);
  await uploadBuffer(originalZipBuffer, `${prefix}/downloads/original-all.zip`, 'application/zip');
  console.log(`    original-all.zip — ${formatBytes(originalZipBuffer.length)}`);

  /* ── Build gallery.json ── */
  const galleryJson = {
    slug,
    title: answers.title,
    date: answers.date,
    expires: answers.expires || null,
    hero: answers.heroFile,
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

  console.log('📝  Writing gallery.json...');
  await uploadBuffer(
    Buffer.from(JSON.stringify(galleryJson, null, 2)),
    `${prefix}/gallery.json`,
    'application/json'
  );

  /* ── Done ── */
  const link = `https://nikolainesterov.ca/gallery/?g=${slug}`;

  console.log('\n✅  Gallery created successfully!\n');
  console.log('   Client link:');
  console.log('   ' + link + '\n');

  if (answers.expires) {
    console.log(`   ⏰  Expires: ${answers.expires}\n`);
  }
}

main().catch((err) => {
  console.error('\n❌  Something went wrong:\n', err);
  process.exit(1);
});
