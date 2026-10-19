/* Auréola de estrelas girando sobre todos os Pokémon shiny.
 * Funciona "por fora" do jogo: quando o jogo desenha no canvas um sprite shiny
 * (assets/pokemon/<dex>/s/...), desenhamos a auréola animada logo em cima.
 */
(function () {
  'use strict';

  // null = todos os shiny. Para limitar, use por ex. { 4: true, 5: true, 6: true }
  var DEX = null;

  var FRAMES = 8;          // quadros na folha
  var FPS = 10;            // velocidade da animação
  var SCALE = 0.85;        // largura da auréola em relação ao quadro do sprite
  var HEIGHT_POS = -0.1;  // altura (0 = topo do quadro, 1 = base)

  var halo = new Image();
  var ready = false;
  halo.onload = function () { ready = true; };
  halo.src = 'assets/ui/shiny-halo.webp';

  var re = /assets\/pokemon\/([^\/]+)\/s\//;
  var cache = new WeakMap();
  function wanted(img) {
    if (!(img instanceof HTMLImageElement)) return false;
    var v = cache.get(img);
    if (v === undefined || v.src !== img.src) {
      var m = re.exec(img.src);
      v = { src: img.src, ok: !!(m && (!DEX || DEX[parseInt(m[1], 10)])) };
      cache.set(img, v);
    }
    return v.ok;
  }

  var proto = CanvasRenderingContext2D.prototype;
  var orig = proto.drawImage;
  var busy = false;

  proto.drawImage = function (img) {
    var r = orig.apply(this, arguments);
    if (busy || !ready || !wanted(img)) return r;

    var dx, dy, dw, dh, n = arguments.length;
    if (n === 9) { dx = arguments[5]; dy = arguments[6]; dw = arguments[7]; dh = arguments[8]; }
    else if (n === 5) { dx = arguments[1]; dy = arguments[2]; dw = arguments[3]; dh = arguments[4]; }
    else if (n === 3) { dx = arguments[1]; dy = arguments[2]; dw = img.naturalWidth; dh = img.naturalHeight; }
    else return r;
    if (!(dw > 0 && dh > 0)) return r;

    var fw = halo.naturalWidth / FRAMES, fh = halo.naturalHeight;
    var f = Math.floor(performance.now() / (1000 / FPS)) % FRAMES;
    var w = Math.abs(dw) * SCALE, h = w * fh / fw;
    var cx = dx + dw / 2, cy = dy + dh * HEIGHT_POS;

    busy = true;
    try { orig.call(this, halo, f * fw, 0, fw, fh, cx - w / 2, cy - h / 2, w, h); }
    finally { busy = false; }
    return r;
  };
})();
