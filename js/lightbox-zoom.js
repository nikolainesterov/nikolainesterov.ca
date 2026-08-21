/* ─── lightbox-zoom.js ────────────────────────────────────────
   Shared pinch-to-zoom / double-tap-zoom / pan module for the
   lightbox, used by BOTH the public photography gallery and the
   private client gallery.

   Mobile/touch only — on desktop this module does nothing, since
   it only ever responds to touch events (mouse never triggers
   touchstart/touchmove/touchend).

   USAGE (in gallery.js / gallery-private.js):

     var wrap = document.querySelector('.lb-img-wrap');
     var zoomCtrl = window.NNLightboxZoom
       ? window.NNLightboxZoom.attach(lbImg, wrap, {
           onZoomChange: function (isZoomed) {
             lb.classList.toggle('zoomed-in', isZoomed);
           }
         })
       : { isZoomed: function(){return false;}, reset: function(){}, onImageChange: function(){} };

     // whenever you change lbImg.src to a new photo:
     zoomCtrl.reset();
     lbImg.onload = function () { zoomCtrl.onImageChange(); };  // best practice,
     lbImg.src = photo.src;                                      // set BEFORE src.
     // (the module also self-measures at the start of every gesture,
     //  so it no longer strictly depends on this timing — but setting
     //  onload before src is still good practice and avoids one
     //  unnecessary remeasure)

     // whenever you close the lightbox:
     zoomCtrl.reset();

   Swipe-to-next-photo code elsewhere needs NO changes — this
   module uses a single internal gesture "mode" and stops event
   propagation for the ENTIRE duration of any pinch or pan gesture
   (including every finger-lift event that's part of releasing it),
   so the existing swipe listeners never see those touches at all.
   Swipe only ever sees genuine single-finger, un-zoomed taps/drags.
──────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var MIN_SCALE          = 1;
  var MAX_SCALE           = 4;
  var DOUBLE_TAP_SCALE     = 2.5;
  var DOUBLE_TAP_MS        = 300;
  var DOUBLE_TAP_DIST_PX   = 40;
  var TAP_MOVE_THRESHOLD   = 12; /* px — below this, a gesture counts as a "tap" not a drag/swipe */

  function clampNum(val, min, max) {
    return Math.min(max, Math.max(min, val));
  }

  function attach(imgEl, wrapEl, options) {

    options = options || {};
    var onZoomChange = typeof options.onZoomChange === 'function' ? options.onZoomChange : null;

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

    /* Single unified gesture state machine.
       'idle' | 'pinch' | 'pan' | 'tap-candidate' */
    var mode = 'idle';

    var pinchStartDist = 0, pinchStartScale = 1, pinchStartTx = 0, pinchStartTy = 0;
    var pinchMidX = 0, pinchMidY = 0;

    var panStartX = 0, panStartY = 0, panStartTx = 0, panStartTy = 0;

    var gestureStartX = 0, gestureStartY = 0; /* for tap-candidate move-distance check */

    var lastTapTime = 0, lastTapX = 0, lastTapY = 0;

    /* ── Helpers ── */
    function applyTransform(withTransition) {
      imgEl.style.transition = withTransition ? 'transform 0.25s ease' : 'none';
      imgEl.style.transformOrigin = 'center center';
      imgEl.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
      if (onZoomChange) onZoomChange(scale > 1.01);
    }

    function measureBase() {
      /* Always safe to call — reads current rendered size of the
         image element. Called defensively at the start of every
         gesture so correctness never depends on external onload
         timing. */
      var rect = imgEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        /* Undo current scale so we store the UNSCALED base size */
        baseW = rect.width  / (scale || 1);
        baseH = rect.height / (scale || 1);
      }
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
    function beginPinch(t1, t2) {
      measureBase();
      mode = 'pinch';
      pinchStartDist  = distance(t1, t2);
      pinchStartScale = scale;
      pinchStartTx = tx;
      pinchStartTy = ty;
      var mid = midpoint(t1, t2);
      pinchMidX = mid.x;
      pinchMidY = mid.y;
      applyTransform(false);
    }

    function updatePinch(t1, t2) {
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

    function finalizePinch() {
      if (scale < MIN_SCALE + 0.02) {
        scale = 1; tx = 0; ty = 0;
      }
      applyTransform(true);
    }

    /* ── Pan (single finger, while zoomed in) ── */
    function beginPan(touch) {
      measureBase();
      mode = 'pan';
      panStartX = touch.clientX; panStartY = touch.clientY;
      panStartTx = tx; panStartTy = ty;
      applyTransform(false);
    }

    function updatePan(touch) {
      var dx = touch.clientX - panStartX;
      var dy = touch.clientY - panStartY;
      var clamped = clampTranslate(scale, panStartTx + dx, panStartTy + dy);
      tx = clamped.tx; ty = clamped.ty;
      applyTransform(false);
    }

    function finalizePan() {
      applyTransform(true);
    }

    /* ── Tap / double-tap ── */
    function evaluateTap(touch) {
      var now = Date.now();
      var dx = Math.abs(touch.clientX - lastTapX);
      var dy = Math.abs(touch.clientY - lastTapY);

      var isDoubleTap = (now - lastTapTime) < DOUBLE_TAP_MS &&
                         dx < DOUBLE_TAP_DIST_PX && dy < DOUBLE_TAP_DIST_PX;

      if (isDoubleTap) {
        measureBase();
        if (scale > 1.01) {
          scale = 1; tx = 0; ty = 0;
        } else {
          var wrapRect = wrapEl.getBoundingClientRect();
          var offsetX = touch.clientX - (wrapRect.left + wrapRect.width / 2);
          var offsetY = touch.clientY - (wrapRect.top + wrapRect.height / 2);
          var newTx = -offsetX * (DOUBLE_TAP_SCALE - 1);
          var newTy = -offsetY * (DOUBLE_TAP_SCALE - 1);
          var clamped = clampTranslate(DOUBLE_TAP_SCALE, newTx, newTy);
          scale = DOUBLE_TAP_SCALE; tx = clamped.tx; ty = clamped.ty;
        }
        applyTransform(true);
        lastTapTime = 0; /* consume — a third quick tap starts fresh, not a "triple" */
        return true;
      }

      lastTapTime = now;
      lastTapX = touch.clientX;
      lastTapY = touch.clientY;
      return false;
    }

    /* ── Touch event wiring ── */
    wrapEl.addEventListener('touchstart', function (e) {
      if (e.touches.length >= 2) {
        beginPinch(e.touches[0], e.touches[1]);
        e.stopPropagation();
        return;
      }
      if (e.touches.length === 1) {
        if (scale > 1.01) {
          beginPan(e.touches[0]);
          e.stopPropagation();
          return;
        }
        /* Not zoomed — record as a tap candidate. Do NOT stopPropagation
           here so a genuine swipe can still bubble up and work normally. */
        mode = 'tap-candidate';
        gestureStartX = e.touches[0].clientX;
        gestureStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    wrapEl.addEventListener('touchmove', function (e) {
      if (mode === 'pinch') {
        if (e.touches.length >= 2) {
          updatePinch(e.touches[0], e.touches[1]);
          e.preventDefault();
          e.stopPropagation();
        } else if (e.touches.length === 1) {
          /* One finger of the pinch lifted mid-gesture — seamlessly
             continue as a pan with the remaining finger, no jump. */
          finalizePinch();
          beginPan(e.touches[0]);
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }
      if (mode === 'pan' && e.touches.length === 1) {
        updatePan(e.touches[0]);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      /* mode === 'tap-candidate': not zoomed, single finger — let it
         bubble untouched so normal swipe tracking keeps working. */
    }, { passive: false });

    wrapEl.addEventListener('touchend', function (e) {
      if (mode === 'pinch') {
        /* Suppress this event regardless of how many fingers remain —
           this is what stops a pinch-release from ever leaking through
           as a spurious swipe. */
        if (e.touches.length === 0) {
          finalizePinch();
          mode = 'idle';
        } else if (e.touches.length === 1) {
          /* One finger lifted, one remains down — hand off to pan. */
          finalizePinch();
          beginPan(e.touches[0]);
        }
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (mode === 'pan') {
        var t = e.changedTouches[0];
        var movedDist = Math.hypot(t.clientX - panStartX, t.clientY - panStartY);
        finalizePan();

        if (movedDist < TAP_MOVE_THRESHOLD) {
          /* Barely moved — treat as a tap (checks for double-tap-out) even
             though we were technically in "pan" mode because scale > 1. */
          evaluateTap(t);
        }

        mode = 'idle';
        /* Always suppress — this entire gesture happened while zoomed,
           swipe should never fire in that state. */
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (mode === 'tap-candidate') {
        var tt = e.changedTouches[0];
        var totalMove = Math.hypot(tt.clientX - gestureStartX, tt.clientY - gestureStartY);
        mode = 'idle';

        if (totalMove < TAP_MOVE_THRESHOLD) {
          var wasDoubleTap = evaluateTap(tt);
          if (wasDoubleTap) {
            e.preventDefault();
            e.stopPropagation();
          }
          /* Single tap (not double): let it bubble untouched. */
          return;
        }
        /* Moved more than a tap — this was a genuine swipe attempt.
           Let it bubble untouched so the swipe handler processes it. */
        return;
      }
    }, { passive: false });

    wrapEl.addEventListener('touchcancel', function () {
      mode = 'idle';
    });

    /* ── Public controller API ── */
    return {
      isZoomed: function () { return scale > 1.01; },
      reset: function () {
        scale = 1; tx = 0; ty = 0;
        mode = 'idle';
        applyTransform(false);
      },
      onImageChange: function () {
        /* Called after a new photo has loaded — remeasures its
           rendered size. Kept for backward compatibility / best
           practice, though the module also self-measures at the
           start of every gesture as a safety net. */
        measureBase();
      }
    };
  }

  window.NNLightboxZoom = { attach: attach };

})();