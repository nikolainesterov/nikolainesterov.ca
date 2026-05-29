/* ─── contact.js ───────────────────────────────────────────
   Contact form using EmailJS

   SETUP INSTRUCTIONS
   ──────────────────
   1. Create a free account at https://www.emailjs.com
   2. Add an Email Service (e.g. Gmail) → copy your Service ID
   3. Create an Email Template → copy your Template ID
      Suggested template variables to include in your template:
        {{from_name}}  {{from_email}}  {{subject}}  {{message}}
   4. Go to Account → API Keys → copy your Public Key
   5. Paste all three values into the CONFIG object below.
   6. Load the EmailJS SDK in your HTML (already included in contact form):
      <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"></script>

──────────────────────────────────────────────────────────── */

var EMAILJS_CONFIG = {
  publicKey:   '3-TPn11tc66xQUPsW',
  serviceId:   'service_r2qzhig',
  templateId:  'template_qfev1j7'
};

/* ── reCAPTCHA callbacks — must be global (referenced in HTML) ── */

// Called automatically by reCAPTCHA once the user checks the box
window.nnCaptchaSuccess = function () {
  sendForm();
};

// Called if the token expires before the form is submitted
window.nnCaptchaExpired = function () {
  showMsg('Verification expired — please try again.', true);
  setLoading(false);
};

/* ─────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var form      = document.getElementById('contactForm');
  var msgEl     = document.getElementById('formMessage');
  var submitBtn;
  var captchaContainer;

  var isLocalhost = window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1';

  if (!form) return;

  submitBtn        = form.querySelector('.form-submit');
  captchaContainer = document.getElementById('captchaContainer');

  /* ── Init EmailJS ── */
  if (typeof emailjs !== 'undefined') {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  }

  /* ── Validate fields only (no captcha check here) ── */
  function validate() {
    var name  = form.querySelector('[name="from_name"]');
    var email = form.querySelector('[name="from_email"]');
    var msg   = form.querySelector('[name="message"]');

    if (!name  || !name.value.trim())       { showMsg('Please enter your name.', true);          return false; }
    if (!email || !validateEmail(email.value)) { showMsg('Please enter a valid email.', true);    return false; }
    if (!msg   || !msg.value.trim())           { showMsg('Please include a message.', true);      return false; }

    var totalLength = (name.value + email.value + msg.value).length;
    if (totalLength > 45000) {
      showMsg('Your message is too long. Please shorten it and try again.', true);
      return false;
    }
    return true;
  }

  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ── UI helpers ── */
  window.showMsg = function (text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className   = 'form-message show' + (isError ? ' error' : '');
  };
  window.setLoading = function (on) {
    if (!submitBtn) return;
    submitBtn.disabled    = on;
    submitBtn.textContent = on ? 'Sending…' : 'Send Message';
  };
  function hideMsg() {
    if (!msgEl) return;
    msgEl.className = 'form-message';
  }

  /* ── Show the captcha with a smooth slide-down ── */
  function showCaptcha() {
    if (!captchaContainer) return;
    captchaContainer.style.display    = 'block';
    /* Trigger transition on next frame */
    requestAnimationFrame(function () {
      captchaContainer.style.maxHeight = '200px';
      captchaContainer.style.marginBottom = '1rem';
    });
  }

  /* ── Phase 2: actually send the email ── */
  window.sendForm = function () {
    if (typeof emailjs === 'undefined') {
      showMsg('EmailJS SDK not loaded. Please check your script tag.', true);
      return;
    }

    setLoading(true);

    var params = {
      from_name:  form.querySelector('[name="from_name"]').value.trim(),
      last_name:  (form.querySelector('[name="last_name"]') || { value: '' }).value.trim(),
      from_email: form.querySelector('[name="from_email"]').value.trim(),
      subject:    (form.querySelector('[name="subject"]')  || { value: 'Website Enquiry' }).value,
      message:    form.querySelector('[name="message"]').value.trim()
    };

    emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, params)
      .then(function () {
        showMsg("Your message has been sent. I'll be in touch soon!", false);
        form.reset();
        /* Hide captcha again after success */
        if (captchaContainer) {
          captchaContainer.style.maxHeight  = '0';
          captchaContainer.style.marginBottom = '0';
          setTimeout(function () {
            captchaContainer.style.display = 'none';
            if (!isLocalhost && typeof grecaptcha !== 'undefined') {
              grecaptcha.reset();
            }
          }, 400);
        }
        setLoading(false);
      })
      .catch(function (err) {
        console.error('EmailJS error:', err);
        showMsg('Something went wrong. Please email me directly at info@nikolainesterov.ca', true);
        if (!isLocalhost && typeof grecaptcha !== 'undefined') grecaptcha.reset();
        setLoading(false);
      });
  };

  /* ── Phase 1: Submit button clicked ── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideMsg();

    if (!validate()) return;

    /* Localhost — skip captcha entirely, send straight away */
    if (isLocalhost) {
      sendForm();
      return;
    }

    /* Check if captcha is already verified */
    if (typeof grecaptcha !== 'undefined' && grecaptcha.getResponse().length > 0) {
      /* Already verified — send immediately */
      sendForm();
      return;
    }

    /* Captcha not yet completed — show it and prompt the user */
    showCaptcha();
    showMsg('Please verify you are not a robot, then your message will send automatically.', false);
  });

})();
