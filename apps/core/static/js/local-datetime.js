/**
 * Format data-timestamp elements to user's local timezone and locale.
 * Add data-timestamp="ISO8601" to any element; its text will be replaced with local datetime.
 * Fallback: element's initial content is shown if JS fails or timestamp is invalid.
 */
(function() {
  'use strict';

  function formatLocalDatetime() {
    document.querySelectorAll('[data-timestamp]').forEach(function(el) {
      var ts = el.getAttribute('data-timestamp');
      if (!ts) return;
      try {
        var date = new Date(ts);
        if (isNaN(date.getTime())) return;
        var formatted = date.toLocaleString(undefined, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        el.textContent = formatted;
      } catch (e) {
        /* keep fallback content */
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', formatLocalDatetime);
  } else {
    formatLocalDatetime();
  }
})();
