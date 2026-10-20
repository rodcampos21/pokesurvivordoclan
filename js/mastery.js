/* =====================================================================
 * MASTERY — one per Pokémon, earned by the total damage it has dealt
 * ---------------------------------------------------------------------
 *  Rookie 5M · Challenger 10M · Veteran 15M · Gym Leader 25M · Frontier Brain 35M
 *  Elite Four 45M · Champion 60M · Pokémon Master 75M · Legendary 90M · Monarch 100M
 *
 *  · Damage counts in every mode except the Boss Rush (and not in training or with the dev menu on).
 *  · Reaching a milestone evolves the mastery: only the highest one is used.
 *  · Equip / unequip it in Upgrades; when equipped, the badge floats over
 *    your Pokémon in the run (co-op mates see it too).
 *  · Saved in DB.save.mastery (cloud) and mirrored in localStorage.
 * ===================================================================== */
(function () {
  'use strict';

  var TIERS = [
    { id: 'rookie',     name: 'Rookie',         need: 5e6 },
    { id: 'challenger', name: 'Challenger',     need: 10e6 },
    { id: 'veteran',    name: 'Veteran',        need: 15e6 },
    { id: 'gym',        name: 'Gym Leader',     need: 25e6 },
    { id: 'frontier',   name: 'Frontier Brain', need: 35e6 },
    { id: 'elite',      name: 'Elite Four',     need: 45e6 },
    { id: 'champion',   name: 'Champion',       need: 60e6 },
    { id: 'master',     name: 'Pokémon Master', need: 75e6 },
    { id: 'legendary',  name: 'Legendary',      need: 90e6 },
    { id: 'monarch',    name: 'Monarch',        need: 100e6 }
  ];
  var LS = 'ps.mastery';
  var BADGE_W = 46, BADGE_H = 40; // max badge size over the Pokémon (world px)
  var PS = null;

  var imgs = {};
  TIERS.forEach(function (t) { var im = new Image(); im.src = 'assets/ui/mastery/' + t.id + '.webp?v=4'; imgs[t.id] = im; });

  // ------------------------------------------------------------ data
  function blank() { return { d: {}, eq: {} }; }
  function local() {
    try { var v = JSON.parse(localStorage.getItem(LS) || 'null'); if (v && v.d) return v; } catch (e) {}
    return blank();
  }
  // the cloud save can arrive after the local one: keep the highest damage per Pokémon
  function data() {
    var s = PS && PS.DB && PS.DB.save;
    var L = local(), m = s && s.mastery && s.mastery.d ? s.mastery : null;
    if (!m) { if (s) s.mastery = L; return L; }
    if (!m.__merged) {
      Object.keys(L.d).forEach(function (k) { if ((L.d[k] || 0) > (m.d[k] || 0)) m.d[k] = L.d[k]; });
      m.eq = m.eq || {};
      Object.keys(L.eq || {}).forEach(function (k) { if (!(k in m.eq)) m.eq[k] = L.eq[k]; });
      Object.defineProperty(m, '__merged', { value: true, enumerable: false });
    }
    return m;
  }
  var dirty = false, lastFlush = 0;
  function persist(force) {
    var m = data();
    try { localStorage.setItem(LS, JSON.stringify({ d: m.d, eq: m.eq })); } catch (e) {}
    var now = performance.now();
    if (!force && now - lastFlush < 20000) { dirty = true; return; }
    lastFlush = now; dirty = false;
    try { if (PS.DB && PS.DB.save) { PS.DB.save.mastery = m; if (PS.DB.flush) PS.DB.flush(); } } catch (e) {}
  }

  function dmgOf(dex) { return +data().d[String(dex)] || 0; }
  function tierIdx(dmg) { var i = -1; for (var k = 0; k < TIERS.length; k++) if (dmg >= TIERS[k].need) i = k; return i; }
  function tierOf(dex) { var i = tierIdx(dmgOf(dex)); return i >= 0 ? TIERS[i] : null; }
  function equipped(dex) { return !!data().eq[String(dex)] && !!tierOf(dex); }
  function setEquip(dex, on) { data().eq[String(dex)] = !!on; persist(true); sendNet(); }

  function fmt(n) {
    if (n >= 1e6) return (Math.floor(n / 1e4) / 100).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return Math.floor(n / 1e3) + 'K';
    return String(Math.floor(n));
  }

  // ------------------------------------------------------------ counting damage
  function player() { return PS && PS.Game && PS.Game.player; }
  function myDex(p) { return p ? (p.baseDex || p.dex) : 0; }
  function counting() {
    var G = PS.Game, s = G && G.state;
    if (!(s === 'playing' || s === 'held')) return false;
    if (G.training) return false;
    if (PS.Maps && PS.Maps.cur && PS.Maps.cur.bossRush) return false;   // the Boss Rush never counts
    if (PS.DevMenu && PS.DevMenu.on) return false;
    return true;
  }
  function addDmg(n) {
    var p = player(), dex = myDex(p);
    if (!dex || !(n > 0) || !isFinite(n)) return;
    var m = data(), k = String(dex), before = +m.d[k] || 0, after = before + n;
    m.d[k] = after;
    var a = tierIdx(before), b = tierIdx(after);
    if (b > a) {
      var T = TIERS[b];
      try { PS.Spawner.say('MASTERY UP · ' + T.name.toUpperCase() + '!', 3.4, true); PS.Audio.sfx('legend'); } catch (e) {}
      if (a < 0 && !(k in m.eq)) m.eq[k] = true;          // first mastery: equipped automatically
      persist(true); sendNet();
      return;
    }
    persist(false);
  }

  // ------------------------------------------------------------ badge over the Pokémon
  var remote = {};               // uid -> tier id (co-op mates)
  function badgeFor(pl, id) {
    var im = imgs[id];
    if (!im || !im.complete || !im.naturalWidth) return null;
    return {
      y: pl.y + 4,
      draw: function (ctx) {
        var w = BADGE_W, h = w * im.naturalHeight / im.naturalWidth;
        if (h > BADGE_H) { w *= BADGE_H / h; h = BADGE_H; }
        var top = pl.y - (pl.bodyH || 48) - 12 - h;      // just above the HP bar and item counters
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(im, Math.round(pl.x - w / 2), Math.round(top), w, h);
        ctx.restore();
      }
    };
  }
  function drawables() {
    var out = [], p = player();
    if (p && !p.dead && equipped(myDex(p))) { var b = badgeFor(p, tierOf(myDex(p)).id); if (b) out.push(b); }
    if (PS.Coop && PS.Coop.active && PS.Coop.mate) {
      Object.keys(remote).forEach(function (uid) {
        var m = PS.Coop.mate(uid), pl = m && m.pl;
        if (pl && !pl.dead && remote[uid]) { var d = badgeFor(pl, remote[uid]); if (d) out.push(d); }
      });
    }
    return out;
  }

  // ------------------------------------------------------------ co-op
  function coopOn() { return !!(PS.Coop && PS.Coop.active && PS.Net); }
  function myBadge() { var p = player(), d = myDex(p); return d && equipped(d) ? tierOf(d).id : ''; }
  function sendNet() {
    if (!coopOn()) return;
    var msg = { k: 'mast', u: PS.Coop.me, b: myBadge() };
    try { if (PS.Coop.isHost) PS.Net.broadcast(msg); else PS.Net.toHost(msg); } catch (e) {}
  }
  function onNet(from, msg) {
    if (!msg || msg.k !== 'mast' || !coopOn()) return;
    var uid = msg.u || from;
    if (uid === PS.Coop.me) return;
    if (PS.Coop.isHost && from && from !== PS.Coop.me) { try { PS.Net.broadcast(msg, from); } catch (e) {} }
    remote[uid] = typeof msg.b === 'string' && imgs[msg.b] ? msg.b : '';
  }

  // ------------------------------------------------------------ Upgrades panel
  var panel = null;
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#mast-panel{display:flex;gap:14px;align-items:center;margin:10px 0 12px;padding:10px 14px;border-radius:12px;' +
      'background:linear-gradient(180deg,rgba(40,52,110,.55),rgba(20,28,64,.55));border:2px solid #3e5aa8}' +
      '#mast-panel .mp-badge{flex:none;width:118px;height:76px;display:flex;align-items:center;justify-content:center}' +
      '#mast-panel .mp-badge img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:auto}' +
      '#mast-panel .mp-badge .none{font-size:12px;color:#9fb2d8;text-align:center;line-height:1.3}' +
      '#mast-panel .mp-main{flex:1;min-width:0}' +
      '#mast-panel .mp-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
      '#mast-panel .mp-top h4{margin:0;font-size:15px;letter-spacing:.04em;color:#ffd23f}' +
      '#mast-panel .mp-top small{color:#c8d6f2;font-size:12px}' +
      '#mast-panel .mp-top .btn{margin-left:auto}' +
      '#mast-panel .mp-bar{position:relative;height:14px;margin:7px 0 4px;border-radius:7px;background:#0d1530;border:1px solid #4a6ac0;overflow:hidden}' +
      '#mast-panel .mp-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffb020,#ffe066);border-radius:7px}' +
      '#mast-panel .mp-txt{font-size:12px;color:#dfe8ff}' +
      '#mast-panel .mp-tiers{display:flex;gap:4px;margin-top:7px;flex-wrap:wrap}' +
      '#mast-panel .mp-tiers span{width:40px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:6px;' +
      'background:rgba(0,0,0,.25);border:1px solid rgba(160,190,255,.18)}' +
      '#mast-panel .mp-tiers img{max-width:36px;max-height:22px;object-fit:contain}' +
      '#mast-panel .mp-tiers span.lock img{filter:grayscale(1) brightness(.45)}' +
      '#mast-panel .mp-tiers span.past img{filter:grayscale(.7) brightness(.7)}' +
      '#mast-panel .mp-tiers span.cur{border-color:#ffd23f;box-shadow:0 0 8px rgba(255,210,63,.6)}' +
      '@media (max-width:640px){#mast-panel{flex-direction:column;align-items:stretch}#mast-panel .mp-badge{align-self:center}}';
    document.head.appendChild(s);
  }
  function ensurePanel() {
    var scr = document.getElementById('scr-upgrades');
    if (!scr) return null;
    if (panel && scr.contains(panel)) return panel;
    var head = scr.querySelector('.upg-head');
    if (!head) return null;
    panel = document.createElement('div');
    panel.id = 'mast-panel'; panel.setAttribute('translate', 'no');
    panel.innerHTML = '<div class="mp-badge"></div><div class="mp-main"><div class="mp-top"><h4>MASTERY</h4><small class="mp-name"></small>' +
      '<button class="btn small gold mp-eq" type="button"></button></div><div class="mp-bar"><i></i></div>' +
      '<div class="mp-txt"></div><div class="mp-tiers"></div></div>';
    head.parentNode.insertBefore(panel, head.nextSibling);
    panel.querySelector('.mp-eq').onclick = function () {
      var dex = curDex(); if (!dex || !tierOf(dex)) return;
      setEquip(dex, !equipped(dex)); render(true);
      try { PS.Audio.sfx('select'); } catch (e) {}
    };
    return panel;
  }
  function curDex() { var sel = document.getElementById('upg-mon'); return sel && +sel.value || 0; }
  var lastKey = '';
  function render(force) {
    var P = ensurePanel(); if (!P) return;
    var dex = curDex(), dmg = dmgOf(dex), i = tierIdx(dmg), T = i >= 0 ? TIERS[i] : null, N = TIERS[i + 1] || null;
    var eq = equipped(dex);
    var key = dex + '|' + Math.floor(dmg) + '|' + eq;
    if (!force && key === lastKey) return;
    lastKey = key;
    P.querySelector('.mp-badge').innerHTML = T ? '<img src="assets/ui/mastery/' + T.id + '.webp?v=4" alt="' + T.name + '">'
      : '<div class="none">No mastery yet<br>Deal 5M damage<br>to unlock Rookie</div>';
    P.querySelector('.mp-name').textContent = T ? T.name + (eq ? ' · equipped' : '') : 'Locked';
    var b = P.querySelector('.mp-eq');
    b.style.display = T ? '' : 'none';
    b.textContent = eq ? 'Unequip' : 'Equip';
    var from = T ? T.need : 0, to = N ? N.need : TIERS[TIERS.length - 1].need;
    var pct = N ? Math.max(0, Math.min(1, (dmg - from) / (to - from))) : 1;
    P.querySelector('.mp-bar i').style.width = (pct * 100).toFixed(1) + '%';
    P.querySelector('.mp-txt').textContent = N
      ? 'Damage dealt: ' + fmt(dmg) + ' / ' + fmt(N.need) + ' → ' + N.name + ' (' + fmt(N.need - dmg) + ' to go)'
      : 'Damage dealt: ' + fmt(dmg) + ' · Highest mastery reached!';
    P.querySelector('.mp-tiers').innerHTML = TIERS.map(function (t, k) {
      var c = k === i ? 'cur' : k < i ? 'past' : 'lock';
      return '<span class="' + c + '" title="' + t.name + ' · ' + fmt(t.need) + ' damage' + (k < i ? ' (evolved)' : '') + '">' +
        '<img src="assets/ui/mastery/' + t.id + '.webp?v=4" alt=""></span>';
    }).join('');
  }
  function uiLoop() {
    var scr = document.getElementById('scr-upgrades');
    if (scr && !scr.classList.contains('hidden')) render(false);
  }

  // ------------------------------------------------------------ install
  function install() {
    css();
    var S = PS.Stats, dm = S.dmg;
    S.dmg = function (run, id, amount) {
      var r = dm.apply(this, arguments);
      try { if (amount > 0 && counting()) addDmg(+amount); } catch (e) {}
      return r;
    };
    var reset = S.reset;
    S.reset = function () { try { persist(true); remote = {}; setTimeout(sendNet, 1500); } catch (e) {} return reset.apply(this, arguments); };
    var save = PS.Game.saveRun;
    if (typeof save === 'function') PS.Game.saveRun = function () { try { if (dirty) persist(true); } catch (e) {} return save.apply(this, arguments); };
    var drw = PS.Training.drawables;
    PS.Training.drawables = function () {
      var list = drw.apply(this, arguments) || [];
      var d = [];
      try { d = drawables(); } catch (e) {}
      return d.length ? list.concat(d) : list;
    };
    if (PS.Net && PS.Net.on) PS.Net.on(onNet);
    setInterval(function () { try { uiLoop(); } catch (e) { console.error('[mastery]', e); } }, 250);
    setInterval(function () { try { if (dirty) persist(true); if (coopOn()) sendNet(); } catch (e) {} }, 8000);
    window.addEventListener('pagehide', function () { try { persist(true); } catch (e) {} });
    window.__mastery = { TIERS: TIERS, data: data, tierOf: tierOf, equipped: equipped, setEquip: setEquip,
      add: addDmg, render: render };
  }

  var wait = setInterval(function () {
    var ns = window.__PS;
    if (ns && ns.Stats && ns.Stats.dmg && ns.Game && ns.Training && ns.DB && ns.Coop) {
      clearInterval(wait); PS = ns; install();
    }
  }, 50);
})();
