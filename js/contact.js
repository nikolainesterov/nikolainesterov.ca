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
  publicKey:   '3-TPn11tc66xQUPsW',    // ← paste here
  serviceId:   'service_r2qzhig',    // ← paste here
  templateId:  'template_qfev1j7'   // ← paste here
};

(function () {
  'use strict';

  var form    = document.getElementById('contactForm');
  var msgEl   = document.getElementById('formMessage');
  var submitBtn;

  if (!form) return;

  submitBtn = form.querySelector('.form-submit');

  /* ── Init EmailJS ── */
  if (typeof emailjs !== 'undefined' && EMAILJS_CONFIG.publicKey !== '3-TPn11tc66xQUPsW') {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  }

  /* ── Validate ── */
  function validate() {
    var name  = form.querySelector('[name="from_name"]');
    var email = form.querySelector('[name="from_email"]');
    var msg   = form.querySelector('[name="message"]');

    if (!name  || !name.value.trim())  { showMsg('Please enter your name.',  true); return false; }
    if (!email || !validateEmail(email.value)) { showMsg('Please enter a valid email.', true); return false; }
    if (!msg   || !msg.value.trim())   { showMsg('Please include a message.', true); return false; }

    // 50KB limit — 50,000 characters covers the entire form payload safely
    var totalLength = (name.value + email.value + msg.value).length;
    if (totalLength > 45000) {
      showMsg('Your message is too long. Please shorten it and try again.', true); 
      return false; 
    }

    // reCAPTCHA check — skipped automatically on localhost
    var isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocalhost && typeof grecaptcha !== 'undefined' && grecaptcha.getResponse().length === 0) {
      showMsg('Please confirm you are not a robot.', true);
      return false;
    }

    return true;
  }

  function validateEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  /* ── UI helpers ── */
  function showMsg(text, isError) {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className   = 'form-message show' + (isError ? ' error' : '');
  }
  function hideMsg() {
    if (!msgEl) return;
    msgEl.className = 'form-message';
  }
  function setLoading(on) {
    if (!submitBtn) return;
    submitBtn.disabled   = on;
    submitBtn.textContent = on ? 'Sending…' : 'Send Message';
  }

  /* ── Submit ── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    hideMsg();
    if (!validate()) return;

    // If EmailJS not configured, show a warning
    if (typeof emailjs === 'undefined') {
      showMsg('EmailJS SDK not loaded. Please check your HTML script tag.', true);
      return;
    }
    if (EMAILJS_CONFIG.publicKey === '3-TPn11tc66xQUPsW') {
      showMsg('Please configure your EmailJS credentials in js/contact.js', true);
      return;
    }

    setLoading(true);

    // Collect template params
    var params = {
      from_name:  form.querySelector('[name="from_name"]').value.trim(),
      from_email: form.querySelector('[name="from_email"]').value.trim(),
      subject:    (form.querySelector('[name="subject"]') || { value: 'Website Enquiry' }).value,
      message:    form.querySelector('[name="message"]').value.trim()
    };

    emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, params)
      .then(function () {
        showMsg('Your message has been sent. I\'ll be in touch soon!', false);
        form.reset();
        var isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        if (!isLocalhost && typeof grecaptcha !== 'undefined') grecaptcha.reset();
        setLoading(false);
      })
      .catch(function (err) {
        console.error('EmailJS error:', err);
        showMsg('Something went wrong. Please email me directly at studio@nikolainesterov.ca', true);
        setLoading(false);
      });
  });

})();
