/* Músicas do jogo (substituem as trilhas sintetizadas).
 * O app.min.js chama window.__musicHook(nome, ajustes) sempre que quer trocar de música;
 * aqui escolhemos o arquivo mp3 certo e devolvemos true para calar a trilha antiga.
 *   menu.mp3       -> login, menus e demais telas ('village')
 *   exploracao.mp3 -> durante a partida (biomas: 'forest', etc.)
 *   chefe.mp3      -> chefes, fendas/rifts, treino e o Julgamento ('boss', 'rift', 'judgment')
 */
(function () {
  'use strict';

  var FILES = {
    menu: 'assets/music/menu.mp3',
    exploracao: 'assets/music/exploracao.mp3',
    chefe: 'assets/music/chefe.mp3'
  };
  var CHEFE = { boss: 1, rift: 1, judgment: 1 };
  var MENU = { village: 1 };
  var BASE_VOLUME = 0.8;   // volume máximo (multiplicado pelo ajuste "Música" do jogo)
  var FADE_MS = 700;

  function categoria(nome) {
    if (!nome) return null;
    if (CHEFE[nome]) return 'chefe';
    if (MENU[nome]) return 'menu';
    return 'exploracao';
  }

  var tracks = {};
  function track(k) {
    if (!tracks[k]) {
      var a = new Audio(FILES[k]);
      a.loop = true;
      a.preload = 'auto';
      a.volume = 0;
      a._fade = 0;          // 0..1 (crossfade)
      a._target = 0;
      tracks[k] = a;
    }
    return tracks[k];
  }

  var settings = null;      // objeto de ajustes do jogo ({ music, muted, ... })
  var current = null;       // categoria tocando agora
  var blocked = false;      // navegador bloqueou o autoplay

  function master() {
    if (!settings) return BASE_VOLUME * 0.55;
    if (settings.muted) return 0;
    var v = +settings.music;
    return BASE_VOLUME * (isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.55);
  }

  function tryPlay(a) {
    var p = a.play();
    if (p && p.catch) p.catch(function () { blocked = true; });
  }

  function switchTo(cat) {
    if (cat === current) return;
    current = cat;
    for (var k in tracks) tracks[k]._target = 0;
    if (cat) {
      var a = track(cat);
      a._target = 1;
      if (a.paused) { try { a.currentTime = 0; } catch (e) {} tryPlay(a); }
    }
  }

  // Crossfade + acompanhar o volume/mudo do jogo
  var last = performance.now();
  setInterval(function () {
    var now = performance.now(), step = (now - last) / FADE_MS; last = now;
    var m = master();
    for (var k in tracks) {
      var a = tracks[k];
      if (a._fade < a._target) a._fade = Math.min(a._target, a._fade + step);
      else if (a._fade > a._target) a._fade = Math.max(a._target, a._fade - step);
      a.volume = Math.max(0, Math.min(1, a._fade * m));
      if (a._fade === 0 && a._target === 0 && !a.paused) a.pause();
    }
  }, 50);

  // Autoplay bloqueado: tenta de novo no primeiro toque/tecla
  function unlock() {
    if (!blocked || !current) return;
    blocked = false;
    tryPlay(track(current));
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  });

  // Aba escondida: pausa; ao voltar, retoma
  document.addEventListener('visibilitychange', function () {
    if (!current) return;
    var a = track(current);
    if (document.hidden) a.pause(); else tryPlay(a);
  });

  window.__musicHook = function (nome, ajustes) {
    if (ajustes) settings = ajustes;
    switchTo(categoria(nome));
    return true;   // cala a música sintetizada original
  };
  window.__musicNow = function () { return current; };
})();
