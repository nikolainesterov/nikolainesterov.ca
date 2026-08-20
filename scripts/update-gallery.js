#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════
   UPDATE-GALLERY.JS
   Adds/updates photos in an EXISTING gallery — keeps the same
   link (same slug) the client already has.

   USAGE:
     node update-gallery.js

   HOW IT WORKS:
   You give it the existing gallery's slug, and a local folder
   containing ALL the photos that should be in the gallery going
   forward (both the old ones you want to keep AND the new ones
   you're adding — same shape as when you first created it):

     my-shoot/
       hero.jpg
       social/      ← every photo that should be in the gallery
       original/    ← every photo that should be in the gallery

   The script re-uploads everything, rebuilds both ZIPs from
   scratch, and overwrites gallery.json — so the link stays
   identical but the content is fully refreshed.

   TIP: keep your original local shoot folder around after
   creating a gallery (don't delete it) — that way "adding more
   photos" later is just: drop new files into social/ and
   original/, then run this script.
═══════════════════════════════════════════════════════════ */

require('dotenv').config();

const fs        = require('fs');
const path      = require('path');
const archiver  = require('archiver');
const prompts   = require('prompts');
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
   HELPERS  (same as create-gallery.js)
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

  const answers = await prompts([
    {
      type: 'text',
      name: 'sourceFolder',
      message: 'Path to the LOCAL folder containing ALL photos (old + new — this fully replaces the gallery content):',
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

  console.log(`\n📊  Local folder has ${socialFiles.length} social / ${originalFiles.length} original photos.`);
  console.log(`    Previously: ${existing.counts?.social ?? '?'} social / ${existing.counts?.original ?? '?'} original.\n`);

  /* ── Re-upload hero (in case it changed) ── */
  console.log('⬆️   Re-uploading hero image...');
  await uploadFile(heroPath, `${prefix}/${existing.hero}`);

  /* ── Upload all social images (overwrites existing, adds new) ── */
  console.log(`⬆️   Uploading ${socialFiles.length} social images...`);
  for (const file of socialFiles) {
    await uploadFile(path.join(socialDir, file), `${prefix}/social/${file}`);
    process.stdout.write('.');
  }
  console.log(' done');

  /* ── Upload all original images ── */
  console.log(`⬆️   Uploading ${originalFiles.length} original images...`);
  for (const file of originalFiles) {
    await uploadFile(path.join(originalDir, file), `${prefix}/original/${file}`);
    process.stdout.write('.');
  }
  console.log(' done');

  /* ── Rebuild both ZIPs from scratch ── */
  console.log('📦  Rebuilding social ZIP...');
  const socialZipBuffer = await buildZip(socialDir);
  await uploadBuffer(socialZipBuffer, `${prefix}/downloads/social-all.zip`, 'application/zip');
  console.log(`    social-all.zip — ${formatBytes(socialZipBuffer.length)}`);

  console.log('📦  Rebuilding original ZIP...');
  const originalZipBuffer = await buildZip(originalDir);
  await uploadBuffer(originalZipBuffer, `${prefix}/downloads/original-all.zip`, 'application/zip');
  console.log(`    original-all.zip — ${formatBytes(originalZipBuffer.length)}`);

  /* ── Update gallery.json (keep title/date/expires/slug, refresh photos+counts+sizes) ── */
  const updatedJson = {
    ...existing,
    photos: socialFiles.map((file) => ({ file })),
    counts: {
      social: socialFiles.length,
      original: originalFiles.length
    },
    sizes: {
      socialZip: formatBytes(socialZipBuffer.length),
      originalZip: formatBytes(originalZipBuffer.length)
    }
  };

  console.log('📝  Updating gallery.json...');
  await uploadBuffer(
    Buffer.from(JSON.stringify(updatedJson, null, 2)),
    `${prefix}/gallery.json`,
    'application/json'
  );

  console.log('\n✅  Gallery updated successfully — link is unchanged:\n');
  console.log('   https://nikolainesterov.ca/gallery/?g=' + slug + '\n');
}

main().catch((err) => {
  console.error('\n❌  Something went wrong:\n', err);
  process.exit(1);
});
