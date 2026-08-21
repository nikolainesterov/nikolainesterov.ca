/* ─── lightbox-zoom.js ────────────────────────────────────────
   Shared pinch-to-zoom / double-tap-zoom / pan module for the
   lightbox, used by BOTH the public photography gallery and the
   private client gallery.

   Mobile/touch only — on desktop this module simply does nothing,
   since it only ever responds to touch events (mouse interaction
   never triggers touchstart/touchmove/touchend).

   USAGE (in gallery.js / gallery-private.js):

     var wrap = document.querySelector('.lb-img-wrap');
     var zoomCtrl = window.NNLightboxZoom
       ? window.NNLightboxZoom.attach(lbImg, wrap)
       : { isZoomed: function(){return false;}, reset: function(){}, onImageChange: function(){} };

     // whenever you change lbImg.src to a new photo:
     zoomCtrl.reset();
     lbImg.onload = function () { zoomCtrl.onImageChange(); };

     // whenever you close the lightbox:
     zoomCtrl.reset();

   Swipe-to-next-photo code elsewhere needs NO changes — this
   module stops event propagation itself whenever a pinch, pan,
   or double-tap is in progress, so the existing swipe listeners
   simply never see those touches.
──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var MIN_SCALE        = 1;
  var MAX_SCALE         = 4;
  var DOUBLE_TAP_SCALE   = 2.5;
  var DOUBLE_TAP_MS      = 300;
  var DOUBLE_TAP_DIST_PX = 40;

  function clampNum(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function attach(imgEl, wrapEl) {

    /* No touch support (desktop) — do nothing, return inert controller */
    var isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isTouchDevice || !imgEl || !wrapEl) {
      return {
        isZoomed: function () { return false; },
        reset: function () {},
        onImageChange: function () {}
      };
    }

    /* ── State ── */
    var scale = 1, tx = 0, ty = 0;
    var baseW = 0, baseH = 0;

    var isPinching = false, isPanning = false;
    var pinchStartDist = 0, pinchStartScale = 1, pinchStartTx = 0, pinchStartTy = 0;
    var pinchMidX = 0, pinchMidY = 0;
    var panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;
    var lastTapTime = 0, lastTapX = 0, lastTapY = 0;

    /* ── Helpers ── */
    function applyTransform(withTransition) {
      imgEl.style.transition = withTransition ? 'transform 0.25s ease' : 'none';
      imgEl.style.transformOrigin = 'center center';
      imgEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }

    function measureBase() {
      /* Called when scale is 1 (no transform distortion) so the
         bounding rect reflects the image's true rendered size. */
      var rect = imgEl.getBoundingClientRect();
      baseW = rect.width;
      baseH = rect.height;
    }

    function clampTranslate(targetScale, targetTx, targetTy) {
      var scaledW = baseW * targetScale;
      var scaledH = baseH * targetScale;
      var wrapRect = wrapEl.getBoundingClientRect();
      var maxX = Math.max(0, (scaledW - wrapRect.width) / 2);
      var maxY = Math.max(0, (scaledH - wrapRect.height) / 2);
      return {
        tx: clampNum(targetTx, -maxX, maxX),
        ty: clampNum(targetTy, -maxY, maxY)
      };
    }

    function distance(t1, t2) {
      return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    }
    function midpoint(t1, t2) {
      return { x: (t1.clientX + t2.clientX) / 2, y: (t1.clientY + t2.clientY) / 2 };
    }

    /* ── Pinch ── */
    function beginPinch(e) {
      isPinching = true;
      var t1 = e.touches[0], t2 = e.touches[1];
      pinchStartDist  = distance(t1, t2);
      pinchStartScale = scale;
      pinchStartTx = tx;
      pinchStartTy = ty;
      var mid = midpoint(t1, t2);
      pinchMidX = mid.x;
      pinchMidY = mid.y;
      applyTransform(false);
    }

    function updatePinch(e) {
      var t1 = e.touches[0], t2 = e.touches[1];
      var dist = distance(t1, t2);
      var ratio = dist / pinchStartDist;
      var newScale = clampNum(pinchStartScale * ratio, MIN_SCALE, MAX_SCALE);
      var scaleFactor = newScale / pinchStartScale;

      var wrapRect = wrapEl.getBoundingClientRect();
      var wrapCenterX = wrapRect.left + wrapRect.width / 2;
      var wrapCenterY = wrapRect.top + wrapRect.height / 2;
      var offsetX = pinchMidX - wrapCenterX;
      var offsetY = pinchMidY - wrapCenterY;

      var newTx = pinchStartTx - offsetX * (scaleFactor - 1);
      var newTy = pinchStartTy - offsetY * (scaleFactor - 1);

      var clamped = clampTranslate(newScale, newTx, newTy);
      scale = newScale; tx = clamped.tx; ty = clamped.ty;
      applyTransform(false);
    }

    function endPinch() {
      isPinching = false;
      if (scale < MIN_SCALE + 0.02) {
        scale = 1; tx = 0; ty = 0;
      }
      applyTransform(true);
    }

    /* ── Pan (single finger, while zoomed in) ── */
    function beginPan(e) {
      isPanning = true;
      var t = e.touches[0];
      panStartX = t.clientX; panStartY = t.clientY;
      panStartTx = tx; panStartTy = ty;
      applyTransform(false);
    }

    function updatePan(e) {
      var t = e.touches[0];
      var dx = t.clientX - panStartX;
      var dy = t.clientY - panStartY;
      var clamped = clampTranslate(scale, panStartTx + dx, panStartTy + dy);
      tx = clamped.tx; ty = clamped.ty;
      applyTransform(false);
    }

    function endPan() {
      isPanning = false;
      applyTransform(true);
    }

    /* ── Double-tap to zoom ── */
    function handleTapEnd(e) {
      var t = e.changedTouches[0];
      var now = Date.now();
      var dx = Math.abs(t.clientX - lastTapX);
      var dy = Math.abs(t.clientY - lastTapY);

      var isDoubleTap = (now - lastTapTime) < DOUBLE_TAP_MS &&
                         dx < DOUBLE_TAP_DIST_PX && dy < DOUBLE_TAP_DIST_PX;

      if (isDoubleTap) {
        if (scale > 1.01) {
          scale = 1; tx = 0; ty = 0;
        } else {
          var wrapRect = wrapEl.getBoundingClientRect();
          var offsetX = t.clientX - (wrapRect.left + wrapRect.width / 2);
          var offsetY = t.clientY - (wrapRect.top + wrapRect.height / 2);
          var newTx = -offsetX * (DOUBLE_TAP_SCALE - 1);
          var newTy = -offsetY * (DOUBLE_TAP_SCALE - 1);
          var clamped = clampTranslate(DOUBLE_TAP_SCALE, newTx, newTy);
          scale = DOUBLE_TAP_SCALE; tx = clamped.tx; ty = clamped.ty;
        }
        applyTransform(true);
        lastTapTime = 0;
        return true; /* handled — caller should stop propagation */
      }

      lastTapTime = now;
      lastTapX = t.clientX;
      lastTapY = t.clientY;
      return false; /* not a double tap — let it bubble (normal swipe/tap) */
    }

    /* ── Touch event wiring ── */
    wrapEl.addEventListener('touchstart', function (e) {
      if (e.touches.length === 2) {
        beginPinch(e);
        e.stopPropagation();
        return;
      }
      if (e.touches.length === 1 && scale > 1.01) {
        beginPan(e);
        e.stopPropagation();
      }
      /* else: single finger, not zoomed — let it bubble for normal swipe */
    }, { passive: true });

    wrapEl.addEventListener('touchmove', function (e) {
      if (isPinching && e.touches.length === 2) {
        updatePinch(e);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (isPanning && e.touches.length === 1) {
        updatePan(e);
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    wrapEl.addEventListener('touchend', function (e) {
      if (isPinching) { endPinch(); e.stopPropagation(); return; }
      if (isPanning)  { endPan();   e.stopPropagation(); return; }

      if (e.touches.length === 0 && e.changedTouches.length === 1) {
        var wasDoubleTap = handleTapEnd(e);
        if (wasDoubleTap) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    }, { passive: false });

    wrapEl.addEventListener('touchcancel', function () {
      isPinching = false;
      isPanning = false;
    });

    /* ── Public controller API ── */
    return {
      isZoomed: function () { return scale > 1.01; },
      reset: function () {
        scale = 1; tx = 0; ty = 0;
        isPinching = false; isPanning = false;
        applyTransform(false);
      },
      onImageChange: function () {
        /* Called after a new photo has loaded into imgEl —
           remeasures its rendered size for correct pan clamping. */
        measureBase();
      }
    };
  }

  window.NNLightboxZoom = { attach: attach };

})();
