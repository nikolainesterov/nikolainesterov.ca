/* ─── calendar.js ──────────────────────────────────────────
   Calendar page: events data and rendering

   HOW TO ADD EVENTS
   ─────────────────
   1. Add a new object to the EVENTS array below.
   2. Create an image and put it in images/events/
   3. Duplicate events/masters-recital.html → rename for your event
   4. Set the 'link' field to your new event page path.
   5. Dates in the past will auto-appear under "Past Events".
──────────────────────────────────────────────────────────── */

var EVENTS = [

  /* ── UPCOMING / FUTURE EVENTS ── */
  {
    title:   "Master's Recital I",
    date:    '2026-04-14',         // YYYY-MM-DD format
    time:    '1:30 PM',
    venue:   'Salle Serge-Garant, Université de Montréal',
    city:    'Montréal, Québéc',
    image:   'images/events/masters-recital-1/cover.jpg',
    link:    'events/masters-recital-1.html',
    upcoming: true                  // set false once event has passed
  },

  /* ── ADD MORE EVENTS BELOW ──
  {
    title:   'Evening Recital',
    date:    '2025-12-07',
    time:    '8:00 PM',
    venue:   'ProArts Society, Calgary',
    city:    'Calgary, AB',
    image:   'images/events/evening-recital/cover.jpg',
    link:    'events/evening-recital.html',
    upcoming: true
  },
  ── */

];

/* ─── Rendering (no need to edit below) ─────────────────── */
(function () {
  'use strict';

  var upcomingGrid = document.getElementById('upcomingGrid');
  var pastGrid     = document.getElementById('pastGrid');
  var tabBtns      = document.querySelectorAll('.cal-tab');
  var tabPanels    = document.querySelectorAll('.cal-panel');

  if (!upcomingGrid && !pastGrid) return;

  var today = new Date(); today.setHours(0,0,0,0);

  var upcoming = EVENTS.filter(function (e) {
    return e.upcoming && new Date(e.date) >= today;
  });
  var past = EVENTS.filter(function (e) {
    return !e.upcoming || new Date(e.date) < today;
  });

  /* Sort */
  upcoming.sort(function (a,b) { return new Date(a.date) - new Date(b.date); });
  past.sort(function (a,b)     { return new Date(b.date) - new Date(a.date); });

  /* Update tab counts */
  tabBtns.forEach(function (btn) {
    var key = btn.dataset.tab;
    if (key === 'upcoming') btn.querySelector('.cal-tab-count').textContent = upcoming.length || '';
    if (key === 'past')     btn.querySelector('.cal-tab-count').textContent = past.length || '';
  });

  /* ── Render a single card ── */
  function renderCard(event) {
    var d   = new Date(event.date + 'T00:00:00');
    var dateStr = d.toLocaleDateString('en-CA', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

    var imgHTML = event.image
      ? '<img src="' + event.image + '" alt="' + event.title + '" loading="lazy" />'
      : '<div class="event-card-img-placeholder">' +
          '<svg width="40" viewBox="0 0 48 48" fill="none" stroke="#c9a96e" stroke-width="0.8">' +
          '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
        '</div>';

    return '<a class="event-card reveal" href="' + (event.link || '#') + '">' +
      '<div class="event-card-img">' + imgHTML + '</div>' +
      '<div class="event-card-body">' +
        '<div class="event-card-date">' + dateStr + '</div>' +
        '<div class="event-card-title">' + event.title + '</div>' +
        '<div class="event-card-venue">' + (event.venue || '') +
          (event.city ? ' — ' + event.city : '') + '</div>' +
        '<div class="event-card-footer">' +
          '<span class="event-card-time">' + (event.time || '') + '</span>' +
          '<span class="event-card-btn">Details</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /* ── Render grids ── */
  function render(grid, list) {
    if (!grid) return;
    if (!list.length) {
      grid.innerHTML = '<div class="events-empty"><p>No events to display.</p></div>';
      return;
    }
    grid.innerHTML = list.map(renderCard).join('');
    if (window.nnReveal) window.nnReveal.refresh();
  }

  render(upcomingGrid, upcoming);
  render(pastGrid,     past);

  /* ── Tab switching ── */
  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabBtns.forEach(function (b) { b.classList.remove('active'); });
      tabPanels.forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var target = document.getElementById('calPanel-' + btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

})();
