/* =====================================================================
 * BOSS RUSH (map 6) — one legendary at a time, in an alternate version of
 * Arceus's arena.
 *  · Menu: 4 bosses from easiest to hardest. Each one unlocks after the
 *    previous one is beaten. For now only Primal Groudon is available.
 *  · Before the fight: +100 levels to spend and 3 bonds. When you're done
 *    (or press Ready), a 10 → 0 countdown starts and the boss appears.
 *  · The boss uses its in-game moves (Groudon's boss repertoire), scaled up:
 *    more damage, damage reduction, faster casts, a hunting AI and a fury
 *    phase. HP scales with the team (1-4 players) and its defense adapts to
 *    the group's real DPS, so it stays a hard fight even at level 100.
 * Loaded after torre.js/novidades.js/english.js (chains window.__PS).
 * ===================================================================== */
(function () {
  'use strict';

  var BR = 6;
  var PS = null;

  // ------------------------------------------------------------ bosses
  var BOSSES = [
    { id: 'groudon', name: 'Primal Groudon', stars: 1, label: 'Easy', color: '#ff5a3c', glow: 'rgba(255,90,60,.55)',
      img: 'assets/ui/bossrush/groudon.webp', ready: true },
    { id: 'kyogre', name: 'Primal Kyogre', stars: 2, label: 'Medium', color: '#3cb4ff', glow: 'rgba(60,180,255,.55)',
      img: 'assets/ui/bossrush/kyogre.webp', ready: false },
    { id: 'rayquaza', name: 'Mega Rayquaza', stars: 3, label: 'Hard', color: '#45e07a', glow: 'rgba(69,224,122,.55)',
      img: 'assets/ui/bossrush/rayquaza.webp', ready: false },
    { id: 'deoxys', name: 'Deoxys (Attack)', stars: 4, label: 'Extreme', color: '#c86bff', glow: 'rgba(200,107,255,.55)',
      img: 'assets/ui/bossrush/deoxys.webp', ready: false }
  ];

  // Primal Groudon: new sprites, Groudon's in-game boss moves (types decide the repertoire)
  var PRIMAL_SKIN = '383_primal';
  var PRIMAL_META = { s: 2, a: {
    Idle:   { w: 72, h: 80, n: 14, r: 8, d: [60, 10, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10], ax: 35.5, ay: 43.5 },
    Walk:   { w: 72, h: 80, n: 4,  r: 8, d: [10, 12, 10, 12], ax: 35.5, ay: 44 },
    Attack: { w: 88, h: 104, n: 10, r: 8, d: [2, 6, 1, 1, 2, 2, 2, 2, 2, 2], ax: 43.5, ay: 56 },
    Shoot:  { w: 80, h: 88, n: 12, r: 8, d: [2, 2, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 39.5, ay: 48.5 },
    Charge: { w: 64, h: 80, n: 10, r: 8, d: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 32, ay: 43.5 },
    Hurt:   { w: 72, h: 80, n: 2,  r: 8, d: [2, 8], ax: 35.5, ay: 45.5 },
    Faint:  { w: 64, h: 56, n: 2,  r: 1, d: [8, 14], ax: 31.5, ay: 36 }
  } };

  // Difficulty (solo base; team scaling below)
  var TUNE = {
    groudon: {
      hp: 5000000,       // HP for 1 player (×1.8 / ×2.5 / ×3.2 with 2 / 3 / 4 players)
      dmg: 220,          // body / slam / dash damage
      shot: 120,         // projectile / rain damage
      spd: 92,
      castK: 1.75,       // how often it attacks (1 = normal boss)
      armor: 0.35,       // minimum damage reduction (rises with the team's damage)
      target: 150,       // the fight lasts about 150 s
      farMax: 1.2        // never stays away from you for more than 1.2 s
    }
  };
  function teamHp(n) { return [1, 1, 1.8, 2.5, 3.2][Math.max(1, Math.min(4, n))]; }
  function teamDmg(n) { return 1 + 0.12 * (Math.max(1, Math.min(4, n)) - 1); }
  function teamCast(n) { return 1 + 0.08 * (Math.max(1, Math.min(4, n)) - 1); }

  // ------------------------------------------------------------ progress
  var LS = 'ps.bossrush';
  function prog() {
    var s = PS && PS.DB && PS.DB.save, p = s && s.bossRush;
    if (!p) { try { p = JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) {} }
    return p && p.beaten ? p : { beaten: {} };
  }
  function markBeaten(id) {
    var p = prog(); p.beaten[id] = p.beaten[id] || Date.now();
    try { localStorage.setItem(LS, JSON.stringify(p)); } catch (e) {}
    try { if (PS.DB && PS.DB.save) { PS.DB.save.bossRush = p; if (PS.DB.flush) PS.DB.flush(); } } catch (e) {}
  }
  function unlocked(i) { return i === 0 || !!prog().beaten[BOSSES[i - 1].id]; }

  // ------------------------------------------------------------ map
  var arenaBiome = -1;
  var MAP = {
    n: BR, name: 'Boss Rush', bossRush: true,
    get biome() { return arenaBiome >= 0 ? arenaBiome : 4; },
    types: ['ground', 'fire'],
    arceusK: 1, legendK: 1, arceusMin: 0, legendMin: 0,
    // full reward on the first win against each boss, smaller on replays
    get coins() { return st.firstClear ? 60000 : 15000; },
    get t10() { return st.firstClear ? 10 : 2; },
    k: 1, dk: 1, bonus: 0.5,
    diff: 'Boss', col: '#ff5a3c'
  };
  function isBR() { return !!(PS && PS.Maps && PS.Maps.cur && PS.Maps.cur.bossRush); }
  function inRun() { var s = PS && PS.Game && PS.Game.state; return !!s && s !== 'ui' && s !== 'over'; }
  function teamSize() { try { return Math.max(1, PS.Game.everyone().length); } catch (e) { return 1; } }
  function coopOn() { return !!(PS.Coop && PS.Coop.active && PS.Net); }
  function isHost() { return !coopOn() || !!PS.Coop.isHost; }

  // Alternate Arceus arena: same layout as the Judgment ruins, primal lava colors and Drought sun
  function installArena(T) {
    if (!T || !T.BIOMES || !T.ARENA_THEMES || arenaBiome >= 0) return;
    var j = T.ARENA_THEMES.judgment || {};
    T.ARENA_THEMES.primal = Object.assign({}, j, {
      name: 'Primal Ruins', floor: '#3b2622', wall: '#1d1312', liquid: 'lava', liq: '#ff6a1a', foam: '#ffd27a',
      prop: 'dead', leaf: '#3a2621', trunk: '#241614', flowers: ['#ff8d3d', '#ffc45e', '#8a3a2a'],
      grass: '#4a2c24', rock: '#5c3a32', pools: 0.14, pillars: 0.035, props: { tree: 0.006, rock: 0.022 },
      weather: 'sun'
    });
    var jb = T.BIOMES[T.arenaBiome ? T.arenaBiome('judgment') : 21] || {};
    var b = Object.assign({}, jb, {
      name: 'Primal Ruins', liquid: 'lava',
      floor: ['#3b2622', '#432b26', '#36231f'], dirt: ['#2e1d1a', '#33201c', '#2a1a17'], speck: '#281816',
      light: '#7a4a3a', flowers: ['#ff8d3d', '#ffc45e', '#8a3a2a'],
      wallTop: ['#241716', '#2e1d1b', '#211514'], wallLight: '#7a4b40', wallEdge: '#0b0606',
      wallFace: ['#1a100f', '#170e0d'], wallFaceDark: '#110909',
      liq: '#ff6a1a', liqDeep: '#c23a0c', foam: '#ffd27a', shore: '#2a1714',
      prop: 'dead', leaf: ['#2a1916', '#3a2621', '#4a2e27', '#8a5a48'], trunk: ['#1d1210', '#241614'],
      rock: ['#4e332c', '#5c3a32', '#7e5648'], grass: ['#3a221d', '#4a2c24', '#6e4436']
    });
    arenaBiome = T.BIOMES.length;
    T.BIOMES.push(b);
  }

  // ------------------------------------------------------------ run state
  function fresh() {
    return { boss: BOSSES[0].id, phase: 'prep', setup: false, granted: false, ready: false, sentReady: false,
      readyFrom: {}, countT: 0, countShown: -1, fightT: 0, e: null, won: false, winT: 0,
      fury: false, desperate: false, arena: null, autoOpened: false, startWait: 0 };
  }
  var st = fresh();
  var pick = 'groudon';

  function setupArena() {
    var tx = -6400 - Math.floor(1600 * Math.random()), ty = -6400 - Math.floor(1600 * Math.random());
    st.arena = { tx: tx, ty: ty };
    applyArena(tx, ty);
    if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'arena', tx: tx, ty: ty, boss: st.boss }); } catch (e) {} }
  }
  function applyArena(tx, ty) {
    var W = PS.World, TS = W.TS || 32;
    try {
      PS.EnemyMgr.all().slice().forEach(function (e) {
        if (e && !e.dead && !e.remote) PS.EnemyMgr.removeRemote(e.id, false);
      });
    } catch (e) {}
    try { PS.Projectiles.clear(); } catch (e) {}
    try { PS.Pickups.clear(); } catch (e) {}
    try { PS.Hazards && PS.Hazards.clear(); } catch (e) {}
    try { PS.Weather && PS.Weather.clear && PS.Weather.clear(); } catch (e) {}
    W.setArena({ tx: tx, ty: ty, r: 24, type: 'primal' });
    W.setBiome(arenaBiome, true);
    var cx = tx * TS + TS / 2, cy = ty * TS + TS / 2;
    st.center = { x: cx, y: cy };
    var all = [];
    try { all = PS.Game.everyone(); } catch (e) { all = [PS.Game.player]; }
    all.forEach(function (p, i) {
      if (!p || p.remote) return;
      p.x = cx + 34 * (i - (all.length - 1) / 2);
      p.y = cy + 3 * TS;
    });
    var me = PS.Game.player;
    if (me) { PS.Camera.x = me.x; PS.Camera.y = me.y; }
  }

  // +100 levels and 3 bonds (each player on their own game)
  function grantPrep() {
    if (st.granted) return;
    var G = PS.Game, p = G.player;
    if (!p || typeof G.__grantLevels !== 'function') return;
    st.granted = true;
    G.__grantLevels(100);
    p.bonds = (p.bonds || 0) + 3;
    p.hp = p.maxHp;
    say('Boss Rush: +100 levels and 3 bonds! Get ready.', 4);
  }

  function localReady() {
    var G = PS.Game, p = G.player;
    if (!p || !st.granted) return false;
    if (st.ready) return true;
    if ((G.__pending || 0) > 0) return false;
    if (G.state !== 'playing' && G.state !== 'held') return false;
    var bondLeft = (p.bonds || 0) > 0 && !p.bondLater && p.bondOptions && p.bondOptions();
    if (bondLeft) { st.okSince = 0; return false; }
    // the bond window opens a moment after the last card: wait until things settle
    var now = performance.now();
    if (!st.okSince) st.okSince = now;
    return now - st.okSince > 1500;
  }

  function say(t, d) { try { PS.Spawner.say(t, d || 3, true); } catch (e) {} }

  function startCount() {
    if (st.phase !== 'prep') return;
    st.phase = 'count'; st.countT = 10;
    if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'count' }); } catch (e) {} }
    try { PS.Audio.sfx('boss'); } catch (e) {}
  }

  function bossDef() {
    var T = TUNE[st.boss] || TUNE.groudon, n = teamSize();
    return {
      dex: PRIMAL_SKIN, name: 'Primal Groudon',
      hp: Math.round(T.hp * teamHp(n)), spd: T.spd,
      dmg: Math.round(T.dmg * teamDmg(n)), xp: 0,
      behavior: 'chase', shotDmg: Math.round(T.shot * teamDmg(n)), shotCd: 0.7, range: 320
    };
  }
  function spawnBoss() {
    var T = TUNE[st.boss] || TUNE.groudon, TS = PS.World.TS || 32, c = st.center || { x: 0, y: 0 };
    var e = new PS.Enemy(bossDef(), c.x, c.y - 5 * TS, { hp: 1, dmg: 1, spd: 1 }, true);
    e.types = ['ground', 'fire']; e.atkType = 'ground';
    e.brBoss = true;
    e.castK = T.castK * teamCast(teamSize());
    try { e.bossInit(); e.ai.farLike = 0.2; e.ai.mode = 'close'; e.ai.modeT = 8; } catch (er) {}
    e.brK = 1 - T.armor;
    var hurt = e.hurt;
    e.hurt = function (amount) {
      var a = Array.prototype.slice.call(arguments);
      st.rawAcc = (st.rawAcc || 0) + (+amount || 0);
      a[0] = amount * (this.brK || (1 - T.armor));
      var r = hurt.apply(this, a), now = performance.now();
      // under heavy fire the white hit flash hid the sprite: flash at most 4× per second
      if (now - (this._brFlash || 0) < 250) this.flash = 0; else this._brFlash = now;
      return r;
    };
    PS.EnemyMgr.add(e);
    st.e = e; st.fightT = 0; st.rawAcc = 0; st.winT2 = 0; st.rawDps = 0;
    try { PS.Sprites.preload([PRIMAL_SKIN], 4000); } catch (er) {}
    say('Primal Groudon awakens! The land dries up…', 4);
    try { PS.Camera.kick(1.6); PS.Audio.sfx('legend'); PS.Game.flash && PS.Game.flash('#ff7a2a', 0.6); } catch (er) {}
  }

  // Adaptive defense: the HP bar never jumps. Every 2 s the boss measures the
  // team's raw damage and sets how much of it actually lands, so the remaining
  // HP lasts until about `target` seconds — whatever the build or team size.
  function adapt(dt) {
    var e = st.e, T = TUNE[st.boss] || TUNE.groudon;
    if (!e || e.dead) return;
    st.winT2 = (st.winT2 || 0) + dt;
    if (st.winT2 < 2) return;
    var raw = st.rawAcc / st.winT2;               // raw team DPS in the last window
    st.rawAcc = 0; st.winT2 = 0;
    st.rawDps = st.rawDps ? st.rawDps * 0.5 + raw * 0.5 : raw;
    if (st.rawDps <= 0) return;
    var left = Math.max(20, T.target - st.fightT);
    var want = (e.hp / left) / st.rawDps;          // fraction of the damage that should land
    want = Math.max(0.00002, Math.min(1 - T.armor, want));
    // last stretch: the defense only goes down, so the end never drags on
    if (T.target - st.fightT < 25 && e.brK && want < e.brK) return;
    e.brK = e.brK ? e.brK * 0.4 + want * 0.6 : want;
  }

  function fightTick(dt) {
    var e = st.e, T = TUNE[st.boss] || TUNE.groudon;
    if (!e) return;
    st.fightT += dt;
    if (e.dead) {
      if (!st.won) {
        st.won = true; st.winT = 0;
        markBeaten(st.boss);
        say('PRIMAL GROUDON IS DEFEATED!', 5);
        try { PS.Audio.sfx('legend'); } catch (er) {}
        if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'won', boss: st.boss }); } catch (er) {} }
      }
      return;
    }
    if (PS.EnemyMgr.all().indexOf(e) < 0) { PS.EnemyMgr.add(e); }
    if (e.ai) {
      if (e.ai.mode === 'far' && e.ai.modeT > T.farMax) e.ai.modeT = T.farMax;
      if (e.ai.cd > 1.4) e.ai.cd = 1.4;
    }
    if (!st.fury && e.hp < 0.5 * e.maxHp) {
      st.fury = true;
      e.castK *= 1.2; e.spd *= 1.15; e.dmg *= 1.2;
      say('Primal Groudon is enraged! Desolate Land grows stronger!', 3.4);
      try { PS.Camera.kick(1.2); } catch (er) {}
    }
    if (!st.desperate && e.hp < 0.2 * e.maxHp) {
      st.desperate = true;
      e.castK *= 1.15;
      say('Precipice Blades! Primal Groudon fights with everything it has!', 3.4);
    }
    adapt(dt);
  }

  // Host / solo: called instead of the normal spawner (no hordes in the Boss Rush)
  function hostTick(dt, players) {
    if (!st.setup) {
      st.setup = true; st.boss = pick || 'groudon';
      setupArena();
      return;
    }
    if (st.won) {
      st.winT += dt;
      if (st.winT > 2.6 && !st.winSent) { st.winSent = true; try { PS.Game.winRun(BR); } catch (e) {} }
      return;
    }
    if (st.phase === 'prep') {
      var all = [];
      try { all = PS.Game.everyone(); } catch (e) {}
      var need = coopOn() ? (PS.Coop.members || []).length || all.length : 1;
      var ready = (localReady() ? 1 : 0);
      if (coopOn()) for (var u in st.readyFrom) if (st.readyFrom[u] && u !== PS.Coop.me) ready++;
      if (ready >= need) startCount();
    } else if (st.phase === 'count') {
      st.countT -= dt;
      if (st.countT <= 0) { st.phase = 'fight'; spawnBoss(); }
    } else if (st.phase === 'fight') {
      fightTick(dt);
    }
  }

  // ------------------------------------------------------------ net (co-op)
  function onNet(from, msg) {
    if (!msg || msg.k !== 'br' || !PS) return;
    if (msg.t === 'arena') {
      if (isHost()) return;
      st = fresh(); st.setup = true; st.boss = msg.boss || 'groudon'; st.firstClear = !prog().beaten[st.boss];
      st.arena = { tx: msg.tx, ty: msg.ty };
      try { applyArena(msg.tx, msg.ty); } catch (e) { console.error('[bossrush arena]', e); }
    } else if (msg.t === 'ready') {
      if (isHost()) st.readyFrom[msg.u || from] = 1;
    } else if (msg.t === 'count') {
      if (!isHost()) { st.phase = 'count'; st.countT = 10; }
    } else if (msg.t === 'won') {
      markBeaten(msg.boss || 'groudon');
      if (!isHost()) st.won = true;
    }
  }

  // ------------------------------------------------------------ UI in the run
  var ui = null;
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#br-prep{position:fixed;left:12px;top:12px;z-index:62;display:none;width:min(330px,calc(100vw - 24px));box-sizing:border-box;' +
      'padding:10px 16px 12px;border-radius:14px;background:linear-gradient(180deg,rgba(60,16,10,.95),rgba(24,8,8,.95));' +
      'border:2px solid #ff7a3c;box-shadow:0 0 18px rgba(255,90,40,.45);text-align:center;color:#fff;font-weight:700}' +
      '#br-prep h4{margin:0 0 4px;font-size:18px;letter-spacing:.06em;color:#ffcf6a}' +
      '#br-prep p{margin:2px 0;font-size:13px;color:#ffe2c8}' +
      '#br-prep .br-st{margin:6px 0 8px;font-size:14px;color:#fff}' +
      '#br-prep .br-st b{color:#ffd23f}' +
      '#br-prep button{pointer-events:auto}' +
      '#br-count{position:fixed;inset:0;z-index:26;display:none;align-items:center;justify-content:center;pointer-events:none;flex-direction:column}' +
      '#br-count .n{font-weight:900;font-size:min(26vh,180px);line-height:1;color:#ffd23f;text-shadow:0 6px 0 #6a1a00,0 0 40px rgba(255,120,30,.9);' +
      'animation:brPop .9s ease-out}' +
      '#br-count .s{margin-top:6px;font-weight:800;font-size:20px;color:#ffe2c8;text-shadow:0 2px 0 #000;letter-spacing:.08em}' +
      '@keyframes brPop{0%{transform:scale(1.8);opacity:0}25%{opacity:1}100%{transform:scale(1);opacity:.92}}' +
      '@media (max-height:520px){#br-prep{top:4px;left:4px;padding:6px 10px}#br-prep h4{font-size:14px}#br-prep p{font-size:11px}}';
    document.head.appendChild(s);
  }
  function ensureUi() {
    if (ui) return ui;
    css();
    var prep = document.createElement('div'); prep.id = 'br-prep'; prep.setAttribute('translate', 'no');
    prep.innerHTML = '<h4>BOSS RUSH · PRIMAL GROUDON</h4>' +
      '<p>Spend your <b>100 level-ups</b> (★ box or Shift) and your <b>3 bonds</b>.</p>' +
      '<div class="br-st"></div>' +
      '<button class="btn gold small" type="button">Ready!</button>';
    var count = document.createElement('div'); count.id = 'br-count'; count.setAttribute('translate', 'no');
    count.innerHTML = '<div class="n"></div><div class="s">GET READY</div>';
    document.body.appendChild(prep); document.body.appendChild(count);
    prep.querySelector('button').onclick = function () {
      st.ready = true;
      try { PS.Audio.sfx('confirm'); } catch (e) {}
    };
    ui = { prep: prep, count: count, st: prep.querySelector('.br-st'), btn: prep.querySelector('button'), n: count.querySelector('.n'), s: count.querySelector('.s') };
    return ui;
  }

  function uiLoop() {
    requestAnimationFrame(uiLoop);
    if (!PS || !PS.Game) return;
    var u = ensureUi();
    var on = isBR() && inRun();
    if (!on) { u.prep.style.display = 'none'; u.count.style.display = 'none'; return; }
    // every client gets its own +100 levels and 3 bonds once the arena is ready
    if (st.setup && !st.granted && (PS.Game.state === 'playing' || PS.Game.state === 'held')) grantPrep();
    // solo: open the level-up cards once (they chain by themselves after each pick;
    // if you close them with Shift they stay closed until you open them again)
    if (st.phase === 'prep' && st.granted && !coopOn() && !st.ready && !st.autoOpened &&
        PS.Game.state === 'playing' && (PS.Game.__pending || 0) > 0) {
      var now = performance.now();
      if (now - (st.lastOpen || 0) > 600) {
        st.lastOpen = now;
        try { if (PS.Game.__openLevelUp()) st.autoOpened = true; } catch (e) {}
      }
    }
    if (st.phase === 'prep' && st.granted) {
      var G = PS.Game, p = G.player, left = G.__pending || 0, bonds = (p && p.bonds) || 0;
      var ready = localReady();
      if (ready && coopOn() && !isHost() && !st.sentReady) {
        st.sentReady = true;
        try { PS.Net.toHost({ k: 'br', t: 'ready', u: PS.Coop.me }); } catch (e) {}
      }
      var txt = 'Level-ups left: <b>' + left + '</b> · Bonds left: <b>' + bonds + '</b>';
      if (ready) txt = coopOn() ? 'You are ready! Waiting for the team…' : 'Ready! The fight is about to begin…';
      if (u.st.innerHTML !== txt) u.st.innerHTML = txt;
      // Ready! only while no card/bond window is open (the game is paused under it)
      u.btn.style.display = (ready || (G.state !== 'playing' && G.state !== 'held')) ? 'none' : '';
      u.prep.style.display = 'block';
    } else u.prep.style.display = 'none';
    if (st.phase === 'count' && !isHost()) st.countT -= 1 / 60;
    if (st.phase === 'count') {
      var n = Math.max(0, Math.ceil(st.countT));
      if (n !== st.countShown) {
        st.countShown = n;
        u.n.textContent = n > 0 ? n : 'FIGHT!';
        u.s.textContent = n > 0 ? 'PRIMAL GROUDON APPROACHES' : '';
        u.n.style.animation = 'none'; void u.n.offsetWidth; u.n.style.animation = '';
        try { PS.Audio.sfx(n > 0 ? 'click' : 'boss'); } catch (e) {}
      }
      u.count.style.display = 'flex';
    } else if (st.phase === 'fight' && st.fightT < 0.8) {
      u.n.textContent = 'FIGHT!'; u.s.textContent = ''; u.count.style.display = 'flex';
    } else u.count.style.display = 'none';
  }

  // ------------------------------------------------------------ selection screen
  var sel = null;
  function selCss() {
    var s = document.createElement('style');
    s.textContent =
      '#br-select{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;padding:16px;' +
      'background:#05060f url(assets/ui/bossrush/bg.webp) center/cover no-repeat}' +
      '#br-select.show{display:flex}' +
      '#br-select::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(5,6,20,.72),rgba(3,4,12,.94))}' +
      '#br-select .brs{position:relative;width:min(1100px,100%);max-height:100%;overflow:auto;text-align:center}' +
      '#br-select h2{margin:0 auto 18px;display:inline-block;padding:6px 44px 10px;font:900 clamp(30px,6vw,64px)/1 inherit;letter-spacing:.08em;' +
      'color:#e8f2ff;text-shadow:0 3px 0 #3a4a7a,0 6px 0 #11182e,0 0 22px rgba(120,170,255,.6);' +
      'background:linear-gradient(180deg,rgba(20,26,54,.92),rgba(10,14,30,.92));border:2px solid #5a6ea8;border-top:none;' +
      'clip-path:polygon(0 0,100% 0,94% 100%,6% 100%)}' +
      '#br-select .brs-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:clamp(8px,1.6vw,22px)}' +
      '#br-select .brc{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px 12px;border-radius:12px;' +
      'background:rgba(8,10,24,.6);border:2px solid transparent;color:#fff;font:inherit;cursor:pointer;transition:transform .15s}' +
      '#br-select .brc:not(.off):hover{transform:translateY(-4px)}' +
      '#br-select .brc .stars{font-size:14px;font-weight:800;color:#e8eefc}' +
      '#br-select .brc .stars i{font-style:normal;letter-spacing:1px;color:var(--c)}#br-select .brc .stars i.e{color:#5a6280}' +
      '#br-select .brc .art{position:relative;width:100%;aspect-ratio:196/200;border-radius:6px;overflow:hidden;border:3px solid var(--c);' +
      'box-shadow:0 0 0 3px #0b0f20,0 0 22px var(--g);background:#000}' +
      '#br-select .brc .art img{width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block}' +
      '#br-select .brc .nm{font-weight:900;font-size:clamp(14px,1.8vw,22px);letter-spacing:.03em;padding:4px 10px;background:rgba(0,0,0,.5);border-radius:6px;width:100%;box-sizing:border-box}' +
      '#br-select .brc .lb{font-weight:800;font-size:clamp(13px,1.5vw,18px);color:var(--c)}' +
      '#br-select .brc .go{margin-top:2px;padding:6px 18px;border-radius:9px;font-weight:900;background:linear-gradient(180deg,#ffd23f,#f0a11a);color:#2a1600;' +
      'box-shadow:0 3px 0 #8a5a12}' +
      '#br-select .brc .done{position:absolute;top:44px;right:16px;z-index:2;padding:2px 8px;border-radius:7px;background:#1f8f4d;color:#eafff0;font-size:12px;font-weight:900}' +
      '#br-select .brc.off{cursor:default}' +
      '#br-select .brc.off .art img{filter:grayscale(.85) brightness(.45)}' +
      '#br-select .brc .lock{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:4px;' +
      'font-weight:900;font-size:clamp(14px,1.9vw,22px);color:#fff;text-shadow:0 2px 0 #000,0 0 12px rgba(0,0,0,.9)}' +
      '#br-select .brc .lock small{font-size:12px;font-weight:700;color:#cfd8f0}' +
      '#br-select .brs-foot{margin-top:18px;display:flex;justify-content:center;gap:10px}' +
      '@media (max-width:760px){#br-select .brs-row{grid-template-columns:repeat(2,minmax(0,1fr))}}';
    document.head.appendChild(s);
  }
  function starStr(n) { var s = ''; for (var i = 0; i < 4; i++) s += '<i' + (i < n ? '' : ' class="e"') + '>★</i>'; return s; }
  function buildSel() {
    if (sel) return sel;
    selCss();
    sel = document.createElement('div'); sel.id = 'br-select'; sel.setAttribute('translate', 'no');
    sel.innerHTML = '<div class="brs"><h2>BOSS RUSH</h2><div class="brs-row"></div>' +
      '<div class="brs-foot"><button class="btn" type="button" data-br="back">Back</button></div></div>';
    document.body.appendChild(sel);
    sel.querySelector('[data-br="back"]').onclick = closeSel;
    sel.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSel(); });
    return sel;
  }
  function renderSel() {
    var row = buildSel().querySelector('.brs-row'), p = prog();
    row.innerHTML = '';
    BOSSES.forEach(function (b, i) {
      var open = b.ready && unlocked(i);
      var c = document.createElement('button');
      c.type = 'button';
      c.className = 'brc' + (open ? '' : ' off');
      c.style.setProperty('--c', b.color); c.style.setProperty('--g', b.glow);
      var lock = '';
      if (!b.ready) lock = '<div class="lock">Coming Soon...</div>';
      else if (!open) lock = '<div class="lock">🔒<small>Defeat ' + BOSSES[i - 1].name + ' first</small></div>';
      c.innerHTML = '<div class="stars">Difficulty: ' + starStr(b.stars) + '</div>' +
        '<div class="art"><img src="' + b.img + '" alt="' + b.name + '">' + lock + '</div>' +
        (p.beaten[b.id] ? '<span class="done">✔ Defeated</span>' : '') +
        '<div class="nm">' + b.name.toUpperCase() + '</div><div class="lb">' + b.label + '</div>' +
        (open ? '<span class="go">Fight!</span>' : '');
      if (open) c.onclick = function () { startBoss(b.id); };
      row.appendChild(c);
    });
  }
  function openSel() { renderSel(); sel.classList.add('show'); try { PS.Audio.sfx('click'); } catch (e) {} }
  function closeSel() { if (sel) sel.classList.remove('show'); }

  var bypass = false;
  function startBoss(id) {
    pick = id;
    closeSel();
    var btn = document.querySelector('#scr-menu .pp-play[data-go="play"]');
    if (!btn) return;
    bypass = true;
    try { btn.click(); } finally { bypass = false; }
  }
  // The Play button on map 6 opens the Boss Rush menu
  document.addEventListener('click', function (e) {
    if (bypass || !PS || !PS.Maps) return;
    var b = e.target && e.target.closest && e.target.closest('#scr-menu .pp-play[data-go="play"]');
    if (!b) return;
    var cur = null;
    try { cur = PS.Maps.selected ? PS.Maps.selected() : null; } catch (er) {}
    if (cur !== BR) return;
    if (coopOn() && !PS.Coop.isHost) return;
    e.preventDefault(); e.stopImmediatePropagation();
    openSel();
  }, true);

  // ------------------------------------------------------------ hooks
  function hookAfter(ns, name, fn) {
    var d = Object.getOwnPropertyDescriptor(ns, name);
    if (d && 'value' in d && d.value) { try { fn(d.value); } catch (e) { console.error('[bossrush]', name, e); } }
    var prevGet = d && d.get, prevSet = d && d.set, val = d && d.value;
    Object.defineProperty(ns, name, {
      configurable: true, enumerable: true,
      get: function () { return prevGet ? prevGet() : val; },
      set: function (v) {
        if (prevSet) prevSet(v); else val = v;
        try { fn(prevGet ? prevGet() : v); } catch (e) { console.error('[bossrush]', name, e); }
      }
    });
  }

  function install(ns) {
    PS = ns;
    hookAfter(ns, 'SPRITE_META', function (M) { if (M) M[PRIMAL_SKIN] = PRIMAL_META; });
    hookAfter(ns, 'DEX_BY', function (D) {
      if (!D) return;
      Object.defineProperty(D, PRIMAL_SKIN, { configurable: true, enumerable: false, get: function () {
        var g = D[383] || {};
        return Object.assign({}, g, { dex: PRIMAL_SKIN, name: 'Primal Groudon', types: ['ground', 'fire'], leg: true });
      } });
    });
    hookAfter(ns, 'Tiles', function (T) { installArena(T); });
    hookAfter(ns, 'Maps', function (M) {
      if (!M || M.__br) return;
      M.__br = true;
      if (M.LIST.indexOf(MAP) < 0) M.LIST.push(MAP);
      var isOpen = M.isOpen, selected = M.selected, set = M.set;
      M.isOpen = function (n) { return n === BR ? true : isOpen.apply(this, arguments); };
      M.selected = function () {
        var s = PS.DB && PS.DB.save;
        if (s && s.mapSel === BR) return BR;
        return selected.apply(this, arguments);
      };
      M.set = function (n) {
        if ((n | 0) === BR) st = fresh();
        return set.apply(this, arguments);
      };
    });
    hookAfter(ns, 'Spawner', function (S) {
      if (!S || S.__br) return;
      S.__br = true;
      var update = S.update, reset = S.reset;
      S.reset = function () {
        var r = reset.apply(this, arguments);
        if (isBR()) { st = fresh(); st.boss = pick || 'groudon'; st.firstClear = !prog().beaten[st.boss]; }
        return r;
      };
      S.update = function (dt, players) {
        if (!isBR()) return update.apply(this, arguments);
        try { hostTick(dt, Array.isArray(players) ? players : [players]); } catch (e) { console.error('[bossrush]', e); }
        if (S.tickBanner) S.tickBanner(dt);
      };
    });
    hookAfter(ns, 'Rift', function (R) {
      if (!R || R.__br) return; R.__br = true;
      var u = R.update; R.update = function () { if (isBR()) return; return u.apply(this, arguments); };
    });
    hookAfter(ns, 'Judgment', function (J) {
      if (!J || J.__br) return; J.__br = true;
      var u = J.update; J.update = function () { if (isBR()) return; return u.apply(this, arguments); };
    });
    hookAfter(ns, 'Net', function (N) { if (N && N.on && !N.__br) { N.__br = true; N.on(onNet); } });
    requestAnimationFrame(uiLoop);
    window.__bossrush = { state: function () { return st; }, BOSSES: BOSSES, TUNE: TUNE, open: openSel,
      start: startBoss, prog: prog };
  }

  var d = Object.getOwnPropertyDescriptor(window, '__PS');
  var prevGet = d && d.get, prevSet = d && d.set, own;
  Object.defineProperty(window, '__PS', {
    configurable: true,
    get: function () { return prevGet ? prevGet() : own; },
    set: function (v) {
      if (prevSet) prevSet(v); else own = v;
      try { install(v); } catch (e) { console.error('[bossrush]', e); }
    }
  });
})();
