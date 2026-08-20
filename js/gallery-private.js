/* ─── gallery-private.js ─────────────────────────────────────
   Private client gallery engine.

   Reads ?g={slug} from the URL, fetches:
     /galleries/{slug}/gallery.json
   from the Worker-proxied R2 bucket, then renders:
     - hero (title, date, hero image)
     - justified grid of social-size images (auto dimension detection,
       same algorithm as the public photography gallery)
     - lightbox with per-photo download menu (Social / Original) + favorite
     - "Download All" modal linking directly to pre-built ZIPs
     - Favorites stored in localStorage, filterable via toolbar toggle
     - Expiry check against gallery.json "expires" field
──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  /* ── Config ── */
  var TARGET_ROW_HEIGHT = 280;
  var GAP               = 6;
  var LAST_ROW_MAX      = 0.75;

  /* ── State ── */
  var slug          = null;
  var galleryData   = null;
  var photos        = [];       // enriched photo objects with _w/_h
  var currentIndex  = 0;
  var showFavsOnly  = false;
  var favKey        = null;     // localStorage key, set once slug is known

  /* ════════════════════════════════════════════════════════
     INIT
  ════════════════════════════════════════════════════════ */
  function init() {
    var params = new URLSearchParams(window.location.search);
    slug = params.get('g');

    if (!slug) {
      showState('pgNotFound');
      return;
    }

    favKey = 'nn-gallery-favs-' + slug;

    fetch('/galleries/' + encodeURIComponent(slug) + '/gallery.json', { cache: 'no-store' })
      .then(function (res) {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then(function (data) {
        galleryData = data;

        /* Expiry check */
        if (data.expires) {
          var expiryDate = new Date(data.expires + 'T23:59:59');
          if (new Date() > expiryDate) {
            showState('pgExpired');
            return;
          }
        }

        renderGallery(data);
      })
      .catch(function () {
        showState('pgNotFound');
      });
  }

  function showState(id) {
    ['pgLoading', 'pgNotFound', 'pgExpired'].forEach(function (s) {
      var el = document.getElementById(s);
      if (el) el.style.display = (s === id) ? 'flex' : 'none';
    });
  }

  /* ════════════════════════════════════════════════════════
     RENDER HERO + TOOLBAR + GRID
  ════════════════════════════════════════════════════════ */
  function renderGallery(data) {
    document.getElementById('pgLoading').style.display = 'none';
    document.getElementById('pgYear').textContent = new Date().getFullYear();

    /* Hero */
    document.title = data.title + ' — Private Gallery — Nikolai Nesterov';
    document.getElementById('pgTitle').textContent = data.title;

    if (data.date) {
      var d = new Date(data.date + 'T00:00:00');
      document.getElementById('pgDate').textContent =
        d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    if (data.hero) {
      var heroBg  = document.getElementById('pgHeroBg');
      var heroImg = new Image();
      heroImg.src = '/galleries/' + slug + '/' + data.hero;
      heroImg.alt = data.title;
      heroImg.onload = function () { heroBg.appendChild(heroImg); };
    }

    /* Toolbar */
    document.getElementById('pgToolbar').style.display = 'block';
    document.getElementById('pgDownloadAllBtn').addEventListener('click', openDownloadAllModal);
    document.getElementById('pgFavToggle').addEventListener('click', toggleFavsFilter);
    updateFavCount();

    /* Photos list */
    photos = (data.photos || []).map(function (p, idx) {
      return {
        file: typeof p === 'string' ? p : p.file,
        idx: idx,
        _w: (typeof p === 'object' && p.w) ? p.w : null,
        _h: (typeof p === 'object' && p.h) ? p.h : null
      };
    });

    loadDimensions(photos, function () {
      buildGrid();
    });

    /* Download-all modal content */
    setupDownloadAllModal(data);

    /* Resize handling */
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildGrid, 150);
    });
  }

  /* ════════════════════════════════════════════════════════
     AUTO DIMENSION DETECTION (same technique as public gallery)
  ════════════════════════════════════════════════════════ */
  function loadDimensions(list, callback) {
    var pending = list.filter(function (p) { return !p._w; });
    if (!pending.length) { callback(); return; }

    var loaded = 0;
    function done() { loaded++; if (loaded === pending.length) callback(); }

    pending.forEach(function (p) {
      var probe = new Image();
      probe.onload = function () {
        p._w = probe.naturalWidth  || 3;
        p._h = probe.naturalHeight || 2;
        done();
      };
      probe.onerror = function () { p._w = 3; p._h = 2; done(); };
      probe.src = '/galleries/' + slug + '/social/' + p.file;
    });
  }

  /* ════════════════════════════════════════════════════════
     BUILD JUSTIFIED GRID
  ════════════════════════════════════════════════════════ */
  function buildGrid() {
    var grid = document.getElementById('pgGrid');
    var emptyFavs = document.getElementById('pgEmptyFavs');
    if (!grid) return;

    var list = showFavsOnly ? photos.filter(isFavorite) : photos;

    grid.innerHTML = '';
    emptyFavs.style.display = 'none';

    if (!list.length) {
      if (showFavsOnly) emptyFavs.style.display = 'block';
      return;
    }

    var containerW = grid.offsetWidth || 900;
    var rows = [];
    var rowBuf = [];
    var rowSum = 0;

    list.forEach(function (photo) {
      var ar = (photo._w && photo._h) ? (photo._w / photo._h) : 1.5;
      rowBuf.push({ photo: photo, ar: ar });
      rowSum += ar;
      var idealW = rowSum * TARGET_ROW_HEIGHT + GAP * (rowBuf.length - 1);
      if (idealW >= containerW) {
        rows.push({ items: rowBuf.slice(), sum: rowSum, last: false });
        rowBuf = []; rowSum = 0;
      }
    });
    if (rowBuf.length) rows.push({ items: rowBuf.slice(), sum: rowSum, last: true });

    rows.forEach(function (row) {
      var totalGap = GAP * (row.items.length - 1);
      var rowH;
      if (row.last) {
        rowH = TARGET_ROW_HEIGHT;
        var partialW = row.sum * TARGET_ROW_HEIGHT + totalGap;
        if (partialW >= containerW * LAST_ROW_MAX) rowH = (containerW - totalGap) / row.sum;
      } else {
        rowH = (containerW - totalGap) / row.sum;
      }

      var rowEl = document.createElement('div');
      rowEl.style.cssText = 'display:flex; gap:' + GAP + 'px; margin-bottom:' + GAP + 'px;';

      row.items.forEach(function (item) {
        var imgW = Math.floor(rowH * item.ar);
        var photo = item.photo;

        var wrap = document.createElement('div');
        wrap.className = 'jg-item';
        wrap.dataset.idx = photo.idx;
        wrap.style.cssText =
          'position:relative; overflow:hidden; cursor:zoom-in; flex-shrink:0;' +
          'width:' + imgW + 'px; height:' + Math.floor(rowH) + 'px; background:var(--surface);';

        var img = document.createElement('img');
        img.src = '/galleries/' + slug + '/social/' + photo.file;
        img.alt = photo.file;
        img.loading = 'lazy';
        img.draggable = false;
        img.style.cssText =
          'width:100%; height:100%; object-fit:cover; display:block;' +
          'transition:transform 0.55s cubic-bezier(0.25,0.46,0.45,0.94), filter 0.4s;' +
          '-webkit-user-drag:none; user-select:none; pointer-events:none;';

        /* Hover action icons: favorite + download */
        var actions = document.createElement('div');
        actions.className = 'pg-item-actions';
        actions.innerHTML =
          '<button class="pg-item-btn pg-fav-btn' + (isFavorite(photo) ? ' active' : '') + '" ' +
            'data-file="' + photo.file + '" title="Save to favorites">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
              '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/>' +
            '</svg></button>' +
          '<button class="pg-item-btn pg-grid-download-btn" data-file="' + photo.file + '" title="Download">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
              '<path d="M12 3v13m0 0-4-4m4 4 4-4M4 21h16"/>' +
            '</svg></button>';

        var downloadMenu = document.createElement('div');
        downloadMenu.className = 'pg-grid-download-menu';
        downloadMenu.innerHTML =
          '<button data-type="social" data-file="' + photo.file + '">Social Media</button>' +
          '<button data-type="original" data-file="' + photo.file + '">Original Resolution</button>';

        wrap.appendChild(img);
        wrap.appendChild(actions);
        wrap.appendChild(downloadMenu);
        rowEl.appendChild(wrap);
      });

      grid.appendChild(rowEl);
    });
  }

  /* ════════════════════════════════════════════════════════
     HOVER (delegated)
  ════════════════════════════════════════════════════════ */
  document.addEventListener('mouseover', function (e) {
    var item = e.target.closest('.jg-item');
    if (!item) return;
    var img = item.querySelector('img');
    if (img) { img.style.transform = 'scale(1.04)'; img.style.filter = 'brightness(0.65)'; }
  });
  document.addEventListener('mouseout', function (e) {
    var item = e.target.closest('.jg-item');
    if (!item || item.contains(e.relatedTarget)) return;
    var img = item.querySelector('img');
    if (img) { img.style.transform = 'scale(1)'; img.style.filter = 'brightness(1)'; }
  });

  /* Disable right-click on gallery images */
  document.addEventListener('contextmenu', function (e) {
    if (e.target.closest('.jg-item') || e.target.id === 'lbImg') e.preventDefault();
  });

  /* ════════════════════════════════════════════════════════
     GRID CLICK HANDLING (favorite / download menu / open lightbox)
  ════════════════════════════════════════════════════════ */
  document.addEventListener('click', function (e) {

    /* Favorite toggle */
    var favBtn = e.target.closest('.pg-fav-btn');
    if (favBtn) {
      e.stopPropagation();
      toggleFavorite(favBtn.dataset.file);
      favBtn.classList.toggle('active');
      updateFavCount();
      if (showFavsOnly) buildGrid();
      return;
    }

    /* Grid download icon → open small menu */
    var dlBtn = e.target.closest('.pg-grid-download-btn');
    if (dlBtn) {
      e.stopPropagation();
      var menu = dlBtn.closest('.jg-item').querySelector('.pg-grid-download-menu');
      document.querySelectorAll('.pg-grid-download-menu.open').forEach(function (m) {
        if (m !== menu) m.classList.remove('open');
      });
      menu.classList.toggle('open');
      return;
    }

    /* Grid download menu option */
    var dlOption = e.target.closest('.pg-grid-download-menu button');
    if (dlOption) {
      e.stopPropagation();
      downloadPhoto(dlOption.dataset.file, dlOption.dataset.type);
      dlOption.closest('.pg-grid-download-menu').classList.remove('open');
      return;
    }

    /* Click elsewhere closes any open grid menu */
    if (!e.target.closest('.pg-grid-download-menu')) {
      document.querySelectorAll('.pg-grid-download-menu.open').forEach(function (m) {
        m.classList.remove('open');
      });
    }

    /* Open lightbox */
    var item = e.target.closest('.jg-item');
    if (item) {
      openLightbox(parseInt(item.dataset.idx, 10));
    }
  });

  /* ════════════════════════════════════════════════════════
     FAVORITES (localStorage)
  ════════════════════════════════════════════════════════ */
  function getFavs() {
    try {
      return JSON.parse(localStorage.getItem(favKey) || '[]');
    } catch (e) { return []; }
  }
  function setFavs(list) {
    try { localStorage.setItem(favKey, JSON.stringify(list)); } catch (e) {}
  }
  function isFavorite(photo) {
    return getFavs().indexOf(photo.file) !== -1;
  }
  function toggleFavorite(file) {
    var favs = getFavs();
    var i = favs.indexOf(file);
    if (i === -1) favs.push(file); else favs.splice(i, 1);
    setFavs(favs);
  }
  function updateFavCount() {
    var count = getFavs().length;
    var el = document.getElementById('pgFavCount');
    if (el) el.textContent = count ? count : '';
  }
  function toggleFavsFilter() {
    showFavsOnly = !showFavsOnly;
    var btn = document.getElementById('pgFavToggle');
    btn.classList.toggle('active', showFavsOnly);
    btn.setAttribute('aria-pressed', showFavsOnly);
    buildGrid();
  }

  /* ════════════════════════════════════════════════════════
     DOWNLOAD (individual photo)
  ════════════════════════════════════════════════════════ */
  function downloadPhoto(file, type) {
    var folder = (type === 'original') ? 'original' : 'social';
    var url = '/galleries/' + slug + '/' + folder + '/' + file + '?download=1';
    var a = document.createElement('a');
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /* ════════════════════════════════════════════════════════
     DOWNLOAD ALL MODAL
  ════════════════════════════════════════════════════════ */
  function setupDownloadAllModal(data) {
    var socialLink = document.getElementById('pgModalSocial');
    var originalLink = document.getElementById('pgModalOriginal');

    socialLink.href = '/galleries/' + slug + '/downloads/social-all.zip';
    originalLink.href = '/galleries/' + slug + '/downloads/original-all.zip';

    var counts = data.counts || {};
    var sizes  = data.sizes  || {};

    document.getElementById('pgModalSocialMeta').textContent =
      (counts.social || photos.length) + ' photos · ' + (sizes.socialZip || '—');
    document.getElementById('pgModalOriginalMeta').textContent =
      (counts.original || photos.length) + ' photos · ' + (sizes.originalZip || '—');
  }

  function openDownloadAllModal() {
    document.getElementById('pgModalOverlay').classList.add('open');
  }
  function closeDownloadAllModal() {
    document.getElementById('pgModalOverlay').classList.remove('open');
  }
  document.getElementById('pgModalClose').addEventListener('click', closeDownloadAllModal);
  document.getElementById('pgModalOverlay').addEventListener('click', function (e) {
    if (e.target.id === 'pgModalOverlay') closeDownloadAllModal();
  });

  /* ════════════════════════════════════════════════════════
     LIGHTBOX
  ════════════════════════════════════════════════════════ */
  var lb          = document.getElementById('lightbox');
  var lbImg       = document.getElementById('lbImg');
  var lbTitle     = document.getElementById('lbTitle');
  var lbCounter   = document.getElementById('lbCounter');
  var lbFavBtn    = document.getElementById('pgLbFav');
  var lbDlBtn     = document.getElementById('pgLbDownload');
  var lbDlMenu    = document.getElementById('pgLbDownloadMenu');

  function activeList() {
    return showFavsOnly ? photos.filter(isFavorite) : photos;
  }

  function openLightbox(photoIdx) {
    var list = activeList();
    var pos = list.findIndex(function (p) { return p.idx === photoIdx; });
    currentIndex = pos === -1 ? 0 : pos;
    updateLightbox();
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    lbDlMenu.classList.remove('open');
    setTimeout(function () { if (!lb.classList.contains('open')) lbImg.src = ''; }, 350);
  }
  function updateLightbox() {
    var list = activeList();
    var photo = list[currentIndex];
    if (!photo) return;

    lbImg.src = '';
    lbImg.alt = photo.file;
    lbImg.src = '/galleries/' + slug + '/social/' + photo.file;

    lbTitle.textContent = photo.file;
    lbCounter.textContent = (currentIndex + 1) + ' / ' + list.length;

    lbFavBtn.classList.toggle('active', isFavorite(photo));
    lbFavBtn.dataset.file = photo.file;
    lbDlBtn.dataset.file = photo.file;
  }
  function prev() {
    var list = activeList();
    currentIndex = (currentIndex - 1 + list.length) % list.length;
    updateLightbox();
  }
  function next() {
    var list = activeList();
    currentIndex = (currentIndex + 1) % list.length;
    updateLightbox();
  }

  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  document.getElementById('lbPrev').addEventListener('click', function (e) { e.stopPropagation(); prev(); });
  document.getElementById('lbNext').addEventListener('click', function (e) { e.stopPropagation(); next(); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });

  lbFavBtn.addEventListener('click', function () {
    toggleFavorite(lbFavBtn.dataset.file);
    lbFavBtn.classList.toggle('active');
    updateFavCount();
  });

  lbDlBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    lbDlMenu.classList.toggle('open');
  });
  lbDlMenu.addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    downloadPhoto(lbDlBtn.dataset.file, btn.dataset.type);
    lbDlMenu.classList.remove('open');
  });

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowLeft')  prev();
    if (e.key === 'ArrowRight') next();
  });

  var touchStartX = 0;
  lb.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); }
  }, { passive: true });

  /* ════════════════════════════════════════════════════════
     GO
  ════════════════════════════════════════════════════════ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
