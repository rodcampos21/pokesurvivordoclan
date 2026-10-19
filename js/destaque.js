/* =====================================================================
 * POKÉMON EM DESTAQUE — 5 Pokémon com +15% em todos os atributos,
 * trocando a cada 1 hora REAL. A lista é a mesma para todos os jogadores.
 * ---------------------------------------------------------------------
 * Não precisa de servidor: o sorteio usa como semente o número da hora
 * em UTC (horas desde 1/1/1970). Todo mundo, em qualquer fuso, calcula
 * exatamente os mesmos 5 Pokémon, e eles trocam juntos na virada da hora.
 *
 * O bônus vale para o Pokémon com que você COMEÇA a partida, se ele
 * estiver na lista nesse momento, e dura a partida inteira.
 * ===================================================================== */
(function () {
  'use strict';

  var COUNT = 5;
  var BONUS = 0.15;
  var HOUR = 3600 * 1000;
  var SALT = 0x5eed1d;            // muda a sequência se um dia quiser "re-embaralhar"

  var PS = null;

  // ------------------------------------------------------------ sorteio
  var nowFn = function () { return Date.now(); };
  function hourIndex(t) { return Math.floor((t || nowFn()) / HOUR); }

  function rng(seed) {             // mulberry32: rápido e igual em todo navegador
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var pool = null;
  function getPool() {
    if (pool) return pool;
    // todos os Pokémon jogáveis com sprite, ordenados pelo número da Pokédex
    // (a ordem fixa garante o mesmo resultado em todos os aparelhos)
    pool = PS.DEX.filter(function (d) { return d && d.dex && PS.SPRITE_META && PS.SPRITE_META[d.dex]; })
      .map(function (d) { return d.dex; })
      .sort(function (a, b) { return a - b; });
    return pool;
  }

  var cache = {};
  function featured(h) {
    h = h == null ? hourIndex() : h;
    if (cache[h]) return cache[h];
    var list = getPool().slice(), r = rng((h ^ SALT) * 2654435761), out = [];
    for (var i = 0; i < COUNT && list.length; i++) {
      var k = Math.floor(r() * list.length);
      out.push(list.splice(k, 1)[0]);
    }
    cache = {}; cache[h] = out;
    return out;
  }
  function isFeatured(dex) { return featured().indexOf(dex) >= 0; }

  // ------------------------------------------------------------ bônus na partida
  // O bônus segue a lista da hora: se a hora vira no meio da partida, quem saiu
  // da lista perde o bônus e quem entrou ganha. Cada parte somada fica guardada
  // (campos _hb*) para ser retirada exatamente, mesmo que o jogador tenha
  // ganho outros bônus no meio tempo.
  function buffDex(p) { return p.hbDex || p.baseDex || p.dex; }

  function applyBuff(p, quiet) {
    if (!p || p.remote || p.hourBuff) return;
    var dex = buffDex(p);
    if (!isFeatured(dex)) return;
    var k = 1 + BONUS, P = PS.Player;
    p.hourBuff = k;
    p.hbDex = dex;
    var hp0 = p.maxHp;
    p.maxHp = Math.min(P.HP_CAP, Math.round(p.maxHp * k));            // vida
    p._hbHp = p.maxHp - hp0;
    p.hp = Math.min(p.maxHp, p.hp + p._hbHp);
    p.atkMul *= k; p.atkPerm *= k;                                    // ataque
    p.spdMul *= k; p.spdPerm *= k;                                    // velocidade
    p.cdMul /= k; p.cdPerm /= k;                                      // recarga
    var d0 = p.dmgReduce || 0;                                        // defesa
    p.dmgReduce = Math.min(P.DEF_CAP, 1 - (1 - d0) / k);
    p._hbDef = p.dmgReduce - d0;
    p._hbRgn = (p.regenFlat || 0) * BONUS + 0.15;                     // regeneração
    p.regenFlat = (p.regenFlat || 0) + p._hbRgn;
    p.magnet *= k; p.magPerm *= k;                                    // ímã
    p.xpMul *= k; p.xpPerm *= k;                                      // experiência
    p._hbCrit = (p.critChance || 0) * BONUS + 0.015;                  // crítico
    p.critChance = (p.critChance || 0) + p._hbCrit; p.critPerm = (p.critPerm || 0) + p._hbCrit;
    var name = (PS.DEX_BY[dex] || {}).name || '';
    setTimeout(function () {
      try {
        PS.Spawner.say(name + (quiet ? ' entrou em destaque' : ' em destaque') + ': +15% nos atributos!', 3.4, true);
        PS.FX.dmgText(p.x, p.y - p.bodyH - 12, '+15%', '#ffd23f', true);
      } catch (e) {}
    }, quiet ? 0 : 900);
  }

  function removeBuff(p) {
    if (!p || !p.hourBuff) return;
    var k = p.hourBuff;
    p.maxHp = Math.max(1, p.maxHp - (p._hbHp || 0));
    p.hp = Math.min(p.hp, p.maxHp);
    p.atkMul /= k; p.atkPerm /= k;
    p.spdMul /= k; p.spdPerm /= k;
    p.cdMul *= k; p.cdPerm *= k;
    p.dmgReduce = Math.max(0, (p.dmgReduce || 0) - (p._hbDef || 0));
    p.regenFlat = Math.max(0, (p.regenFlat || 0) - (p._hbRgn || 0));
    p.magnet /= k; p.magPerm /= k;
    p.xpMul /= k; p.xpPerm /= k;
    p.critChance = Math.max(0, (p.critChance || 0) - (p._hbCrit || 0));
    p.critPerm = Math.max(0, (p.critPerm || 0) - (p._hbCrit || 0));
    p.hourBuff = 0; p._hbHp = p._hbDef = p._hbRgn = p._hbCrit = 0;
    var name = (PS.DEX_BY[buffDex(p)] || {}).name || '';
    try {
      PS.Spawner.say('A hora de ' + name + ' acabou: bônus de destaque removido', 3.4, true);
      PS.FX.dmgText(p.x, p.y - p.bodyH - 12, '-15%', '#ff8a8a', true);
    } catch (e) {}
  }

  // a cada segundo confere se a hora virou durante a partida
  var lastHour = hourIndex();
  function checkHour() {
    var h = hourIndex();
    if (h === lastHour) return;
    lastHour = h;
    var p = PS.Game && PS.Game.player, stt = PS.Game && PS.Game.state;
    if (!p || p.remote || !stt || stt === 'ui' || stt === 'over') return;
    if (!p.hbDex) p.hbDex = p.baseDex || p.dex;
    var still = isFeatured(p.hbDex);
    if (p.hourBuff && !still) removeBuff(p);
    else if (!p.hourBuff && still) applyBuff(p, true);
  }

  // ------------------------------------------------------------ plaquinha
  var CSS = '' +
    '.dq-board{margin:12px 0 4px;padding:10px 10px 8px;border-radius:12px;background:linear-gradient(180deg,#2a2150,#17122e);' +
    'border:2px solid #ffd23f;box-shadow:0 3px 0 #8a6a12,0 6px 16px rgba(0,0,0,.35);text-align:center}' +
    '.dq-title{font-weight:800;color:#ffd23f;font-size:14px;letter-spacing:.5px}' +
    '.dq-sub{font-size:11px;color:#cfc7ff;margin:2px 0 6px}' +
    '.dq-list{display:flex;justify-content:center;gap:4px;flex-wrap:nowrap}' +
    '.dq-mon{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;padding:4px 2px;border-radius:8px;' +
    'background:rgba(255,255,255,.06);border:1px solid rgba(255,210,63,.35)}' +
    '.dq-mon canvas{width:56px;height:56px;image-rendering:pixelated}' +
    '.dq-mon b{font-size:11px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
    '.dq-mon i{font-style:normal;font-size:10px;color:#ffd23f;font-weight:700}' +
    '.dq-mon.mine{border-color:#7dff9a;background:rgba(125,255,154,.12)}' +
    '.dq-time{font-size:11px;color:#cfc7ff;margin-top:6px}' +
    '.dq-board.compact{margin:0;padding:6px 10px;flex:1 1 auto;min-width:0;display:grid;' +
    'grid-template-columns:auto 1fr;grid-template-rows:auto auto auto;column-gap:10px;align-items:center;text-align:left}' +
    '.dq-board.compact .dq-title{grid-column:1;grid-row:1;font-size:13px}' +
    '.dq-board.compact .dq-sub{grid-column:1;grid-row:2;margin:0;font-size:10px}' +
    '.dq-board.compact .dq-time{grid-column:1;grid-row:3;margin:2px 0 0}' +
    '.dq-board.compact .dq-list{grid-column:2;grid-row:1/4;gap:4px}' +
    '.dq-board.compact .dq-mon{padding:2px}' +
    '.dq-board.compact .dq-mon canvas{width:40px;height:40px}' +
    '@media (max-width:900px){.dq-board.compact{grid-template-columns:1fr}.dq-board.compact .dq-list{grid-column:1;grid-row:4}}' +
    '.dq-board.compact.phone{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:0 8px;text-align:center;margin-top:2px;padding:4px 6px}' +
    '.dq-board.compact.phone .dq-sub{display:none}.dq-board.compact.phone .dq-title{font-size:11px}' +
    '.dq-board.compact.phone .dq-time{order:1;font-size:10px;margin:0}' +
    '.dq-board.compact.phone .dq-list{order:2;flex:1 1 100%;margin-top:2px}' +
    '.dq-board.compact.phone .dq-mon{padding:1px}.dq-board.compact.phone .dq-mon canvas{width:28px;height:28px}' +
    '.dq-board.compact.phone .dq-mon b{font-size:8px}.dq-board.compact.phone .dq-mon i{display:none}' +
    '#scr-menu .menu-right:has(.dq-board.phone) .logo-phone .logo-img{width:min(190px,100%)!important}' +
    '@media (max-height:520px){.dq-mon canvas{width:40px;height:40px}.dq-board{margin:6px 0 2px;padding:6px}}';

  function fmt(ms) {
    var s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60);
    s %= 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  var boards = [];
  function buildBoard(host, before, compact) {
    if (!host || host.querySelector(':scope > .dq-board')) return;
    var el = document.createElement('div');
    el.className = 'dq-board' + (compact ? ' compact' : '');
    el.setAttribute('translate', 'no');
    el.innerHTML = '<div class="dq-title">★ Pokémon em destaque ★</div>' +
      '<div class="dq-sub">+15% nos atributos durante esta hora</div>' +
      '<div class="dq-list"></div><div class="dq-time"></div>';
    if (before && before.parentNode === host) host.insertBefore(el, before); else host.appendChild(el);
    boards.push({ el: el, hour: -1 });
  }

  function partnerDex() {
    var s = PS.DB && PS.DB.save;
    return s && s.partner;
  }

  function renderBoard(b) {
    var h = hourIndex();
    var list = b.el.querySelector('.dq-list');
    if (b.hour !== h) {
      b.hour = h;
      list.innerHTML = '';
      featured(h).forEach(function (dex) {
        var m = PS.DEX_BY[dex] || { name: '#' + dex };
        var card = document.createElement('div');
        card.className = 'dq-mon';
        card.dataset.dex = dex;
        var cv = document.createElement('canvas');
        cv.width = 56; cv.height = 56;
        card.appendChild(cv);
        card.insertAdjacentHTML('beforeend', '<b title="' + m.name + '">' + m.name + '</b><i>+15%</i>');
        list.appendChild(card);
        try { PS.UI.sprite(cv, dex, { scale: 2 }); } catch (e) {}
      });
    }
    var mine = partnerDex();
    list.querySelectorAll('.dq-mon').forEach(function (c) { c.classList.toggle('mine', +c.dataset.dex === mine); });
    var left = (h + 1) * HOUR - nowFn();
    b.el.querySelector('.dq-time').textContent = 'Troca em ' + fmt(left);
  }

  function menuBoard() {
    for (var i = 0; i < boards.length; i++) if (boards[i].el.closest('#scr-menu')) return boards[i];
    return null;
  }

  function tickBoards() {
    var login = document.querySelector('#scr-login .box');
    if (login) buildBoard(login, login.querySelector('.tabs'), false);
    // no menu: faixa de baixo no PC; no celular deitado, coluna da direita (embaixo do logo)
    var phone = window.innerHeight <= 520;
    var spot = phone ? document.querySelector('#scr-menu .menu-right') : document.querySelector('#scr-menu .menu-bottom');
    if (spot) {
      var mb = menuBoard();
      if (!mb) buildBoard(spot, phone ? null : spot.querySelector('.room-panel'), true);
      else if (mb.el.parentNode !== spot) {
        if (phone) spot.appendChild(mb.el); else spot.insertBefore(mb.el, spot.querySelector('.room-panel'));
      }
      if (mb) mb.el.classList.toggle('phone', phone);
    }
    boards.forEach(function (b) {
      if (b.el.offsetParent !== null) renderBoard(b);   // só quando está visível
    });
  }

  // ------------------------------------------------------------ instalação
  function install() {
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    var reset = PS.Stats.reset;
    PS.Stats.reset = function (p) {
      var r = reset.apply(this, arguments);
      try { if (p && p === PS.Game.player) { if (!p.hbDex) p.hbDex = p.baseDex || p.dex; applyBuff(p); } } catch (e) { console.error('[destaque]', e); }
      return r;
    };

    setInterval(tickBoards, 500);
    setInterval(checkHour, 1000);
    tickBoards();

    window.__destaque = { featured: featured, isFeatured: isFeatured, hourIndex: hourIndex,
      _test: { checkHour: checkHour, setNow: function (f) { nowFn = f; } } };
  }

  var wait = setInterval(function () {
    var ns = window.__PS;
    if (ns && ns.Stats && ns.UI && ns.DEX && ns.DEX_BY && ns.Player && ns.Game) {
      clearInterval(wait);
      PS = ns;
      install();
    }
  }, 50);
})();
