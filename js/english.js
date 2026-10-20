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
    // Contact window (#about-pop): this fork's logo and text
    new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++)
        for (var j = 0; j < muts[i].addedNodes.length; j++)
          if (muts[i].addedNodes[j].id === 'about-pop') rewriteAbout(muts[i].addedNodes[j]);
    }).observe(document.body, { childList: true });
  }

  var ABOUT = [
    'This is the <b>enhanced version by Rod</b> of PokéSurvivor.',
    'The original game is by <b>JPTER78</b> (<a href="https://github.com/JPTER78/pokesurvivor" target="_blank" rel="noopener">github.com/JPTER78/pokesurvivor</a>). ' +
      'I took over the work and improved it a lot my own way.',
    "It's still a free, non-profit fan game."
  ];
  function rewriteAbout(pop) {
    var box = pop.querySelector('.box');
    if (!box || box.__fork) return;
    box.__fork = true;
    var img = box.querySelector('img');
    if (img) { img.src = 'assets/ui/logo-doclan-menu.webp'; img.alt = 'PokéSurvivor do Clã'; }
    var ps = box.querySelectorAll(':scope > p');
    for (var i = 0; i < 3 && i < ps.length; i++) ps[i].innerHTML = ABOUT[i];
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
