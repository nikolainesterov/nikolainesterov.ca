/* ─── gallery.js ───────────────────────────────────────────
   Photography gallery: data, category rendering, lightbox

   HOW TO ADD PHOTOS
   ─────────────────
   1. Copy your image file into the appropriate folder:
      images/gallery/landscape/  (or portrait, concert, urban, street)

   2. Add an entry to GALLERY_DATA below in the correct category:
      { src: 'images/gallery/landscape/my-photo.jpg',
        title: 'My Photo Title',
        location: 'Place, AB' }

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
      // { src: 'images/gallery/landscape/rockies.jpg', title: 'Canadian Rockies', location: 'Banff, AB' },
      // { src: 'images/gallery/landscape/bow-valley.jpg', title: 'Bow Valley Sunset', location: 'Canmore, AB' },
      { src: 'images/gallery/landscape/Galactic Tides.JPG', title: 'Galactic Tides', location: "Quidi Vidi, St. John's, Newfoundland" },
      { src: 'images/gallery/landscape/Branches of the Infinite.JPG', title: 'Branches of the Infinite', location: "Orford, Quebec" },
      { src: 'images/gallery/landscape/Snow and Starlit Fire.JPG', title: 'Snow and Starlit Fire', location: "Orford, Quebec" },
      { src: 'images/gallery/landscape/Sunset Waves on the Rocks.JPG', title: 'Sunset Waves on the Rocks', location: "Los Arcos, Puerto Vallarta, Mexico" },
      { src: 'images/gallery/landscape/Celestial Harvest.JPG', title: 'Celestial Harvest', location: "Pincher Creek, Alberta" },
      { src: 'images/gallery/landscape/Twilight Whispers.JPG', title: 'Twilight Whispers', location: "Nakusp, British Columbia" },
      { src: 'images/gallery/landscape/Waterton.JPG', title: 'Waterton', location: "Waterton, Alberta" },
      { src: 'images/gallery/landscape/The Tree of Life.JPG', title: 'The Tree of Life', location: "Alberta" },
      { src: 'images/gallery/landscape/_J8A5115.JPG', title: '_J8A5115', location: "Newfoundland" },
      { src: 'images/gallery/landscape/_J8A7547.JPG', title: '_J8A7547', location: "Paradise Valley, Alberta" },
      { src: 'images/gallery/landscape/_J8A7564.JPG', title: '_J8A7564', location: "Paradise Valley, Alberta" },
      { src: 'images/gallery/landscape/Sunset at Quidi Vidi.JPG', title: 'Sunset at Quidi Vidi', location: "Quidi Vidi, St. John's, Newfoundland" },
    ]
  },

  astrophotography: {
    title: 'Astrophotography',
    description: 'Looking upward into deep time — capturing the stillness, motion, and vastness of the universe above.',
    photos: [
      // ADD ASTROPHOGRAPHY PHOTOS HERE
    ]
  },

  portrait: {
    title: 'Portrait',
    description: 'Faces and stories — candid and composed portraits.',
    photos: [
      // ADD PORTRAIT PHOTOS HERE
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
      // ADD URBAN PHOTOS HERE
    ]
  },
};
/* ═══════════════════════════════════════════════════════════
   END OF DATA SECTION
═══════════════════════════════════════════════════════════ */


/* ─── Gallery engine (no need to edit below) ─────────────── */
(function () {
  'use strict';

  var currentPhotos = [];   // flat array of photos in current category
  var currentIndex  = 0;    // lightbox current index

  /* ── Build category nav ─────────────────────────────── */
  function buildNav() {
    var nav   = document.getElementById('photoCatNav');
    var panels = document.getElementById('galleryPanels');
    if (!nav || !panels) return;

    var categories = Object.keys(GALLERY_DATA);
    if (!categories.length) return;

    categories.forEach(function (key, i) {
      var cat   = GALLERY_DATA[key];
      var count = cat.photos.length;

      // Nav button
      var btn = document.createElement('button');
      btn.className  = 'cat-btn' + (i === 0 ? ' active' : '');
      btn.dataset.cat = key;
      btn.innerHTML  = cat.title +
        '<span class="cat-count">' + count + '</span>';
      btn.addEventListener('click', function () {
        document.querySelectorAll('.cat-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        btn.classList.add('active');
        showPanel(key);
      });
      nav.appendChild(btn);

      // Panel
      var panel = document.createElement('div');
      panel.className   = 'gallery-panel' + (i === 0 ? ' active' : '');
      panel.id          = 'panel-' + key;
      panel.innerHTML   = buildPanelHTML(key, cat);
      panels.appendChild(panel);
    });

    // Attach image load events after panels are in DOM
    attachImageLoaders();

    // Show first category
    if (categories[0]) {
      currentPhotos = GALLERY_DATA[categories[0]].photos;
    }
  }

  /* ── Build panel HTML ────────────────────────────────── */
  function buildPanelHTML(key, cat) {
    var intro = '<div class="gallery-panel-intro">' +
      '<h2 class="gallery-panel-title">' + cat.title + '</h2>' +
      '<p class="gallery-panel-desc">' + (cat.description || '') + '</p>' +
      '</div>';

    if (!cat.photos.length) {
      return intro +
        '<div class="gallery-empty">' +
          '<svg viewBox="0 0 48 48"><rect x="6" y="10" width="36" height="28" rx="2" stroke-width="1"/>' +
          '<circle cx="18" cy="22" r="4" stroke-width="1"/><path d="M6 32l9-8 6 6 6-6 9 8" stroke-width="1"/></svg>' +
          '<p>Photos coming soon.</p>' +
        '</div>';
    }

    var items = cat.photos.map(function (photo, idx) {
      return '<div class="masonry-item" data-category="' + key +
        '" data-idx="' + idx + '">' +
        '<img src="' + photo.src + '" alt="' + (photo.title || '') +
        '" loading="lazy" />' +
        '<div class="masonry-overlay">' +
          '<div class="masonry-title">' + (photo.title || '') + '</div>' +
          '<div class="masonry-sub">' + (photo.location || cat.title) + '</div>' +
        '</div>' +
        '<div class="masonry-zoom">' +
          '<svg viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>' +
        '</div>' +
        '</div>';
    }).join('');

    return intro + '<div class="masonry" id="masonry-' + key + '">' + items + '</div>';
  }

  /* ── Switch active panel ─────────────────────────────── */
  function showPanel(key) {
    document.querySelectorAll('.gallery-panel').forEach(function (p) {
      p.classList.remove('active');
    });
    var panel = document.getElementById('panel-' + key);
    if (panel) {
      panel.classList.add('active');
      currentPhotos = GALLERY_DATA[key].photos;
    }
  }

  /* ── Image load handlers ─────────────────────────────── */
  function attachImageLoaders() {
    document.querySelectorAll('.masonry-item img').forEach(function (img) {
      if (img.complete) {
        img.classList.add('loaded');
      } else {
        img.addEventListener('load', function () {
          img.classList.add('loaded');
        });
        img.addEventListener('error', function () {
          // Show placeholder on broken image
          var item = img.closest('.masonry-item');
          if (item) {
            img.style.display = 'none';
            var ph = document.createElement('div');
            ph.className = 'masonry-placeholder';
            ph.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke="#c9a96e">' +
              '<rect x="6" y="10" width="36" height="28" rx="2" stroke-width="0.8"/>' +
              '<circle cx="18" cy="22" r="4" stroke-width="0.8"/>' +
              '<path d="M6 32l9-8 6 6 6-6 9 8" stroke-width="0.8"/></svg>';
            item.insertBefore(ph, item.querySelector('.masonry-overlay'));
          }
        });
      }
    });
  }

  /* ── Click to open lightbox ──────────────────────────── */
  document.addEventListener('click', function (e) {
    var item = e.target.closest('.masonry-item');
    if (!item) return;
    var catKey = item.dataset.category;
    var idx    = parseInt(item.dataset.idx, 10);
    if (catKey && GALLERY_DATA[catKey]) {
      currentPhotos = GALLERY_DATA[catKey].photos;
      openLightbox(idx);
    }
  });

  /* ─────────────────────────────────────────────────────
     LIGHTBOX
  ───────────────────────────────────────────────────── */
  var lb        = document.getElementById('lightbox');
  var lbImg     = document.getElementById('lbImg');
  var lbTitle   = document.getElementById('lbTitle');
  var lbMeta    = document.getElementById('lbMeta');
  var lbCounter = document.getElementById('lbCounter');

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
    // Clear src to stop loading
    setTimeout(function () {
      if (!lb.classList.contains('open') && lbImg) lbImg.src = '';
    }, 350);
  }

  function updateLightbox() {
    var photo = currentPhotos[currentIndex];
    if (!photo || !lbImg) return;

    lbImg.src = '';  // force reload (browser cache handles it)
    lbImg.alt = photo.title || '';
    lbImg.src = photo.src;

    if (lbTitle)   lbTitle.textContent   = photo.title || '';
    if (lbMeta)    lbMeta.textContent    = photo.location || '';
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

  /* ── Wire up lightbox controls ───────────────────────── */
  if (lb) {
    var btnClose = document.getElementById('lbClose');
    var btnPrev  = document.getElementById('lbPrev');
    var btnNext  = document.getElementById('lbNext');

    if (btnClose) btnClose.addEventListener('click', closeLightbox);
    if (btnPrev)  btnPrev.addEventListener('click',  function (e) { e.stopPropagation(); prev(); });
    if (btnNext)  btnNext.addEventListener('click',  function (e) { e.stopPropagation(); next(); });

    lb.addEventListener('click', function (e) {
      if (e.target === lb) closeLightbox();
    });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape')     closeLightbox();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    });

    // Touch swipe support
    var touchStartX = 0;
    lb.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      var dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
    }, { passive: true });
  }

  /* ── Init on DOM ready ───────────────────────────────── */
  function init() {
    buildNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
