/* ─── reveal.js ────────────────────────────────────────────
   Scroll-triggered reveal animation via IntersectionObserver
──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
  );

  // Observe all .reveal elements present now, and any added later
  function observeAll() {
    document.querySelectorAll('.reveal').forEach(function (el) {
      if (!el.classList.contains('visible')) {
        observer.observe(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeAll);
  } else {
    observeAll();
  }

  // Expose for dynamic content (e.g. gallery renders)
  window.nnReveal = { refresh: observeAll };
})();
