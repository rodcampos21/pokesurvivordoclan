/* Safety net against "the game froze for no reason".
 * The game pauses in state 'choice' while a bond / item / move / evolution
 * window waits for you. If two of those windows collide, one can replace the
 * other and the game keeps waiting for a window that is no longer on screen.
 * If that lasts 2.5 s, resume the run (a pending bond is offered again).
 */
(function () {
  'use strict';
  var STUCK_MS = 2500;
  var since = 0;

  function shown(el) {
    return !!el && !el.classList.contains('hidden') && getComputedStyle(el).display !== 'none';
  }
  function anyChoiceUi() {
    var secs = document.querySelectorAll('section.scr');
    for (var i = 0; i < secs.length; i++) if (shown(secs[i])) return true;
    return shown(document.getElementById('evo-ui')) || shown(document.getElementById('loot-ui')) ||
      shown(document.getElementById('pull-fx'));
  }

  setInterval(function () {
    var PS = window.__PS, G = PS && PS.Game;
    if (!G || G.state !== 'choice' || typeof G.__unstick !== 'function' || anyChoiceUi()) { since = 0; return; }
    var now = performance.now();
    if (!since) { since = now; return; }
    if (now - since < STUCK_MS) return;
    since = 0;
    if (G.__unstick()) console.warn('[unstick] the game was waiting for a choice with no window open: resumed');
  }, 250);
})();
