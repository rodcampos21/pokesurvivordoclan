/* Botão "Pular" na animação do gacha: mostra direto o que saiu.
 * Liga window.__gachaSkip (lido pelo app.min.js) e ativa o modo rápido da máquina. */
(function () {
  'use strict';
  window.__gachaSkip = false;

  function init() {
    var fx = document.getElementById('pull-fx');
    var skip = document.getElementById('pull-skip');
    var close = document.getElementById('pull-close');
    var slot = document.getElementById('slot');
    if (!fx || !skip || !close) return;

    var wasHidden = fx.classList.contains('hidden');
    function sync() {
      var open = !fx.classList.contains('hidden');
      if (open && wasHidden) window.__gachaSkip = false;          // nova tirada: começa normal
      wasHidden = !open;
      var done = !close.classList.contains('hidden');
      skip.classList.toggle('hidden', !open || done || window.__gachaSkip);
    }
    new MutationObserver(sync).observe(fx, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(close, { attributes: true, attributeFilter: ['class'] });

    skip.addEventListener('click', function (e) {
      e.stopPropagation();
      window.__gachaSkip = true;
      if (slot && slot.onclick) slot.onclick();   // liga o modo rápido da máquina
      sync();
    });
    sync();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
