/* The game is English-only in this fork: the bundle always picks 'en'
 * (patched in app.min.js), so the "Language" option is removed from
 * Settings > Graphics.
 */
(function () {
  'use strict';

  function dropLanguageRow(root) {
    var chip = (root || document).querySelector('[data-lang]');
    if (!chip) return;
    var chips = chip.closest('.chips') || chip.parentElement;
    var sub = chips.previousElementSibling, head = sub && sub.previousElementSibling;
    if (sub && sub.matches('p.sub')) {
      if (head && head.matches('h3, .set-h')) head.remove();
      sub.remove();
    } else if (sub && sub.matches('h3, .set-h')) sub.remove();
    chips.remove();
  }

  // The translator turns the controller button "Y" into the Spanish word
  // "y" = "AND". Keep button names as they are.
  var PAD = { Y: 1 };
  function fixT(ns) {
    if (!ns || typeof ns.T !== 'function' || ns.T.__en) return;
    var t = ns.T;
    ns.T = function (s) { return (typeof s === 'string' && PAD[s]) ? s : t.apply(this, arguments); };
    ns.T.__en = true;
  }
  var d = Object.getOwnPropertyDescriptor(window, '__PS');
  var prevGet = d && d.get, prevSet = d && d.set, own;
  Object.defineProperty(window, '__PS', {
    configurable: true,
    get: function () { return prevGet ? prevGet() : own; },
    set: function (v) {
      if (prevSet) prevSet(v); else own = v;
      try { fixT(v); } catch (e) {}
    }
  });
  function fixPadButtons(root) {
    (root || document).querySelectorAll('.padbtn').forEach(function (b) {
      if (b.getAttribute('translate') !== 'no') b.setAttribute('translate', 'no');
      if (b.textContent.trim().toUpperCase() === 'AND') b.textContent = 'Y';
    });
  }

  function start() {
    try { localStorage.removeItem('ps.lang'); } catch (e) {}
    var host = document.getElementById('scr-settings') || document.body;
    dropLanguageRow(host); fixPadButtons(host);
    new MutationObserver(function () { dropLanguageRow(host); fixPadButtons(host); })
      .observe(host, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
