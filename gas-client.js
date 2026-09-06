/**
 * gas-client.js
 * The ONLY file in this project that needs editing before you deploy.
 * This app's backend is a set of .gs files in a Google Apps Script project
 * (no HTML there at all); this file is the bridge that lets the static
 * HTML/CSS/JS you host on GitHub Pages talk to it. It reimplements the
 * chainable google.script.run API (withSuccessHandler / withFailureHandler /
 * <functionName>(...args)) on top of fetch(), so app.js, calendar.js,
 * availability.js, and modal.js call it exactly as if they were running
 * inside Apps Script — no other file needs to change.
 *
 * Must be loaded BEFORE app.js / calendar.js / availability.js / modal.js.
 */
(function () {
  // ==================================================================
  // PASTE YOUR APPS SCRIPT WEB APP URL HERE (Deploy → ends in /exec)
  const API_BASE_URL = 'https://script.google.com/macros/s/AKfycbzyOTtyhlZN8AZp32OoptNLKaB2cLOFtMeyhmep0WlryFIh70ekkc3AY5oBqjMsb6zp/exec';
  // ==================================================================

  // Read-only calls go as GET (fine to be a plain URL); everything else is POST.
  const GET_ACTIONS = new Set([
    'getBootstrapData', 'getEvents', 'getEventById', 'searchEvents', 'checkConflict',
    'getAvailability', 'getAvailableStartTimes', 'getSettings', 'getCategories'
  ]);

  function callApi(action, args) {
    if (API_BASE_URL.indexOf('PASTE_YOUR_APPS_SCRIPT_WEB_APP_EXEC_URL_HERE') !== -1) {
      return Promise.resolve({
        success: false,
        error: 'gas-client.js is not configured yet — paste your Apps Script Web App /exec URL into API_BASE_URL at the top of that file.'
      });
    }
    if (GET_ACTIONS.has(action)) {
      const url = API_BASE_URL + '?action=' + encodeURIComponent(action) +
        '&args=' + encodeURIComponent(JSON.stringify(args));
      return fetch(url, { method: 'GET' }).then(r => r.json());
    }
    // Sent as text/plain (default for a string body) so the browser never
    // issues a CORS preflight — Apps Script Web Apps can't answer one.
    return fetch(API_BASE_URL, {
      method: 'POST',
      body: JSON.stringify({ action: action, args: args })
    }).then(r => r.json());
  }

  function makeRunner(successHandler, failureHandler) {
    return new Proxy({}, {
      get(_target, name) {
        if (name === 'withSuccessHandler') return cb => makeRunner(cb, failureHandler);
        if (name === 'withFailureHandler') return cb => makeRunner(successHandler, cb);
        if (name === 'withUserObject') return () => makeRunner(successHandler, failureHandler);
        return function (...args) {
          callApi(name, args)
            .then(result => { if (successHandler) successHandler(result); })
            .catch(err => {
              if (failureHandler) failureHandler(err);
              else console.error('gas-client error:', err);
            });
        };
      }
    });
  }

  window.google = window.google || {};
  window.google.script = window.google.script || {};
  window.google.script.run = makeRunner(null, null);
})();
