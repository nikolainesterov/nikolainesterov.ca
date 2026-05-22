/* ─── nav.js ───────────────────────────────────────────────
   Navigation: scroll behaviour, mobile drawer, active links
──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const nav       = document.getElementById('nav');
  const hamburger = document.getElementById('hamburger');
  const drawer    = document.getElementById('navDrawer');

  /* ── Scroll class ── */
  function onScroll() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 50);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Mobile drawer ── */
  if (hamburger && drawer) {
    hamburger.addEventListener('click', function () {
      const open = drawer.classList.toggle('open');
      hamburger.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });

    // Close on link click
    drawer.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        drawer.classList.remove('open');
        hamburger.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (drawer.classList.contains('open') &&
          !drawer.contains(e.target) &&
          !hamburger.contains(e.target)) {
        drawer.classList.remove('open');
        hamburger.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  /* ── Active nav link (single-page sections) ── */
  function setActiveNavLinks() {
    const sections = document.querySelectorAll('section[id]');
    if (!sections.length) return;

    const links = document.querySelectorAll('.nav-links a, .nav-drawer a');
    const scrollY = window.scrollY + 120;

    let current = '';
    sections.forEach(function (sec) {
      if (sec.offsetTop <= scrollY) current = sec.id;
    });

    links.forEach(function (a) {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === '#' + current);
    });
  }
  window.addEventListener('scroll', setActiveNavLinks, { passive: true });

  /* ── Highlight current page in nav (multi-page) ── */
  (function highlightCurrentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(function (a) {
      const href = a.getAttribute('href');
      if (!href) return;
      const page = href.split('/').pop();
      if (page === path || (path === '' && page === 'index.html')) {
        a.classList.add('active');
      }
    });
  })();
})();
