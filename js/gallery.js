/* ─── gallery.js ───────────────────────────────────────────
   Photography gallery: data, category rendering, lightbox

   HOW TO ADD PHOTOS
   ─────────────────
   1. Copy your image file into the appropriate folder:
      images/gallery/landscape/  (or portrait, concert, urban, street)

   2. Add an entry to GALLERY_DATA below in the correct category:
      { src: 'images/gallery/landscape/my-photo.jpg',
        title: 'My Photo Title',
        caption: 'Place, AB' }

   3. Save the file. Done. The gallery rebuilds automatically.
──────────────────────────────────────────────────────────── */

/* ═══════════════════════════════════════════════════════════
   GALLERY DATA — edit this section to manage your photos
═══════════════════════════════════════════════════════════ */
var GALLERY_DATA = {

  landscape: {
    title: 'Landscape',
    description: 'The wilderness of the Canadian west and beyond — mountains, prairies, and open sky.',
    photos: [
      // ADD LANDSCAPE PHOTOS HERE
      // Example:
      // { src: 'images/gallery/landscape/rockies.jpg', title: 'Canadian Rockies', caption: 'Banff, AB' },
      // { src: 'images/gallery/landscape/bow-valley.jpg', title: 'Bow Valley Sunset', caption: 'Canmore, AB' },
      { src: 'images/gallery/landscape/Galactic Tides.JPG', title: 'Galactic Tides', caption: "Quidi Vidi, St. John's, Newfoundland" },
      { src: 'images/gallery/landscape/Silver Cascade.JPG', title: 'Silver Cascade', caption: "Johnston Canyon, Banff" },
      { src: 'images/gallery/landscape/Branches of the Infinite.JPG', title: 'Branches of the Infinite', caption: "Orford, Québéc" },
      { src: 'images/gallery/landscape/Snow and Starlit Fire.JPG', title: 'Snow and Starlit Fire', caption: "Orford, Québéc" },
      { src: 'images/gallery/landscape/Sunset Waves on the Rocks.JPG', title: 'Sunset Waves on the Rocks', caption: "Los Arcos, Puerto Vallarta, Mexico" },
      { src: 'images/gallery/landscape/Celestial Harvest.JPG', title: 'Celestial Harvest', caption: "Pincher Creek, Alberta" },
      { src: 'images/gallery/landscape/Twilight Whispers.JPG', title: 'Twilight Whispers', caption: "Nakusp, British Columbia" },
      { src: 'images/gallery/landscape/Waterton.JPG', title: 'Waterton', caption: "Waterton, Alberta" },
      { src: 'images/gallery/landscape/The Tree of Life.JPG', title: 'The Tree of Life', caption: "Alberta" },
      { src: 'images/gallery/landscape/_J8A5115.JPG', title: '_J8A5115', caption: "Newfoundland" },
      { src: 'images/gallery/landscape/_J8A7547.JPG', title: 'Giant Steps Waterfall', caption: "Paradise Valley, Alberta" },
      { src: 'images/gallery/landscape/The Vein of Fire.JPG', title: 'The Vein of Fire', caption: "Johnston Canyon, Banff" },
      { src: 'images/gallery/landscape/_J8A7564.JPG', title: '_J8A7564', caption: "Paradise Valley, Alberta" },
      { src: 'images/gallery/landscape/Sunset at Quidi Vidi.JPG', title: 'Sunset at Quidi Vidi', caption: "Quidi Vidi, St. John's, Newfoundland" },
      { src: 'images/gallery/landscape/_J8A0032.JPG', title: '_J8A0032', caption: "Mont Mégantic, Québéc" },
      { src: 'images/gallery/landscape/_J8A9771.JPG', title: '_J8A9771', caption: ""},
      { src: 'images/gallery/landscape/Grotto Mountain.JPG', title: 'Grotto Mountain', caption: "Cammore" },
      { src: 'images/gallery/landscape/Peyto Lake.JPG', title: 'Peyto Lake', caption: "Cammore" },
      { src: 'images/gallery/landscape/_J8A5283.JPG', title: '_J8A5283', caption: "St. Vincent's Beach, Newfoundland" },




    ]
  },

  astrophotography: {
    title: 'Astro',
    description: 'Looking upward into deep time — capturing the stillness, motion, and vastness of the universe above.',
    photos: [
      { src: 'images/gallery/astro/Our Moon.JPG', title: "Our Moon", caption: "Space"},
      { src: 'images/gallery/astro/The Orion Nebula.JPG', title: "The Orion Nebula (M42)", caption: "Deep Space"},
    ]
  },

  wildlife: {
    title: 'Wildlife',
    description: 'Life in its untamed rhythm — quiet encounters, instinct, and the presence of animals in the wild.',
    photos: [
      { src: "images/gallery/wildlife/Stellar's Jay.JPG", title: "Stellar's Jay", caption: "Lake Louise, Alberta"},
      { src: 'images/gallery/wildlife/Stout.JPG', title: "Eurasian Ermine (Stoat)", caption: "Alberta"},
      { src: 'images/gallery/wildlife/Northern Flicker.JPG', title: "Northern Flicker", caption: "Alberta"},

    ]
  },

  portrait: {
    title: 'Portrait',
    description: 'Faces and stories — candid and composed portraits.',
    photos: [
      { src: 'images/gallery/portrait/My Grandmother.jpg', title: 'My Grandmother', caption: "Margarita Nikolaevna Beliaeva" },

    ]
  },

  closeup: {
    title: 'Close-up',
    description: 'Details often overlooked — texture, form, and small moments seen at intimate range.',
    photos: [
      { src: 'images/gallery/close-up/A Fragile Coexistence.JPG', title: 'A Fragile Coexistence', caption: "Alberta" },

    ]
  },

  concert: {
    title: 'Concert',
    description: 'Music captured in performance — the energy and intimacy of live concerts.',
    photos: [
      // ADD CONCERT PHOTOS HERE
    ]
  },

  urban: {
    title: 'Urban',
    description: 'City geometry, light, and movement.',
    photos: [
      { src: 'images/gallery/urban/_J8A2778.JPG', title: "_J8A2778", caption: "Magog, Québéc"},
    ]
  },
};
/* ═══════════════════════════════════════════════════════════
   END OF DATA SECTION
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   GALLERY ENGINE (Justified Gallery)
═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';
 
  /* ── Layout config ── */
  var TARGET_ROW_HEIGHT = 280;  // ideal row height in px
  var GAP               = 6;    // gap between images in px
  var LAST_ROW_MAX      = 0.75; // justify last row if it fills > 75% width
 
  /* ── State ── */
  var currentPhotos = [];
  var currentIndex  = 0;
 
  /* ════════════════════════════════════════════════════════
     AUTO-DETECT IMAGE DIMENSIONS
     Loads each image once via a hidden Image object,
     caches naturalWidth/naturalHeight on the photo entry,
     then calls the callback when all are ready.
  ════════════════════════════════════════════════════════ */
  function loadDimensions(photos, callback) {
    if (!photos.length) { callback(); return; }
 
    /* Skip photos that already have cached dimensions */
    var pending = photos.filter(function (p) { return !p._w; });
    if (!pending.length) { callback(); return; }
 
    var loaded = 0;
    function done() {
      loaded++;
      if (loaded === pending.length) callback();
    }
 
    pending.forEach(function (photo) {
      var probe = new window.Image();
      probe.onload = function () {
        photo._w = probe.naturalWidth  || 3;  /* fallback avoids /0 */
        photo._h = probe.naturalHeight || 2;
        done();
      };
      probe.onerror = function () {
        photo._w = 3;  /* broken image — use 3:2 fallback ratio */
        photo._h = 2;
        done();
      };
      probe.src = photo.src;
    });
  }
 
  /* ════════════════════════════════════════════════════════
     BUILD NAVIGATION + PANELS
  ════════════════════════════════════════════════════════ */
  function buildNav() {
    var navEl    = document.getElementById('photoCatNav');
    var panelsEl = document.getElementById('galleryPanels');
    if (!navEl || !panelsEl) return;
 
    var keys = Object.keys(GALLERY_DATA);
    if (!keys.length) return;
 
    keys.forEach(function (key, i) {
      var cat   = GALLERY_DATA[key];
      var count = cat.photos.length;
 
      /* Nav button */
      var btn = document.createElement('button');
      btn.className   = 'cat-btn' + (i === 0 ? ' active' : '');
      btn.dataset.cat = key;
      btn.innerHTML   = cat.title +
        '<span class="cat-count">' + (count || '') + '</span>';
      btn.addEventListener('click', function () {
        document.querySelectorAll('.cat-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        showPanel(key);
      });
      navEl.appendChild(btn);
 
      /* Panel shell */
      var panel = document.createElement('div');
      panel.className = 'gallery-panel' + (i === 0 ? ' active' : '');
      panel.id        = 'panel-' + key;
      panel.innerHTML =
        '<div class="gallery-panel-intro">' +
          '<h2 class="gallery-panel-title">' + cat.title + '</h2>' +
          '<p class="gallery-panel-desc">' + (cat.description || '') + '</p>' +
        '</div>' +
        '<div class="justified-grid" id="jgrid-' + key + '">' +
          /* Loading indicator shown while dimensions are being probed */
          '<div class="jg-loading">' +
            '<span></span><span></span><span></span>' +
          '</div>' +
        '</div>';
      panelsEl.appendChild(panel);
 
      /* Probe dimensions then build */
      loadDimensions(cat.photos, function () {
        buildGrid(key, cat.photos);
      });
    });
 
    if (keys[0]) currentPhotos = GALLERY_DATA[keys[0]].photos;
 
    /* Re-layout on window resize */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        keys.forEach(function (k) { buildGrid(k, GALLERY_DATA[k].photos); });
      }, 150);
    });
  }
 
  /* ════════════════════════════════════════════════════════
     BUILD A JUSTIFIED GRID
  ════════════════════════════════════════════════════════ */
  function buildGrid(key, photos) {
    var grid = document.getElementById('jgrid-' + key);
    if (!grid) return;
 
    if (!photos.length) {
      grid.innerHTML =
        '<div class="gallery-empty">' +
          '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1">' +
            '<rect x="6" y="10" width="36" height="28" rx="2"/>' +
            '<circle cx="18" cy="22" r="4"/>' +
            '<path d="M6 32l9-8 6 6 6-6 9 8"/>' +
          '</svg>' +
          '<p>Photos coming soon.</p>' +
        '</div>';
      return;
    }
 
    var containerW = grid.offsetWidth || grid.parentElement.offsetWidth || 900;
 
    /* ── Greedy row packing ── */
    var rows   = [];
    var rowBuf = [];
    var rowSum = 0;
 
    photos.forEach(function (photo, idx) {
      /* Use cached dimensions; fall back to 3:2 if somehow missing */
      var ar = (photo._w && photo._h) ? (photo._w / photo._h) : 1.5;
      rowBuf.push({ photo: photo, ar: ar, idx: idx });
      rowSum += ar;
 
      var idealW = rowSum * TARGET_ROW_HEIGHT + GAP * (rowBuf.length - 1);
      if (idealW >= containerW) {
        rows.push({ items: rowBuf.slice(), sum: rowSum, last: false });
        rowBuf = [];
        rowSum = 0;
      }
    });
    if (rowBuf.length) {
      rows.push({ items: rowBuf.slice(), sum: rowSum, last: true });
    }
 
    /* ── Render rows ── */
    grid.innerHTML = '';
 
    rows.forEach(function (row) {
      var totalGap = GAP * (row.items.length - 1);
      var rowH;
 
      if (row.last) {
        rowH = TARGET_ROW_HEIGHT;
        var partialW = row.sum * TARGET_ROW_HEIGHT + totalGap;
        if (partialW >= containerW * LAST_ROW_MAX) {
          rowH = (containerW - totalGap) / row.sum;
        }
      } else {
        rowH = (containerW - totalGap) / row.sum;
      }
 
      var rowEl = document.createElement('div');
      rowEl.style.cssText =
        'display:flex; gap:' + GAP + 'px; margin-bottom:' + GAP + 'px;';
 
      row.items.forEach(function (item) {
        var imgW = Math.floor(rowH * item.ar);
 
        var wrap = document.createElement('div');
        wrap.className        = 'jg-item';
        wrap.dataset.idx      = item.idx;
        wrap.dataset.category = key;
        wrap.style.cssText =
          'position:relative; overflow:hidden; cursor:zoom-in; flex-shrink:0;' +
          'width:' + imgW + 'px; height:' + Math.floor(rowH) + 'px;' +
          'background:var(--surface);';
 
        var img = document.createElement('img');
        img.src       = item.photo.src;
        img.alt       = item.photo.title || '';
        img.loading   = 'eager';
        img.draggable = false;
        img.style.cssText =
          'width:100%; height:100%; object-fit:cover; display:block;' +
          'transition:transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.4s;' +
          '-webkit-user-drag:none; user-select:none; pointer-events:none;';
 
        img.addEventListener('error', function () {
          wrap.innerHTML =
            '<div style="width:100%;height:100%;display:flex;align-items:center;' +
            'justify-content:center;">' +
              '<svg width="28" viewBox="0 0 48 48" fill="none" stroke="#c9a96e" stroke-width="0.8">' +
                '<rect x="6" y="10" width="36" height="28" rx="2"/>' +
                '<circle cx="18" cy="22" r="4"/><path d="M6 32l9-8 6 6 6-6 9 8"/>' +
              '</svg></div>';
        });
 
        /* Overlay */
        var overlay = document.createElement('div');
        overlay.style.cssText =
          'position:absolute; inset:0; pointer-events:none;' +
          'display:flex; flex-direction:column; justify-content:flex-end; padding:0.9rem;' +
          'background:linear-gradient(0deg,rgba(0,0,0,0.72) 0%,transparent 55%);' +
          'opacity:0; transform:translateY(6px);' +
          'transition:opacity 0.3s, transform 0.3s;';
        overlay.innerHTML =
          '<div class="masonry-title">' + (item.photo.title    || '') + '</div>' +
          '<div class="masonry-sub">'   + (item.photo.caption || '') + '</div>';
 
        /* Zoom icon */
        var zoom = document.createElement('div');
        zoom.style.cssText =
          'position:absolute; top:0.65rem; right:0.65rem; pointer-events:none;' +
          'width:26px; height:26px;' +
          'border:1px solid rgba(255,255,255,0.28);' +
          'display:flex; align-items:center; justify-content:center;' +
          'opacity:0; transition:opacity 0.3s;';
        zoom.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" ' +
          'style="width:11px;">' +
            '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>' +
          '</svg>';
 
        wrap.appendChild(img);
        wrap.appendChild(overlay);
        wrap.appendChild(zoom);
        rowEl.appendChild(wrap);
      });
 
      grid.appendChild(rowEl);
    });
  }
 
  /* ════════════════════════════════════════════════════════
     PANEL SWITCHING
  ════════════════════════════════════════════════════════ */
  function showPanel(key) {
    document.querySelectorAll('.gallery-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    var panel = document.getElementById('panel-' + key);
    if (panel) {
      panel.classList.add('active');
      currentPhotos = GALLERY_DATA[key].photos;
      /* Re-layout in case container was hidden before */
      setTimeout(function () { buildGrid(key, GALLERY_DATA[key].photos); }, 50);
    }
  }
 
  /* ════════════════════════════════════════════════════════
     HOVER (event delegation — no per-element listeners)
  ════════════════════════════════════════════════════════ */
  document.addEventListener('mouseover', function (e) {
    var item = e.target.closest('.jg-item');
    if (!item) return;
    var img = item.querySelector('img');
    var ov  = item.children[1];
    var zm  = item.children[2];
    if (img) { img.style.transform = 'scale(1.04)'; img.style.filter = 'brightness(0.6)'; }
    if (ov)  { ov.style.opacity = '1';  ov.style.transform = 'translateY(0)'; }
    if (zm)  { zm.style.opacity = '1'; }
  });
 
  document.addEventListener('mouseout', function (e) {
    var item = e.target.closest('.jg-item');
    if (!item || item.contains(e.relatedTarget)) return;
    var img = item.querySelector('img');
    var ov  = item.children[1];
    var zm  = item.children[2];
    if (img) { img.style.transform = 'scale(1)'; img.style.filter = 'brightness(1)'; }
    if (ov)  { ov.style.opacity = '0';  ov.style.transform = 'translateY(6px)'; }
    if (zm)  { zm.style.opacity = '0'; }
  });
 
  /* ════════════════════════════════════════════════════════
     DISABLE RIGHT-CLICK SAVE
  ════════════════════════════════════════════════════════ */
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest('.jg-item') || e.target.id === 'lbImg') {
      e.preventDefault();
    }
  });
 
  /* ════════════════════════════════════════════════════════
     LIGHTBOX
  ════════════════════════════════════════════════════════ */
  var lb        = document.getElementById('lightbox');
  var lbImg     = document.getElementById('lbImg');
  var lbTitle   = document.getElementById('lbTitle');
  var lbMeta    = document.getElementById('lbMeta');
  var lbCounter = document.getElementById('lbCounter');
 
  document.addEventListener('click', function (e) {
    var item = e.target.closest('.jg-item');
    if (!item) return;
    var key = item.dataset.category;
    var idx = parseInt(item.dataset.idx, 10);
    if (key && GALLERY_DATA[key]) {
      currentPhotos = GALLERY_DATA[key].photos;
      openLightbox(idx);
    }
  });
 
  function openLightbox(idx) {
    if (!lb || !currentPhotos.length) return;
    currentIndex = idx;
    updateLightbox();
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
 
  function closeLightbox() {
    if (!lb) return;
    lb.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () {
      if (!lb.classList.contains('open') && lbImg) lbImg.src = '';
    }, 350);
  }
 
  function updateLightbox() {
    var photo = currentPhotos[currentIndex];
    if (!photo || !lbImg) return;
    lbImg.src = '';
    lbImg.alt = photo.title || '';
    lbImg.src = photo.src;
    if (lbTitle)   lbTitle.textContent   = photo.title    || '';
    if (lbMeta)    lbMeta.textContent    = photo.caption || '';
    if (lbCounter) lbCounter.textContent =
      (currentIndex + 1) + ' / ' + currentPhotos.length;
  }
 
  function prev() {
    currentIndex = (currentIndex - 1 + currentPhotos.length) % currentPhotos.length;
    updateLightbox();
  }
  function next() {
    currentIndex = (currentIndex + 1) % currentPhotos.length;
    updateLightbox();
  }
 
  if (lb) {
    var btnClose = document.getElementById('lbClose');
    var btnPrev  = document.getElementById('lbPrev');
    var btnNext  = document.getElementById('lbNext');
    if (btnClose) btnClose.addEventListener('click', closeLightbox);
    if (btnPrev)  btnPrev.addEventListener('click',  function (e) { e.stopPropagation(); prev(); });
    if (btnNext)  btnNext.addEventListener('click',  function (e) { e.stopPropagation(); next(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    });
    var touchStartX = 0;
    lb.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
    }, { passive: true });
  }
 
  /* ════════════════════════════════════════════════════════
     LOADING INDICATOR STYLES  (injected once)
  ════════════════════════════════════════════════════════ */
  var style = document.createElement('style');
  style.textContent =
    '.jg-loading{display:flex;align-items:center;justify-content:center;' +
    'gap:6px;padding:4rem 0;}' +
    '.jg-loading span{display:block;width:6px;height:6px;border-radius:50%;' +
    'background:var(--gold-dim);animation:jgPulse 1.2s ease-in-out infinite;}' +
    '.jg-loading span:nth-child(2){animation-delay:0.2s;}' +
    '.jg-loading span:nth-child(3){animation-delay:0.4s;}' +
    '@keyframes jgPulse{0%,100%{opacity:0.2;transform:scale(0.8);}' +
    '50%{opacity:1;transform:scale(1.2);}}' +

    /* Single column on mobile — justified layout becomes a simple vertical stack */
    '@media(max-width:640px){' +
    '.justified-grid{display:flex!important;flex-direction:column!important;gap:6px!important;}' +
    '.justified-grid>div{display:flex!important;flex-direction:column!important;gap:6px!important;}' +
    '.jg-item{width:100%!important;height:auto!important;aspect-ratio:unset!important;}' +
    '.jg-item img{height:auto!important;min-height:200px;object-fit:cover;}' +
    '}';
  document.head.appendChild(style);
 
  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildNav);
  } else {
    buildNav();
  }
 
})();