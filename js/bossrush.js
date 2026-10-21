/* =====================================================================
 * BOSS RUSH (map 6) — one legendary at a time, in an alternate version of
 * Arceus's arena.
 *  · Menu: 4 bosses from easiest to hardest (Primal Groudon < Primal Kyogre <
 *    Mega Rayquaza < Deoxys Attack). Each one unlocks after the previous one
 *    is beaten. Each has its own closed arena and weather.
 *  · Before the fight: 50 points for Vigor/Power/Armor/Synthesis/Precision/Reflexes/Sprint,
 *    then 4 moves from the Pokémon's pool (max level, already evolved when the move has an
 *    evolution, bonded together), then 1 item. When you're done
 *    (or press Ready), a 10 → 0 countdown starts and the boss appears.
 *  · Each boss uses its in-game boss moves (decided by its types), scaled up:
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
  // Difficulty goes up in this order: Groudon < Kyogre < Rayquaza < Deoxys.
  var BOSSES = [
    { id: 'groudon', name: 'Primal Groudon', stars: 1, label: 'Easy', color: '#ff5a3c', glow: 'rgba(255,90,60,.55)',
      img: 'assets/ui/bossrush/groudon.webp', ready: true,
      skin: '383_primal', base: 383, types: ['ground', 'fire'], behavior: 'chase', farLike: 0.2, arena: 'primal', flash: '#ff7a2a',
      say: { wake: 'Primal Groudon awakens! The land dries up…', fury: 'Primal Groudon is enraged! Desolate Land grows stronger!',
        last: 'Precipice Blades! Primal Groudon fights with everything it has!' } },
    { id: 'kyogre', name: 'Primal Kyogre', stars: 2, label: 'Medium', color: '#3cb4ff', glow: 'rgba(60,180,255,.55)',
      img: 'assets/ui/bossrush/kyogre.webp', ready: true,
      skin: '382_primal', base: 382, types: ['water'], behavior: 'ranged', farLike: 0.45, arena: 'abyss', flash: '#3cb4ff',
      say: { wake: 'Primal Kyogre rises from the deep! The sea floods the arena…', fury: 'Primal Kyogre is enraged! Primordial Sea rages!',
        last: 'Origin Pulse! Primal Kyogre unleashes the whole ocean!' } },
    { id: 'rayquaza', name: 'Mega Rayquaza', stars: 3, label: 'Hard', color: '#45e07a', glow: 'rgba(69,224,122,.55)',
      img: 'assets/ui/bossrush/rayquaza.webp', ready: true,
      skin: '384_mega', base: 384, types: ['dragon', 'flying'], behavior: 'charger', farLike: 0.25, arena: 'sky', flash: '#45e07a',
      say: { wake: 'Mega Rayquaza descends from the sky! Delta Stream howls…', fury: 'Mega Rayquaza is enraged! The winds tear the sky apart!',
        last: 'Dragon Ascent! Mega Rayquaza strikes with all its power!' } },
    { id: 'deoxys', name: 'Deoxys (Attack)', stars: 4, label: 'Extreme', color: '#c86bff', glow: 'rgba(200,107,255,.55)',
      img: 'assets/ui/bossrush/deoxys.webp', ready: true,
      skin: '386_attack', base: 386, types: ['psychic'], behavior: 'chase', farLike: 0.3, arena: 'cosmos', flash: '#c86bff',
      say: { wake: 'Deoxys falls from space! The stars go silent…', fury: 'Deoxys is enraged! Its attack power explodes!',
        last: 'Psycho Boost! Deoxys gives everything it has!' } }
  ];
  var BY = {}; BOSSES.forEach(function (b) { BY[b.id] = b; });
  function boss() { return BY[st.boss] || BOSSES[0]; }

  // New sprites (frame grids measured from the sheets)
  var METAS = {
    '383_primal': { s: 2, a: {
      Idle:   { w: 72, h: 80, n: 14, r: 8, d: [60, 10, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 10], ax: 35.5, ay: 43.5 },
      Walk:   { w: 72, h: 80, n: 4,  r: 8, d: [10, 12, 10, 12], ax: 35.5, ay: 44 },
      Attack: { w: 88, h: 104, n: 10, r: 8, d: [2, 6, 1, 1, 2, 2, 2, 2, 2, 2], ax: 43.5, ay: 56 },
      Shoot:  { w: 80, h: 88, n: 12, r: 8, d: [2, 2, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 39.5, ay: 48.5 },
      Charge: { w: 64, h: 80, n: 10, r: 8, d: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 32, ay: 43.5 },
      Hurt:   { w: 72, h: 80, n: 2,  r: 8, d: [2, 8], ax: 35.5, ay: 45.5 },
      Faint:  { w: 64, h: 56, n: 2,  r: 1, d: [8, 14], ax: 31.5, ay: 36 } } },
    '382_primal': { s: 2, a: {
      Idle:   { w: 64, h: 72, n: 10, r: 8, d: [10, 14, 14, 14, 14, 10, 14, 14, 14, 14], ax: 31, ay: 40 },
      Walk:   { w: 64, h: 72, n: 10, r: 8, d: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8], ax: 31, ay: 40 },
      Attack: { w: 80, h: 72, n: 10, r: 8, d: [2, 6, 1, 1, 2, 2, 2, 2, 2, 2], ax: 39, ay: 48 },
      Shoot:  { w: 72, h: 72, n: 11, r: 8, d: [2, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 35, ay: 43 },
      Charge: { w: 64, h: 64, n: 10, r: 8, d: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 31.5, ay: 34.5 },
      Hurt:   { w: 64, h: 88, n: 2,  r: 8, d: [2, 8], ax: 31.5, ay: 45 },
      Faint:  { w: 64, h: 72, n: 6,  r: 1, d: [4, 4, 4, 6, 8, 14], ax: 30.8, ay: 42 } } },
    '384_mega': { s: 2, a: {
      Idle:   { w: 144, h: 136, n: 10, r: 8, d: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8], ax: 71.2, ay: 71.5 },
      Walk:   { w: 144, h: 128, n: 4,  r: 8, d: [8, 8, 8, 8], ax: 71.5, ay: 68 },
      Attack: { w: 176, h: 144, n: 10, r: 8, d: [2, 4, 1, 1, 1, 2, 2, 2, 2, 2], ax: 88, ay: 76 },
      Shoot:  { w: 120, h: 136, n: 11, r: 8, d: [2, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 59.5, ay: 76 },
      Charge: { w: 128, h: 136, n: 10, r: 8, d: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 64.2, ay: 64.5 },
      Hurt:   { w: 104, h: 144, n: 2,  r: 8, d: [2, 8], ax: 52.8, ay: 71 },
      Faint:  { w: 72, h: 96, n: 8,  r: 1, d: [4, 4, 4, 4, 4, 6, 8, 14], ax: 41, ay: 53.5 } } },
    '386_attack': { s: 2, a: {
      Idle:   { w: 40, h: 64, n: 4,  r: 8, d: [12, 12, 12, 12], ax: 20, ay: 30 },
      Walk:   { w: 40, h: 64, n: 10, r: 8, d: [6, 6, 6, 6, 6, 6, 6, 6, 6, 6], ax: 19.5, ay: 28.5 },
      Attack: { w: 72, h: 80, n: 11, r: 8, d: [2, 6, 1, 1, 1, 2, 2, 2, 2, 2, 2], ax: 35.5, ay: 40 },
      Shoot:  { w: 48, h: 72, n: 10, r: 8, d: [2, 2, 2, 8, 1, 1, 2, 3, 2, 4], ax: 24, ay: 35 },
      Charge: { w: 40, h: 56, n: 10, r: 8, d: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 20, ay: 27 },
      Hurt:   { w: 40, h: 64, n: 2,  r: 8, d: [2, 8], ax: 20, ay: 31 },
      Faint:  { w: 32, h: 56, n: 2,  r: 1, d: [8, 14], ax: 16, ay: 27.5 } } }
  };

  // Difficulty (solo base; team scaling below). Each boss is stronger than the previous one.
  //   hp: HP for 1 player (×1.8 / ×2.5 / ×3.2 with 2 / 3 / 4 players) · dmg: body/slam/dash ·
  //   shot: projectiles/rain · castK: how often it attacks (1 = normal boss) ·
  //   armor: minimum damage reduction (rises with the team's damage) · target: fight length (s) ·
  //   farMax: longest time it stays away from you (s)
  var TUNE = {
    // 20-10-2026 buff (players found it too easy): ~+45% damage, faster attacks and movement, longer fights
    // + HP ×1.35 and defense ×1.25; the adaptive fight length grows by the same 1.35 × 1.25
    groudon:  { hp: 6750000,  dmg: 215, shot: 115, spd: 102, castK: 2.10, armor: 0.44, target: 312, farMax: 1.0 },
    kyogre:   { hp: 8100000,  dmg: 265, shot: 145, spd: 106, castK: 2.35, armor: 0.50, target: 338, farMax: 1.3 },
    rayquaza: { hp: 9450000,  dmg: 315, shot: 175, spd: 130, castK: 2.60, armor: 0.56, target: 363, farMax: 0.8 },
    deoxys:   { hp: 10800000, dmg: 375, shot: 210, spd: 145, castK: 2.95, armor: 0.62, target: 388, farMax: 0.7 }
  };
  function teamHp(n) { return [1, 1, 1.8, 2.5, 3.2][Math.max(1, Math.min(4, n))]; }
  function teamDmg(n) { return 1 + 0.15 * (Math.max(1, Math.min(4, n)) - 1); }
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
  var MAP = {
    n: BR, name: 'Boss Rush', bossRush: true,
    get biome() { var A = ARENAS[boss().arena]; return A && A.biome >= 0 ? A.biome : 4; },
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

  // Closed arenas (same ring of walls as Arceus's Judgment arena), one per boss
  var ARENAS = {
    primal: { from: 'judgment', weather: 'sun',
      theme: { name: 'Primal Ruins', floor: '#3b2622', wall: '#1d1312', liquid: 'lava', liq: '#ff6a1a', foam: '#ffd27a',
        prop: 'dead', leaf: '#3a2621', trunk: '#241614', flowers: ['#ff8d3d', '#ffc45e', '#8a3a2a'],
        grass: '#4a2c24', rock: '#5c3a32', pools: 0.14, pillars: 0.035, props: { tree: 0.006, rock: 0.022 } },
      pal: { name: 'Primal Ruins', liquid: 'lava',
        floor: ['#3b2622', '#432b26', '#36231f'], dirt: ['#2e1d1a', '#33201c', '#2a1a17'], speck: '#281816',
        light: '#7a4a3a', flowers: ['#ff8d3d', '#ffc45e', '#8a3a2a'],
        wallTop: ['#241716', '#2e1d1b', '#211514'], wallLight: '#7a4b40', wallEdge: '#0b0606',
        wallFace: ['#1a100f', '#170e0d'], wallFaceDark: '#110909',
        liq: '#ff6a1a', liqDeep: '#c23a0c', foam: '#ffd27a', shore: '#2a1714',
        prop: 'dead', leaf: ['#2a1916', '#3a2621', '#4a2e27', '#8a5a48'], trunk: ['#1d1210', '#241614'],
        rock: ['#4e332c', '#5c3a32', '#7e5648'], grass: ['#3a221d', '#4a2c24', '#6e4436'] } },
    abyss: { from: 'water', weather: 'storm',
      theme: { name: 'Primordial Abyss', floor: '#15405a', wall: '#0c2236', liquid: 'water', liq: '#1e6fd0', foam: '#bfeaff',
        prop: 'crystal', leaf: '#2a9ac0', trunk: '#14385a', flowers: ['#7ef0d0', '#5fd0e8', '#ffffff'],
        grass: '#1e6a88', rock: '#2c5a78', pools: 0.26, pillars: 0.03, props: { tree: 0.012, rock: 0.015 } },
      pal: { name: 'Primordial Abyss', liquid: 'water',
        floor: ['#123a52', '#15405a', '#10354c'], dirt: ['#0e2e42', '#103248', '#0c2a3c'], speck: '#0b2638',
        light: '#3a7aa0', flowers: ['#7ef0d0', '#5fd0e8', '#ffffff'],
        wallTop: ['#0c2236', '#102a40', '#0a1e30'], wallLight: '#3f7fa8', wallEdge: '#03080e',
        wallFace: ['#081826', '#071522'], wallFaceDark: '#040c14',
        liq: '#1e6fd0', liqDeep: '#0e3f8a', foam: '#bfeaff', shore: '#0b2133',
        prop: 'crystal', leaf: ['#1a6a8a', '#2a9ac0', '#5fd0e8', '#bff4ff'], trunk: ['#0e2a40', '#14385a'],
        rock: ['#1e4560', '#2c5a78', '#4a7f9f'], grass: ['#14506a', '#1e6a88', '#3f8aa8'] } },
    sky: { from: 'flying', weather: 'winds',
      theme: { name: 'Sky Pillar Summit', floor: '#a9bfdc', wall: '#e6eef8', liquid: 'water', liq: '#cfe6ff', foam: '#ffffff',
        prop: 'tree', leaf: '#e2eefb', trunk: '#9aa8c0', flowers: ['#ffffff', '#ffe14d', '#bfe0ff'],
        grass: '#b4cae2', rock: '#c8d4e4', pools: 0.06, pillars: 0.03, props: { tree: 0.012, rock: 0.012 } },
      pal: { name: 'Sky Pillar Summit', liquid: 'water',
        floor: ['#a9bfdc', '#b3c8e3', '#9fb6d4'], dirt: ['#94acc9', '#9bb2ce', '#8ea5c2'], speck: '#8aa0bd',
        light: '#e8f2ff', flowers: ['#ffffff', '#ffe14d', '#bfe0ff'],
        wallTop: ['#e6eef8', '#f0f6fd', '#dde7f3'], wallLight: '#ffffff', wallEdge: '#5c6f8a',
        wallFace: ['#b9c8dc', '#aebfd5'], wallFaceDark: '#8a9ab3',
        liq: '#cfe6ff', liqDeep: '#9cc6f2', foam: '#ffffff', shore: '#8fa6c4',
        prop: 'tree', leaf: ['#cfe0f2', '#e2eefb', '#f3f8ff', '#ffffff'], trunk: ['#8a98b0', '#9aa8c0'],
        rock: ['#b8c6d8', '#c8d4e4', '#dfe7f2'], grass: ['#a0b8d4', '#b4cae2', '#cfe0f2'] } },
    cosmos: { from: 'psychic', zz: 2, weather: 'psychic',
      theme: { name: 'Cosmic Void', floor: '#141028', wall: '#07050f', liquid: 'water', liq: '#5a3cff', foam: '#c9b8ff',
        prop: 'crystal', leaf: '#c03ad0', trunk: '#2a2060', flowers: ['#ff6bd0', '#6bf0ff', '#ffe14d'],
        grass: '#3a3a9a', rock: '#454d88', pools: 0.08, pillars: 0.04, props: { tree: 0.02, rock: 0.012 } },
      pal: { name: 'Cosmic Void', liquid: 'water',
        floor: ['#120e24', '#16112c', '#0f0c20'], dirt: ['#0c0a1a', '#0f0c20', '#0a0816'], speck: '#e8dcff',
        light: '#6a50d0', liq: '#5a3cff', liqDeep: '#2a1a8a', foam: '#c9b8ff', shore: '#0d0a1c' } }
  };
  function installArena(T) {
    if (!T || !T.BIOMES || !T.ARENA_THEMES || T.__brArenas) return;
    T.__brArenas = true;
    Object.keys(ARENAS).forEach(function (k) {
      var A = ARENAS[k];
      T.ARENA_THEMES['br_' + k] = Object.assign({}, T.ARENA_THEMES[A.from] || T.ARENA_THEMES.judgment || {}, A.theme, { weather: A.weather });
      var baseIdx = A.zz != null && T.ZZ ? T.ZZ[A.zz] : (T.arenaBiome ? T.arenaBiome(A.from) : 21);
      A.biome = T.BIOMES.length;
      T.BIOMES.push(Object.assign({}, T.BIOMES[baseIdx] || {}, A.pal));
    });
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
    var A = ARENAS[boss().arena] || ARENAS.primal;
    W.setArena({ tx: tx, ty: ty, r: 24, type: 'br_' + boss().arena });
    W.setBiome(A.biome, true);
    st.weather = A.weather;
    try { PS.Weather.force(A.weather, 999); } catch (e) {}
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

  // Boss Rush prep, in 3 steps (each player on their own game):
  //   1) 50 level points to distribute among Power, Armor, Synthesis, Precision and Reflexes
  //      (the same effects and caps as the level-up cards)
  //   2) pick 4 moves from the Pokémon's move pool: they come at max level, bonded together
  //   3) pick 1 item → countdown → fight
  var PREP_LEVELS = 50, PICK_MOVES = 4;
  var PTS_STATS = ['hp', 'atk', 'def', 'rgn', 'crit', 'cd', 'spd'];
  function grantPrep() {
    if (st.granted) return;
    var G = PS.Game, p = G.player;
    if (!p) return;
    st.granted = true;
    p.level += PREP_LEVELS;               // no level-up cards: the points are spent in the window below
    try { p.levelHp(PREP_LEVELS); } catch (e) {}
    p.xp = 0;
    try { p.xpNext = PS.Player.xpFor(p.level); } catch (e) {}
    p.bonds = 0;
    p.hp = p.maxHp;
    st.step = 'points'; st.alloc = {}; PTS_STATS.forEach(function (k) { st.alloc[k] = 0; });
    say('Boss Rush: distribute 50 points, pick 4 moves and 1 item!', 4);
    openPoints();
  }

  function localReady() { return !!(st.granted && st.step === 'done'); }

  function say(t, d) { try { PS.Spawner.say(t, d || 3, true); } catch (e) {} }

  function startCount() {
    if (st.phase !== 'prep') return;
    st.phase = 'count'; st.countT = 10;
    if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'count' }); } catch (e) {} }
    try { PS.Audio.sfx('boss'); } catch (e) {}
  }

  function bossDef() {
    var T = TUNE[st.boss] || TUNE.groudon, n = teamSize(), B = boss();
    return {
      dex: B.skin, name: B.name,
      hp: Math.round(T.hp * teamHp(n)), spd: T.spd,
      dmg: Math.round(T.dmg * teamDmg(n)), xp: 0,
      behavior: B.behavior, shotDmg: Math.round(T.shot * teamDmg(n)), shotCd: 0.7, range: 320
    };
  }
  function spawnBoss() {
    var T = TUNE[st.boss] || TUNE.groudon, TS = PS.World.TS || 32, c = st.center || { x: 0, y: 0 };
    var e = new PS.Enemy(bossDef(), c.x, c.y - 5 * TS, { hp: 1, dmg: 1, spd: 1 }, true);
    var B = boss();
    e.types = B.types.slice(); e.atkType = B.types[0];
    e.brBoss = true;
    e.castK = T.castK * teamCast(teamSize());
    try { e.bossInit(); e.ai.farLike = B.farLike; e.ai.mode = 'close'; e.ai.modeT = 8; } catch (er) {}
    e.brK = 1 - T.armor;
    var hurt = e.hurt;
    e.hurt = function (amount) {
      var a = Array.prototype.slice.call(arguments);
      st.rawAcc = (st.rawAcc || 0) + (+amount || 0);
      a[0] = amount * (this.brK || (1 - T.armor)) * (st.shieldK || 1);
      var r = hurt.apply(this, a), now = performance.now();
      // under heavy fire the white hit flash hid the sprite: flash at most 4× per second
      if (now - (this._brFlash || 0) < 250) this.flash = 0; else this._brFlash = now;
      return r;
    };
    PS.EnemyMgr.add(e);
    st.e = e; st.fightT = 0; st.rawAcc = 0; st.winT2 = 0; st.rawDps = 0;
    fx = []; clones = []; st.sched = []; st.mT = null; st.mI = 0; st.shieldK = 1; st.shieldOn = false;
    try { PS.Sprites.preload([B.skin], 4000); } catch (er) {}
    say(B.say.wake, 4);
    try { PS.Camera.kick(1.6); PS.Audio.sfx('legend'); PS.Game.flash && PS.Game.flash(B.flash, 0.6); } catch (er) {}
  }

  // Adaptive defense: the HP bar never jumps. Every 2 s the boss measures the
  // team's raw damage and sets how much of it actually lands. The fight lasts
  // about `target` seconds for a reference team; more damage still pays off:
  // fight length ∝ (reference / team DPS)^0.6 (2× damage ≈ 34% shorter fight,
  // half the damage ≈ 52% longer), so a damage build is faster but never melts the boss.
  var REF_DPS = 160000, DPS_EXP = 0.6;
  // Mega in the Boss Rush: landed damage ∝ raw^MEGA_EXP while it lasts, and the boss
  // hits MEGA_RAGE harder (Mega armor now goes past the cap)
  var MEGA_EXP = 0.75, MEGA_RAGE = 1.15;     // reference: a balanced level-51 Pokémon
  function fightLength() {
    var T = TUNE[st.boss] || TUNE.groudon;
    if (!st.rawDps) return T.target;
    var speed = Math.pow(st.rawDps / (REF_DPS * teamSize()), DPS_EXP);
    return T.target / Math.max(0.35, Math.min(3, speed));
  }
  function anyMega() {
    try {
      return PS.Game.everyone().some(function (p) { return p && ((p.megaK || 1) > 1 || !!p._megaMon); });
    } catch (e) { return false; }
  }
  function adapt(dt) {
    var e = st.e, T = TUNE[st.boss] || TUNE.groudon;
    if (!e || e.dead) return;
    st.winT2 = (st.winT2 || 0) + dt;
    var mg = anyMega();
    if (mg && !st.megaWin) { st.megaWin = true; st.preMegaK = e.brK; }
    if (st.winT2 < 2) return;
    var raw = st.rawAcc / st.winT2;               // raw team DPS in the last window
    st.rawAcc = 0; st.winT2 = 0;
    // Mega Evolution is a real power spike, but it must not trivialize the fight:
    // the boss keeps its pre-Mega defense and only softens the spike a bit, so the
    // landed damage grows with (raw boost)^MEGA_EXP (≈ +45% for the usual +65% raw).
    if (st.megaWin) {
      if (st.rawDps > 0 && st.preMegaK) {
        var boost = Math.max(1, raw / st.rawDps);
        e.brK = st.preMegaK * Math.pow(boost, MEGA_EXP - 1);
      }
      if (!mg) { st.megaWin = false; if (st.preMegaK) e.brK = st.preMegaK; st.preMegaK = 0; }
      return;
    }
    st.rawDps = st.rawDps ? st.rawDps * 0.5 + raw * 0.5 : raw;
    if (st.rawDps <= 0) return;
    var len = fightLength();
    var left = Math.max(15, len - st.fightT);
    var want = (e.hp / left) / st.rawDps;          // fraction of the damage that should land
    want = Math.max(0.00002, Math.min(1 - T.armor, want));
    // last stretch: the defense only goes down, so the end never drags on
    if (len - st.fightT < 25 && e.brK && want < e.brK) return;
    e.brK = e.brK ? e.brK * 0.4 + want * 0.6 : want;
  }

  // ---------------------------------------------------------------- boss mechanics
  // Two signature mechanics per boss, alternating every ~16 s (13 s in fury, 11 s at
  // the end). Damage is a % of max HP that ignores armor (pure), so it hurts every
  // build the same; everything is telegraphed and can be dodged.
  //   Groudon : Precipice Blades (2 waves of rock lines) · Magma Surge (lava follows you)
  //   Kyogre  : Tidal Wave (lanes with one safe gap)     · Maelstrom (pulls you to its core)
  //   Rayquaza: Dragon Ascent (chained dives at players)  · Delta Stream (bouncing tornadoes)
  //   Deoxys  : Psycho Shift (clones + barrier, kill them) · Meteor Mark (a meteor tracks you)
  // The host decides; custom effects are sent to every client, each one checks its own player.
  var MECH = { groudon: ['blades', 'magma'], kyogre: ['tidal', 'maelstrom'],
    rayquaza: ['ascent', 'tornado'], deoxys: ['clones', 'meteor'] };
  var MECH_SAY = {
    blades: 'PRECIPICE BLADES! Move between the rock lines!',
    magma: 'MAGMA SURGE! The lava follows you — keep moving!',
    tidal: 'TIDAL WAVE! Find the gap in the wave!',
    maelstrom: 'MAELSTROM! Swim away from the core!',
    ascent: 'DRAGON ASCENT! Rayquaza dives at you!',
    tornado: 'DELTA STREAM! Dodge the tornadoes!',
    clones: 'PSYCHO SHIFT! Destroy the clones before they detonate!',
    meteor: 'METEOR MARK! Run and spread out!'
  };
  var fx = [];                      // local custom effects (every client)
  var clones = [];                  // host: Deoxys clones alive
  function arenaR() { return 24 * (PS.World.TS || 32) - 56; }
  function ctr() { return st.center || { x: 0, y: 0 }; }
  function clampArena(x, y, pad) {
    var c = ctr(), dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), R = arenaR() - (pad || 0);
    if (d <= R) return { x: x, y: y };
    return { x: c.x + dx / d * R, y: c.y + dy / d * R };
  }
  function players() { try { return PS.Game.everyone().filter(function (p) { return p && !p.dead; }); } catch (e) { return []; } }
  function uids() {
    if (coopOn()) return (PS.Coop.members || []).map(function (m) { return m.uid; });
    return ['me'];
  }
  function plOf(uid) {
    if (uid === 'me' || (coopOn() && uid === PS.Coop.me)) return PS.Game.player;
    try { var m = PS.Coop.mate && PS.Coop.mate(uid); return m && m.pl; } catch (e) { return null; }
  }
  // pure damage as a share of max HP (one hit is capped at 50% by the game)
  function hitMe(pct) {
    var p = PS.Game.player;
    if (!p || p.dead || p.remote) return;
    p.invuln = 0;
    try { p.hurt(Math.max(1, p.maxHp * pct), null, true); } catch (e) {}
  }
  function pushMe(dx, dy) {
    var p = PS.Game.player;
    if (!p || p.dead) return;
    var steps = 6, sx = dx / steps, sy = dy / steps;
    for (var i = 0; i < steps; i++) {
      var nx = p.x + sx, ny = p.y + sy;
      if (PS.World.isFree && !PS.World.isFree(nx, ny, p.r || 12)) break;
      p.x = nx; p.y = ny;
    }
  }
  function hz(o) {
    o.pure = true; o.dmg = o.dmg || 1;
    try { PS.Hazards.add(o); } catch (e) {}
  }
  // host → everyone (and itself)
  function emit(msg) {
    applyMech(msg);
    if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'mech', d: msg }); } catch (e) {} }
  }
  // mechanic call-outs: the host shows them and sends them to the team
  function sayAll(t, d) { say(t, d); if (coopOn() && isHost()) { try { PS.Net.broadcast({ k: 'br', t: 'mech', d: { m: 'say', s: t, d: d } }); } catch (e) {} } }
  function later(t, fn) { (st.sched = st.sched || []).push({ t: t, fn: fn }); }
  function schedTick(dt) {
    var q = st.sched; if (!q || !q.length) return;
    for (var i = q.length - 1; i >= 0; i--) {
      q[i].t -= dt;
      if (q[i].t <= 0) { var f = q[i].fn; q.splice(i, 1); try { f(); } catch (e) { console.error('[bossrush mech]', e); } }
    }
  }

  function mechTick(dt, e) {
    schedTick(dt);
    if (st.mT == null) st.mT = 7;
    st.mT -= dt;
    cloneTick(dt, e);
    if (st.mT > 0 || (e.ai && e.ai.cast) || e.jump) return;
    var list = MECH[st.boss] || MECH.groudon, m = list[(st.mI || 0) % 2];
    st.mI = (st.mI || 0) + 1;
    // mechanics come more often (Kyogre keeps its old pace)
    st.mT = st.boss === 'kyogre' ? (st.desperate ? 11 : st.fury ? 13 : 16) : (st.desperate ? 9 : st.fury ? 11 : 13);
    sayAll(MECH_SAY[m], 3);
    try { PS.Audio.sfx('boss'); e.anim.play('Charge', { speed: 1.2 }); } catch (er) {}
    START[m](e);
  }
  function lockCasts(e, s) { if (e.ai) e.ai.cd = Math.max(e.ai.cd || 0, s); }

  var START = {
    // --- Groudon: rock lines from the boss, a second wave in the gaps
    blades: function (e) {
      var n = st.fury ? 12 : 10, a0 = Math.random() * Math.PI * 2, L = arenaR() * 2 + 200;
      var waves = st.desperate ? 4 : 3;
      // each wave is shown only after the previous one lands (readable telegraphs)
      var ox = e.x, oy = e.y;
      for (var w = 0; w < waves; w++) (function (w) {
        later(w * 1.4, function () {
          if (e.dead) return;
          var off = (w % 2) * Math.PI / n;
          // the lines start a bit away from Groudon, so they never overlap (one hit per wave)
          for (var i = 0; i < n; i++) {
            var an = a0 + off + i * 2 * Math.PI / n;
            hz({ kind: 'beam', x: ox + Math.cos(an) * 64, y: oy + Math.sin(an) * 64, angle: an, len: L, w: 40,
              delay: w ? 0.95 : 1.35, pct: 0.30, type: 'ground', color: '#c8742c' });
          }
        });
      })(w);
      lockCasts(e, 1.6 + waves * 1.4);
    },
    // --- Groudon: eruptions under every player, leaving lava pools
    magma: function () {
      var k = st.fury ? 9 : 7;
      for (var i = 0; i < k; i++) later(i * 0.65, function () {
        players().forEach(function (p) {
          var q = clampArena(p.x, p.y, 30);
          hz({ kind: 'zone', x: q.x, y: q.y, r: 60, delay: 0.85, pct: 0.18, type: 'fire', color: '#ff5a1e' });
          emit({ m: 'pool', x: Math.round(q.x), y: Math.round(q.y), r: 60, delay: 0.85, life: 9 });
        });
      });
    },
    // --- Kyogre: lanes of water across the arena, one wide safe gap; then a second wave
    tidal: function (e) {
      var waves = st.desperate ? 3 : 2, a = Math.floor(Math.random() * 4) * Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      for (var w = 0; w < waves; w++) (function (w) {
        later(w * 2.2, function () { if (!e.dead) tidalWave(a + w * Math.PI / 2, w ? 1.5 : 2.1); });
      })(w);
      lockCasts(e, 2.4 + waves * 2.2);
    },
    // --- Kyogre: a whirlpool over the team that drags you to its core
    maelstrom: function () {
      var ps = players(), x = 0, y = 0;
      ps.forEach(function (p) { x += p.x; y += p.y; });
      if (ps.length) { x /= ps.length; y /= ps.length; } else { x = ctr().x; y = ctr().y; }
      var q = clampArena(x, y, 260);
      emit({ m: 'whirl', x: Math.round(q.x), y: Math.round(q.y), r: 320, core: 78, life: st.fury ? 8 : 7, pull: st.fury ? 118 : 100 });
    },
    // --- Rayquaza: 3-4 chained dives, each one aimed at a player
    ascent: function (e) {
      var n = st.fury ? 5 : 4;
      lockCasts(e, n * 1.1 + 1);
      var from = { x: e.x, y: e.y };
      for (var i = 0; i < n; i++) (function (i) {
        later(i * 1.1, function () {
          var ps = players(); if (!ps.length || e.dead) return;
          var tg = ps[i % ps.length], a = Math.atan2(tg.y - from.y, tg.x - from.x);
          var L = 60, step = 40;
          while (L < 1300) { var q = { x: from.x + Math.cos(a) * (L + step), y: from.y + Math.sin(a) * (L + step) };
            var c = clampArena(q.x, q.y, 70); if (c.x !== q.x || c.y !== q.y) break; L += step; }
          L = Math.max(L, Math.hypot(tg.x - from.x, tg.y - from.y) + 120);
          var end = clampArena(from.x + Math.cos(a) * L, from.y + Math.sin(a) * L, 70);
          L = Math.hypot(end.x - from.x, end.y - from.y);
          hz({ kind: 'beam', x: from.x, y: from.y, angle: a, len: L, w: 96, delay: 0.9, pct: 0.36, type: 'dragon', color: '#45e07a' });
          var sx = from.x, sy = from.y;
          later(0.9, function () {
            if (e.dead) return;
            e.x = end.x; e.y = end.y;
            if (e.ai) e.ai.cast = null;
            try { PS.FX.beam(sx, sy - (PS.LIFT || 0), a, L, 70, '#45e07a', PS.VFX.forType('dragon')); PS.Camera.kick(0.5); PS.Audio.sfx('legend'); } catch (er) {}
          });
          from = end;
        });
      })(i);
    },
    // --- Rayquaza: tornadoes that cross the arena and bounce off its walls
    tornado: function () {
      var n = st.fury ? 6 : 5, c = ctr(), R = arenaR(), list = [];
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, d = a + Math.PI + (Math.random() - 0.5) * 0.9, sp = 150 + Math.random() * 45;
        list.push({ x: Math.round(c.x + Math.cos(a) * R * 0.82), y: Math.round(c.y + Math.sin(a) * R * 0.82),
          vx: Math.round(Math.cos(d) * sp), vy: Math.round(Math.sin(d) * sp) });
      }
      emit({ m: 'tornado', list: list, life: st.fury ? 12 : 11, r: 46 });
    },
    // --- Deoxys: 3 clones + a barrier on Deoxys; clones left alive detonate
    clones: function (e) {
      killClones();
      var n = st.desperate ? 5 : 4, T = TUNE[st.boss] || TUNE.deoxys;
      var hp = Math.round(Math.max(30000, Math.min(2.5e6, (st.rawDps || 120000) * 3.0)));
      for (var i = 0; i < n; i++) {
        var a = i * 2 * Math.PI / n + Math.random() * 0.4, q = clampArena(e.x + Math.cos(a) * 240, e.y + Math.sin(a) * 240, 60);
        var def = { dex: 386, name: 'Deoxys Clone', hp: hp, spd: 105, dmg: Math.round(T.dmg * 0.45), xp: 0,
          behavior: 'ranged', shotDmg: Math.round(T.shot * 0.55), shotCd: 1.1, range: 300 };
        var c = new PS.Enemy(def, q.x, q.y, { hp: 1, dmg: 1, spd: 1 }, false);
        c.brClone = true; c.types = ['psychic']; c.atkType = 'psychic';
        PS.EnemyMgr.add(c); clones.push(c);
        try { PS.FX.burst(q.x, q.y - 20, '#c86bff', 16, 140); PS.FX.ring(q.x, q.y, 6, 60, '#c86bff', 0.5, 4); } catch (er) {}
      }
      st.cloneT = 12; st.cloneWarn = false;
      emit({ m: 'shield', on: 1 });
    },
    // --- Deoxys: every player gets a meteor that tracks them, plus falling stars
    meteor: function () {
      var rounds = st.fury ? 3 : 2;
      for (var r = 0; r < rounds; r++) later(r * 3.6, function () {
        emit({ m: 'meteor', uids: uids(), t: 2.8, r: 112 });
        var c = ctr(), R = arenaR();
        for (var i = 0; i < 10; i++) {
          var a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R * 0.9;
          hz({ kind: 'zone', x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, r: 62, delay: 1.5 + Math.random() * 1.6,
            pct: 0.18, type: 'psychic', color: '#c86bff' });
        }
      });
    }
  };
  function tidalWave(a, delay) {
    var c = ctr(), R = arenaR() + 40, lane = 110, n = Math.ceil(2 * R / lane);
    var gap = 2 + Math.floor(Math.random() * (n - 5));            // 2 adjacent lanes stay safe
    var dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    for (var i = 0; i < n; i++) {
      if (i === gap || i === gap + 1) continue;
      var off = -R + lane * (i + 0.5);
      hz({ kind: 'beam', x: c.x - dx * (R + 60) + px * off, y: c.y - dy * (R + 60) + py * off, angle: a,
        len: 2 * R + 120, w: lane, delay: delay, pct: 0.34, type: 'water', color: '#3cb4ff' });
    }
  }
  function killClones() {
    clones.forEach(function (c) { try { if (!c.dead) { c.hp = 0; c.die && c.die(); } } catch (e) {} });
    clones = [];
    if (st.shieldK && st.shieldK < 1) { st.shieldK = 1; emit({ m: 'shield', on: 0 }); }
  }
  function cloneTick(dt, e) {
    if (!clones.length) return;
    clones = clones.filter(function (c) { return c && !c.dead && PS.EnemyMgr.all().indexOf(c) >= 0; });
    st.shieldK = clones.length ? 0.2 : 1;
    if (!clones.length) { emit({ m: 'shield', on: 0 }); sayAll('The clones are gone: the barrier breaks!', 2.4); return; }
    st.cloneT -= dt;
    if (st.cloneT < 4 && !st.cloneWarn) { st.cloneWarn = true; sayAll('The clones are about to detonate!', 2.6); }
    if (st.cloneT <= 0) {
      // every clone left alive hurts the whole team
      clones.forEach(function (c) {
        hz({ kind: 'zone', x: c.x, y: c.y, r: 4000, delay: 0.05, pct: 0.24, type: 'psychic', color: '#c86bff' });
      });
      try { PS.Camera.kick(1); } catch (er) {}
      killClones();
    }
  }

  // ------------------------------------------------ custom effects (every client)
  function applyMech(msg) {
    if (!msg || !msg.m) return;
    if (msg.m === 'say') { if (!isHost()) say(msg.s, msg.d); return; }
    if (msg.m === 'pool') fx.push({ k: 'pool', x: msg.x, y: msg.y, r: msg.r, t: -msg.delay, life: msg.life, tick: 0 });
    else if (msg.m === 'whirl') fx.push({ k: 'whirl', x: msg.x, y: msg.y, r: msg.r, core: msg.core, t: -1.2, life: msg.life, pull: msg.pull, tick: 0 });
    else if (msg.m === 'tornado') msg.list.forEach(function (o) {
      fx.push({ k: 'tornado', x: o.x, y: o.y, vx: o.vx, vy: o.vy, r: msg.r, t: -0.8, life: msg.life, cd: 0 });
    });
    else if (msg.m === 'meteor') msg.uids.forEach(function (u) {
      var pl = plOf(u); if (!pl) return;
      fx.push({ k: 'meteor', uid: u, x: pl.x, y: pl.y, r: msg.r, t: 0, life: msg.t });
    });
    else if (msg.m === 'shield') st.shieldOn = !!msg.on;
    if (fx.length > 60) fx.splice(0, fx.length - 60);
  }
  var poolCd = 0;
  function fxTick(dt) {
    var p = PS.Game.player, c = ctr(), R = arenaR();
    poolCd -= dt;
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i];
      f.t += dt;
      if (f.k === 'pool') {
        if (f.t >= 0 && p && !p.dead && Math.hypot(p.x - f.x, (p.y - f.y) / 0.75) < f.r + 4 && poolCd <= 0) {
          poolCd = 0.5; hitMe(0.09);                              // overlapping pools do not stack
        }
      } else if (f.k === 'whirl') {
        if (f.t >= 0 && p && !p.dead) {
          var dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
          if (d < f.r && d > 4) { var s = f.pull * (0.55 + 0.45 * (1 - d / f.r)) * dt; pushMe(dx / d * s, dy / d * s); }
          if (d < f.core) { f.tick -= dt; if (f.tick <= 0) { f.tick = 0.4; hitMe(0.10); } }
        }
      } else if (f.k === 'tornado') {
        if (f.t >= 0) {
          f.x += f.vx * dt; f.y += f.vy * dt;
          var ox = f.x - c.x, oy = f.y - c.y, od = Math.hypot(ox, oy);
          if (od > R - f.r) {                                   // bounce off the arena wall
            var nx = ox / od, ny = oy / od, dot = f.vx * nx + f.vy * ny;
            if (dot > 0) { f.vx -= 2 * dot * nx; f.vy -= 2 * dot * ny; }
            f.x = c.x + nx * (R - f.r); f.y = c.y + ny * (R - f.r);
          }
          f.cd -= dt;
          if (p && !p.dead && f.cd <= 0) {
            var tx = p.x - f.x, ty = p.y - f.y, td = Math.hypot(tx, ty);
            if (td < f.r + (p.r || 12)) { f.cd = 0.9; hitMe(0.20); pushMe(tx / (td || 1) * 150, ty / (td || 1) * 150); }
          }
        }
      } else if (f.k === 'meteor') {
        var pl = plOf(f.uid);
        if (pl && !pl.dead) { var k = Math.min(1, dt * 3.2); f.x += (pl.x - f.x) * k; f.y += (pl.y - f.y) * k; }
        if (f.t >= f.life && !f.done) {
          f.done = true;
          try { PS.FX.ring(f.x, f.y, 8, f.r, '#e08bff', 0.45, 6); PS.FX.burst(f.x, f.y - 10, '#c86bff', 26, 220);
            PS.FX.beam(f.x, f.y, -Math.PI / 2, 420, f.r * 0.9, '#c86bff', PS.VFX.forType('psychic')); PS.Camera.kick(0.6); PS.Audio.sfx('judge'); } catch (er) {}
          if (p && !p.dead && Math.hypot(p.x - f.x, (p.y - f.y) / 0.75) < f.r + (p.r || 12) * 0.6) hitMe(0.45);
        }
      }
      if (f.t >= (f.k === 'meteor' ? f.life + 0.2 : f.life)) fx.splice(i, 1);
    }
  }
  function fxDrawables() {
    if (!fx.length && !(st.shieldOn && st.e)) return [];
    var out = [], now = performance.now() / 1000;
    fx.forEach(function (f) {
      if (f.k === 'pool') out.push({ y: -1e9, draw: function (ctx) {
        ctx.save();
        var on = f.t >= 0, fade = Math.min(1, (f.life - f.t) / 0.8);
        ctx.globalAlpha = on ? 0.72 * fade : 0.25;
        var g = ctx.createRadialGradient(f.x, f.y, 4, f.x, f.y, f.r);
        g.addColorStop(0, '#ffd23f'); g.addColorStop(0.45, '#ff6a1e'); g.addColorStop(1, 'rgba(140,20,0,0.15)');
        ctx.fillStyle = on ? g : '#ff3030';
        ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        if (on) { ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 2;
          var b = (((now * 1.7 + f.x) % 1) + 1) % 1; ctx.beginPath(); ctx.ellipse(f.x + Math.sin(f.x + now) * 10, f.y, 6 + 10 * b, (6 + 10 * b) * 0.75, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      } });
      else if (f.k === 'whirl') out.push({ y: -1e9, draw: function (ctx) {
        ctx.save();
        var on = f.t >= 0, fade = Math.min(1, (f.life - f.t) / 0.8, on ? 1 : 0.4 + 0.6 * (1 + f.t / 1.2));
        ctx.translate(f.x, f.y); ctx.scale(1, 0.75);
        ctx.globalAlpha = 0.28 * fade; ctx.fillStyle = '#1a5fae';
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 4; ctx.strokeStyle = '#9fe0ff';
        for (var j = 0; j < 5; j++) {
          ctx.globalAlpha = 0.55 * fade;
          var rr = f.r * (0.25 + 0.17 * j), a0 = -now * (2.4 - j * 0.3) + j;
          ctx.beginPath(); ctx.arc(0, 0, rr, a0, a0 + 2.2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, rr, a0 + Math.PI, a0 + Math.PI + 2.2); ctx.stroke();
        }
        ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = '#0a2850';
        ctx.beginPath(); ctx.arc(0, 0, f.core, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9 * fade; ctx.strokeStyle = '#ff4a4a'; ctx.setLineDash([6, 5]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, f.core, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      } });
      else if (f.k === 'tornado') out.push({ y: f.y + 1, draw: function (ctx) {
        ctx.save();
        var grow = f.t < 0 ? 0.35 + 0.65 * (1 + f.t / 0.8) : Math.min(1, (f.life - f.t) / 0.6);
        ctx.translate(f.x, f.y);
        for (var j = 0; j < 7; j++) {
          var h = j * 15, w = f.r * (0.45 + j * 0.13) * grow, sway = Math.sin(now * 6 + j * 0.9) * 5;
          ctx.globalAlpha = (0.55 - j * 0.04) * (f.t < 0 ? 0.5 : 1);
          ctx.strokeStyle = j % 2 ? '#e8fff2' : '#8ff0b8'; ctx.lineWidth = 4;
          var a0 = now * 9 + j;
          ctx.beginPath(); ctx.ellipse(sway, -h, w, w * 0.32, 0, a0, a0 + 4.6); ctx.stroke();
        }
        ctx.restore();
      } });
      else if (f.k === 'meteor') out.push({ y: -1e9 + 1, draw: function (ctx) {
        ctx.save();
        var k = Math.min(1, f.t / f.life), blink = k > 0.75 && Math.sin(now * 40) > 0;
        ctx.translate(f.x, f.y); ctx.scale(1, 0.75);
        ctx.globalAlpha = 0.18 + 0.12 * k; ctx.fillStyle = '#c86bff';
        ctx.beginPath(); ctx.arc(0, 0, f.r, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(0, 0, f.r * k, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = blink ? 1 : 0.75; ctx.strokeStyle = '#f2c8ff'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]);
        ctx.beginPath(); ctx.arc(0, 0, f.r, -now * 2, -now * 2 + Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-f.r * 0.3, 0); ctx.lineTo(f.r * 0.3, 0); ctx.moveTo(0, -f.r * 0.3); ctx.lineTo(0, f.r * 0.3); ctx.stroke();
        ctx.restore();
        // the falling meteor
        var hgt = (1 - k) * 380;
        ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffe0ff';
        ctx.beginPath(); ctx.arc(f.x + hgt * 0.35, f.y - hgt - 20, 9 + 9 * k, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#c86bff';
        ctx.beginPath(); ctx.arc(f.x + hgt * 0.35 + 10, f.y - hgt - 34, 14 + 8 * k, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } });
    });
    var e = st.e;
    if (st.shieldOn && e && !e.dead) out.push({ y: e.y + 2, draw: function (ctx) {
      ctx.save();
      var r = (e.r || 30) * 2.2, h = e.bodyH || 70;
      ctx.translate(e.x, e.y - h * 0.45);
      ctx.globalAlpha = 0.18 + 0.06 * Math.sin(now * 5); ctx.fillStyle = '#c86bff';
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.8; ctx.strokeStyle = '#f2c8ff'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.05, 0, now, now + Math.PI * 1.4); ctx.stroke();
      ctx.restore();
    } });
    return out;
  }

  // ---------------------------------------------------------------- leaderboard
  // One board per boss (Solo / Group), fastest kill wins: t = 100000 - seconds.
  var RANK_ID = { groudon: 'bg', kyogre: 'bk', rayquaza: 'br', deoxys: 'bd' };
  window.__brFmt = function (t) {
    var s = Math.max(0, 100000 - t), m = Math.floor(s / 60), sec = s % 60;
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  };
  function submitRank() {
    var R = PS.Ranking, me = PS.DB && PS.DB.online && PS.DB.fb, p = PS.Game.player, cat = RANK_ID[st.boss];
    if (!cat || !R || !R._put || !me || !me.uid || !PS.Social.me || !p || PS.Game.training) return;
    if (PS.DevMenu && PS.DevMenu.on) return;
    if (!isHost()) return;                                   // in a group the host sends it
    var secs = Math.max(10, Math.ceil(st.fightT || 0)), entry, id, pre;
    var mem = coopOn() ? (PS.Coop.members || []).slice() : [];
    if (mem.length >= 2) {
      mem.sort(function (a, b) { return a.uid < b.uid ? -1 : 1; });
      id = mem.map(function (m) { return m.uid; }).join('_'); pre = cat + 'g';
      entry = { uids: mem.map(function (m) { return m.uid; }), names: mem.map(function (m) { return m.name; }),
                dex: mem.map(function (m) { return m.dex; }), shiny: mem.map(function (m) { return !!m.shiny; }) };
    } else {
      id = me.uid; pre = cat + 's';
      entry = { uids: [me.uid], names: [PS.Social.me.name], dex: [p.baseDex || p.dex], shiny: [!!p.shiny] };
    }
    entry.t = 100000 - secs; entry.lv = p.level | 0 || 1; entry.kills = p.kills | 0;
    var boards = R.PERIODS.map(function (x) { return [R.board(pre, x[0], null), x[0]]; });
    R._put(boards, id, entry).then(function (got) {
      try { R._tag(got, 'Boss Rush · ' + boss().name); } catch (e) {}
    }).catch(function (e) { console.warn('[bossrush ranking]', e); });
  }

  // e.dmg is a getter (×0.8 while burned): scale the stored base, not the burned value
  function scaleDmg(e, k) { if (typeof e._dmg === 'number') e._dmg *= k; else e.dmg *= k; }
  function fightTick(dt) {
    var e = st.e, T = TUNE[st.boss] || TUNE.groudon;
    if (!e) return;
    st.fightT += dt;
    // the arena weather never ends (renewed before it runs out)
    try { var Wc = PS.Weather.current; if (st.weather && (!Wc || Wc.kind !== st.weather || Wc.left < 900)) PS.Weather.force(st.weather, 999); } catch (er) {}
    if (e.dead) {
      if (!st.won) {
        try { killClones(); st.sched = []; } catch (er) {}
        st.won = true; st.winT = 0;
        markBeaten(st.boss);
        try { submitRank(); } catch (er) { console.warn('[bossrush ranking]', er); }
        say(boss().name.toUpperCase() + ' IS DEFEATED!', 5);
        try { PS.Audio.sfx('legend'); } catch (er) {}
        if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'won', boss: st.boss }); } catch (er) {} }
      }
      return;
    }
    if (PS.EnemyMgr.all().indexOf(e) < 0) { PS.EnemyMgr.add(e); }
    var mgOn = anyMega();
    if (mgOn !== !!st.megaRage) {
      st.megaRage = mgOn;
      if (mgOn) { scaleDmg(e, MEGA_RAGE); e.castK *= 1.08; say(boss().name.toUpperCase() + ' SENSES THE MEGA POWER!', 2.6); }
      else { scaleDmg(e, 1 / MEGA_RAGE); e.castK /= 1.08; }
    }
    if (e.ai) {
      if (e.ai.mode === 'far' && e.ai.modeT > T.farMax) e.ai.modeT = T.farMax;
      if (e.ai.cd > 1.4) e.ai.cd = 1.4;
    }
    if (!st.fury && e.hp < 0.5 * e.maxHp) {
      st.fury = true;
      e.castK *= 1.25; e.spd *= 1.15; scaleDmg(e, 1.3);
      say(boss().say.fury, 3.4);
      try { PS.Camera.kick(1.2); } catch (er) {}
    }
    if (!st.desperate && e.hp < 0.2 * e.maxHp) {
      st.desperate = true;
      e.castK *= 1.2; scaleDmg(e, 1.15);
      say(boss().say.last, 3.4);
    }
    try { mechTick(dt, e); } catch (er) { console.error('[bossrush mech]', er); }
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
      var need = 1, ready = localReady() ? 1 : 0;
      if (coopOn()) {
        var mem = (PS.Coop.members || []).map(function (m) { return m.uid; });
        need = Math.max(mem.length, all.length, 1);
        for (var u in st.readyFrom) if (st.readyFrom[u] && u !== PS.Coop.me) ready++;
        // every member (not just "enough" messages) has to be ready
        var missing = mem.some(function (id) { return id !== PS.Coop.me && !st.readyFrom[id]; });
        if (missing) ready = Math.min(ready, need - 1);
        st.syncT = (st.syncT || 0) - dt;
        if (st.syncT <= 0) {
          st.syncT = 1;
          try {
            if (st.arena) PS.Net.broadcast({ k: 'br', t: 'arena', tx: st.arena.tx, ty: st.arena.ty, boss: st.boss });
            PS.Net.broadcast({ k: 'br', t: 'wait', ready: ready, need: need });
          } catch (e) {}
        }
      }
      st.readyN = ready; st.needN = need;
      if (ready >= need) startCount();
    } else if (st.phase === 'count') {
      st.countT -= dt;
      if (st.countT <= 0) {
        st.phase = 'fight'; spawnBoss();
        if (coopOn()) { try { PS.Net.broadcast({ k: 'br', t: 'fight' }); } catch (e) {} }
      }
    } else if (st.phase === 'fight') {
      fightTick(dt);
    }
  }

  // ------------------------------------------------------------ net (co-op)
  function onNet(from, msg) {
    if (!msg || msg.k !== 'br' || !PS) return;
    if (msg.t === 'arena') {
      if (isHost()) return;
      // the host repeats it every second during the prep: apply it only once
      if (st.setup && st.arena && st.arena.tx === msg.tx && st.arena.ty === msg.ty && st.boss === msg.boss) return;
      st = fresh(); st.setup = true; st.boss = msg.boss || 'groudon'; st.firstClear = !prog().beaten[st.boss];
      st.arena = { tx: msg.tx, ty: msg.ty };
      try { applyArena(msg.tx, msg.ty); } catch (e) { console.error('[bossrush arena]', e); }
    } else if (msg.t === 'ready') {
      if (isHost()) st.readyFrom[msg.u || from] = 1;
    } else if (msg.t === 'wait') {
      if (!isHost()) { st.readyN = msg.ready; st.needN = msg.need; }
    } else if (msg.t === 'count') {
      if (!isHost() && st.phase === 'prep') { st.phase = 'count'; st.countT = 10; }
    } else if (msg.t === 'fight') {
      if (!isHost() && st.phase !== 'fight') { st.phase = 'fight'; st.fightT = 0; }
    } else if (msg.t === 'mech') {
      if (!isHost()) { try { applyMech(msg.d); } catch (e) { console.error('[bossrush mech]', e); } }
    } else if (msg.t === 'won') {
      fx = []; st.shieldOn = false;
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
      '#br-prep button{pointer-events:auto;margin:0 3px}' +
      '#br-prep .br-it{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;font-size:13px;color:#ffe2c8}' +
      '#br-items{position:fixed;inset:0;z-index:72;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(4,6,16,.78)}' +
      '#br-items.show{display:flex}' +
      '#br-items .bri{width:min(860px,100%);max-height:100%;overflow:auto;padding:14px 16px 16px;border-radius:16px;box-sizing:border-box;' +
      'background:linear-gradient(180deg,#3a140c,#1a0806);border:2px solid #ff7a3c;box-shadow:0 0 24px rgba(255,90,40,.45);color:#fff;text-align:center}' +
      '#br-items h3{margin:0 0 2px;color:#ffcf6a;letter-spacing:.05em}' +
      '#br-items .sub{margin:0 0 10px;font-size:13px;color:#ffd9bf}' +
      '#br-items .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:8px;text-align:left}' +
      '#br-items .it{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;border:2px solid rgba(255,160,90,.35);' +
      'background:rgba(0,0,0,.28);color:#fff;font:inherit;cursor:pointer;text-align:left}' +
      '#br-items .it:hover,#br-items .it.on{border-color:#ffd23f;background:rgba(255,210,63,.12)}' +
      '#br-items .it .ic{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center}' +
      '#br-items .it b{display:block;font-size:14px}#br-items .it small{display:block;font-size:12px;color:#e6d2c4;line-height:1.25}' +
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
    prep.innerHTML = '<h4>BOSS RUSH</h4><p class="br-step"></p><div class="br-st"></div>' +
      '<button class="btn gold small" type="button" data-br="open">Open</button>';
    var count = document.createElement('div'); count.id = 'br-count'; count.setAttribute('translate', 'no');
    count.innerHTML = '<div class="n"></div><div class="s">GET READY</div>';
    document.body.appendChild(prep); document.body.appendChild(count);
    prep.querySelector('[data-br="open"]').onclick = function () { openStep(); };
    ui = { prep: prep, count: count, step: prep.querySelector('.br-step'), st: prep.querySelector('.br-st'),
      btn: prep.querySelector('[data-br="open"]'), n: count.querySelector('.n'), s: count.querySelector('.s') };
    return ui;
  }

  var lastUi = 0;
  function uiLoop() {
    requestAnimationFrame(uiLoop);
    if (!PS || !PS.Game) return;
    var u = ensureUi(), now = performance.now();
    var fdt = Math.min(0.1, (now - (lastUi || now)) / 1000); lastUi = now;
    var on = isBR() && inRun();
    var gs = PS.Game.state;
    if (on && gs === 'playing' && fx.length) { try { fxTick(fdt); } catch (e) { console.error('[bossrush fx]', e); } }
    if (!on && fx.length) { fx = []; st.shieldOn = false; }
    if (!on) { u.prep.style.display = 'none'; u.count.style.display = 'none'; closeItems(); closePoints(); closeMoves(); return; }
    // every client prepares its own Pokémon once the arena is ready
    if (st.setup && !st.granted && (PS.Game.state === 'playing' || PS.Game.state === 'held')) grantPrep();
    if (st.phase === 'prep' && st.granted) {
      var ready = localReady();
      // repeated every 1.5 s until the countdown starts (a lost message no longer blocks)
      if (ready && coopOn() && !isHost() && now - (st.sentReady || 0) > 1500) {
        st.sentReady = now;
        try { PS.Net.toHost({ k: 'br', t: 'ready', u: PS.Coop.me }); } catch (e) {}
      }
      var h4 = 'BOSS RUSH · ' + boss().name.toUpperCase(), h4el = u.prep.querySelector('h4');
      if (h4el.textContent !== h4) h4el.textContent = h4;
      var stepTxt = { points: 'Step 1/3 · Distribute your 50 points', moves: 'Step 2/3 · Pick 4 moves',
        item: 'Step 3/3 · Pick your item', done: 'All set!' }[st.step] || '';
      if (u.step.textContent !== stepTxt) u.step.textContent = stepTxt;
      var team = st.needN > 1 ? ' (' + Math.min(st.readyN || 0, st.needN) + '/' + st.needN + ' ready)' : '';
      var txt = ready ? (coopOn() ? 'Waiting for the team…' + team : 'The fight is about to begin…') : (coopOn() ? team.trim() : '');
      if (st.item && ready) txt = (PS.Icons ? PS.Icons.html(st.item, 20) : '') + ' ' + itemName(st.item) + ' · ' + txt;
      if (u.st.innerHTML !== txt) u.st.innerHTML = txt;
      var anyOpen = (ptsUi && ptsUi.classList.contains('show')) || (movUi && movUi.classList.contains('show')) ||
        (itemsUi && itemsUi.classList.contains('show'));
      u.btn.style.display = (ready || anyOpen) ? 'none' : '';
      u.prep.style.display = 'block';
    } else u.prep.style.display = 'none';
    if (!isHost()) {
      if (st.phase === 'count') {
        st.countT -= fdt;
        // the host's "fight" message got lost: start anyway right after the countdown
        if (st.countT <= -1.5) { st.phase = 'fight'; st.fightT = 1.5; }
      } else if (st.phase === 'fight') st.fightT += fdt;
    }
    if (st.phase === 'count') {
      var n = Math.max(0, Math.ceil(st.countT));
      if (n !== st.countShown) {
        st.countShown = n;
        u.n.textContent = n > 0 ? n : 'FIGHT!';
        u.s.textContent = n > 0 ? boss().name.toUpperCase() + ' APPROACHES' : '';
        u.n.style.animation = 'none'; void u.n.offsetWidth; u.n.style.animation = '';
        try { PS.Audio.sfx(n > 0 ? 'click' : 'boss'); } catch (e) {}
      }
      u.count.style.display = 'flex';
    } else if (st.phase === 'fight' && st.fightT < 0.8) {
      u.n.textContent = 'FIGHT!'; u.s.textContent = ''; u.count.style.display = 'flex';
    } else u.count.style.display = 'none';
  }



  // ------------------------------------------------------------ step 1: distribute 50 points
  var STAT_COL = { spd: '#5fd4ff', hp: '#ff5a6a', atk: '#f0a830', def: '#2fd08a', rgn: '#f5b22e', crit: '#9fb2d8', cd: '#ff6fb0' };
  var ptsUi = null, movUi = null;
  function winCss() {
    if (document.getElementById('br-win-css')) return;
    var s = document.createElement('style'); s.id = 'br-win-css';
    s.textContent =
      '.br-win{position:fixed;inset:0;z-index:72;display:none;align-items:center;justify-content:center;padding:14px;background:rgba(4,6,16,.78)}' +
      '.br-win.show{display:flex}' +
      '.br-win .bw{width:min(680px,100%);max-height:100%;overflow:auto;box-sizing:border-box;padding:18px 18px 16px;border-radius:16px;color:#fff;' +
      'background:linear-gradient(180deg,#1a2a5c,#14204a);border:2px solid #3e5aa8;box-shadow:0 10px 40px rgba(0,0,0,.5)}' +
      '.br-win .bw-h{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:12px;margin-bottom:14px;border-bottom:1px solid rgba(160,190,255,.15)}' +
      '.br-win .bw-h small{display:block;font-size:12px;font-weight:800;letter-spacing:.06em;color:#8fb4ff}' +
      '.br-win .bw-h h3{margin:2px 0 0;font-size:clamp(22px,3.4vw,30px);font-weight:900}' +
      '.br-win .bw-left{flex:none;display:flex;align-items:center;gap:10px;padding:10px 16px;border-radius:12px;border:2px solid #9fd0ff;' +
      'background:#13204a;box-shadow:0 0 16px rgba(120,190,255,.45);font-size:12px;font-weight:800;color:#bfe0ff}' +
      '.br-win .bw-left b{font-size:24px;color:#ffd23f;font-family:monospace}' +
      '.br-win .row{display:flex;align-items:center;gap:12px;padding:12px 14px;margin-bottom:10px;border-radius:12px;background:rgba(40,60,130,.35);border:2px solid #34509a}' +
      '.br-win .row .ic{flex:none;width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;border:2px solid var(--c);background:rgba(0,0,0,.25)}' +
      '.br-win .row .tx{flex:1;min-width:0}' +
      '.br-win .row .tx b{font-size:17px}.br-win .row .tx .tag{margin-left:6px;padding:2px 7px;border-radius:6px;font-size:10px;font-weight:900;background:#25418a;color:#bcd2ff;border:1px solid #4a6ac0;vertical-align:2px}' +
      '.br-win .row .tx small{display:block;margin-top:2px;font-size:12px;color:#c8d6f2}' +
      '.br-win .row .tx .cap{color:#ffd23f;font-weight:800}' +
      '.br-win .ctl{flex:none;display:flex;align-items:center;gap:6px}' +
      '.br-win .ctl button{min-width:32px;height:32px;padding:0 6px;border-radius:8px;border:2px solid #6a8ae0;background:#2c4a9a;color:#fff;font:inherit;font-weight:900;font-size:13px;cursor:pointer}' +
      '.br-win .ctl button:disabled{opacity:.35;cursor:default;border-color:#3a4a7a;background:#22305e}' +
      '.br-win .ctl .val{width:44px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#0b1430;border:2px solid #2a3c74;font-weight:900;font-size:16px}' +
      '.br-win .bw-f{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:6px;padding:12px 14px;border-radius:12px;background:rgba(10,16,40,.6);border:1px solid #2a3c74;font-size:13px}' +
      '.br-win .bw-f i{display:inline-block;width:9px;height:9px;border-radius:50%;background:#2fd08a;margin-right:6px}' +
      '.br-win .bw-go{display:flex;justify-content:center;margin-top:14px}' +
      '.br-win .mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}' +
      '.br-win .mv{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:10px;border:2px solid #34509a;background:rgba(40,60,130,.35);color:#fff;font:inherit;text-align:left;cursor:pointer}' +
      '.br-win .mv.on{border-color:#ffd23f;background:rgba(255,210,63,.14);box-shadow:0 0 12px rgba(255,210,63,.3)}' +
      '.br-win .mv .ic{flex:none;width:36px;height:36px;display:flex;align-items:center;justify-content:center}' +
      '.br-win .mv b{display:block;font-size:14px}.br-win .mv small{display:block;font-size:11px;color:#c8d6f2;line-height:1.25}' +
      '.br-win .mv .lv{margin-left:auto;flex:none;font-size:11px;font-weight:900;color:#ffd23f}' +
      '.br-win .mv .evo{font-size:11px;font-weight:700;color:#9fb2d8}.br-win .mv em{font-style:normal;color:#ffd23f}' +
      '@media (max-width:560px){.br-win .row{flex-wrap:wrap}.br-win .ctl{width:100%;justify-content:flex-end}}';
    document.head.appendChild(s);
  }
  function statDef(id) { var L = (PS.LevelUp && PS.LevelUp.STATS) || []; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }
  function ptsUsed() { var n = 0; for (var k in st.alloc) n += st.alloc[k]; return n; }
  // try the allocation on a copy of the Pokémon to know which stats reached their cap
  function simulate() {
    var p = PS.Game.player, c = Object.assign(Object.create(Object.getPrototypeOf(p)), p), capped = {};
    PTS_STATS.forEach(function (k) {
      var S = statDef(k); if (!S) return;
      for (var i = 0; i < st.alloc[k]; i++) { if (S.capped && S.capped(c)) break; S.apply(c); }
      capped[k] = !!(S.capped && S.capped(c));
    });
    return capped;
  }
  function openPoints() {
    winCss();
    if (!ptsUi) {
      ptsUi = document.createElement('div'); ptsUi.className = 'br-win'; ptsUi.id = 'br-points'; ptsUi.setAttribute('translate', 'no');
      ptsUi.innerHTML = '<div class="bw"><div class="bw-h"><div><small>UPGRADE MENU</small><h3>Distribute Points</h3></div>' +
        '<div class="bw-left">POINTS LEFT <b></b></div></div><div class="rows"></div>' +
        '<div class="bw-f"><span><i></i>Stat Cap: Flexible</span><span class="tot"></span></div>' +
        '<div class="bw-go"><button class="btn gold" type="button" data-br="ok">Confirm</button></div></div>';
      document.body.appendChild(ptsUi);
      ptsUi.querySelector('[data-br="ok"]').onclick = confirmPoints;
    }
    var rows = ptsUi.querySelector('.rows'); rows.innerHTML = '';
    PTS_STATS.forEach(function (k) {
      var S = statDef(k); if (!S) return;
      var r = document.createElement('div'); r.className = 'row'; r.dataset.k = k; r.style.setProperty('--c', STAT_COL[k]);
      r.innerHTML = '<div class="ic">' + (PS.Icons ? PS.Icons.html(S.icon, 28) : '') + '</div>' +
        '<div class="tx"><b>' + PS.T(S.title) + '</b><span class="tag">UPGRADE</span><small>' + PS.T(S.desc) +
        ' <span class="cap"></span></small></div>' +
        '<div class="ctl"><button type="button" data-d="-5">-5</button><button type="button" data-d="-1">-</button>' +
        '<div class="val"></div><button type="button" data-d="1">+</button><button type="button" data-d="5">+5</button></div>';
      r.querySelectorAll('button').forEach(function (b) {
        b.onclick = function () { addPts(k, +b.dataset.d); };
      });
      rows.appendChild(r);
    });
    renderPoints();
    ptsUi.classList.add('show');
  }
  function addPts(k, d) {
    for (var i = 0; i < Math.abs(d); i++) {
      if (d < 0) { if (st.alloc[k] <= 0) break; st.alloc[k]--; continue; }
      if (ptsUsed() >= PREP_LEVELS || simulate()[k]) break;
      st.alloc[k]++;
    }
    try { PS.Audio.sfx('click'); } catch (e) {}
    renderPoints();
  }
  function renderPoints() {
    var left = PREP_LEVELS - ptsUsed(), capped = simulate(), allCapped = true;
    ptsUi.querySelector('.bw-left b').textContent = left;
    ptsUi.querySelector('.tot').innerHTML = 'Total Invested: <b>' + ptsUsed() + '</b> / ' + PREP_LEVELS;
    ptsUi.querySelectorAll('.row').forEach(function (r) {
      var k = r.dataset.k, n = st.alloc[k];
      if (!capped[k]) allCapped = false;
      r.querySelector('.val').textContent = n;
      r.querySelector('.cap').textContent = capped[k] ? '· MAX' : '';
      r.querySelector('[data-d="-5"]').disabled = r.querySelector('[data-d="-1"]').disabled = n <= 0;
      r.querySelector('[data-d="1"]').disabled = r.querySelector('[data-d="5"]').disabled = left <= 0 || capped[k];
    });
    ptsUi.querySelector('[data-br="ok"]').disabled = left > 0 && !allCapped;
  }
  function confirmPoints() {
    var p = PS.Game.player;
    if (!p) return;
    PTS_STATS.forEach(function (k) {
      var S = statDef(k); if (!S) return;
      for (var i = 0; i < st.alloc[k]; i++) { if (S.capped && S.capped(p)) break; S.apply(p); }
    });
    try { PS.Audio.sfx('confirm'); } catch (e) {}
    closePoints();
    st.step = 'moves';
    openMoves();
  }
  function closePoints() { if (ptsUi) ptsUi.classList.remove('show'); }

  // ------------------------------------------------------------ step 2: 4 moves at max level, bonded
  function poolOf(p) {
    var ids = [];
    try { ids = PS.Moves.poolFor(p.mon) || []; } catch (e) {}
    var seen = {};
    return ids.filter(function (id) { if (seen[id] || !PS.Moves.BY_ID[id]) return false; seen[id] = 1; return true; });
  }
  function openMoves() {
    winCss();
    var p = PS.Game.player; if (!p) return;
    if (!movUi) {
      movUi = document.createElement('div'); movUi.className = 'br-win'; movUi.id = 'br-moves'; movUi.setAttribute('translate', 'no');
      movUi.innerHTML = '<div class="bw"><div class="bw-h"><div><small>MOVE SELECTION</small><h3>Pick 4 Moves</h3></div>' +
        '<div class="bw-left">PICKED <b></b></div></div>' +
        '<p style="margin:-4px 0 12px;font-size:13px;color:#c8d6f2">They start at max level (evolved when the move has an evolution) and bonded together: all 4 fire at the same time.</p>' +
        '<div class="mgrid"></div><div class="bw-go"><button class="btn gold" type="button" data-br="ok">Confirm</button></div></div>';
      document.body.appendChild(movUi);
      movUi.querySelector('[data-br="ok"]').onclick = confirmMoves;
    }
    st.pickMoves = st.pickMoves || [];
    var grid = movUi.querySelector('.mgrid'); grid.innerHTML = '';
    poolOf(p).forEach(function (id) {
      var m = PS.Moves.BY_ID[id], b = document.createElement('button');
      var evo = PS.Moves.EVO && PS.Moves.EVO[id];
      var mods = evo && (m.evoText || (PS.Moves.EVO_MODS[m.kind] && PS.Moves.EVO_MODS[m.kind].t));
      b.type = 'button'; b.className = 'mv'; b.dataset.id = id;
      b.innerHTML = '<span class="ic">' + (PS.Icons ? PS.Icons.html('move:' + id, 32) : '') + '</span><span><b>' +
        (evo ? PS.T(evo[0]) + ' <span class="evo">★ ' + PS.T(m.name) + '</span>' : PS.T(m.name)) + '</b>' +
        '<small>' + PS.T(m.desc || '') + (mods ? ' <em>' + PS.T(mods) + '</em>' : '') + '</small></span>' +
        '<span class="lv">' + (evo ? 'EVOLVED' : 'Lv.' + (m.maxLvl || 1)) + '</span>';
      b.onclick = function () {
        var i = st.pickMoves.indexOf(id);
        if (i >= 0) st.pickMoves.splice(i, 1);
        else if (st.pickMoves.length < PICK_MOVES) st.pickMoves.push(id);
        try { PS.Audio.sfx('click'); } catch (e) {}
        renderMoves();
      };
      grid.appendChild(b);
    });
    renderMoves();
    movUi.classList.add('show');
  }
  function renderMoves() {
    var need = Math.min(PICK_MOVES, poolOf(PS.Game.player).length);
    movUi.querySelector('.bw-left b').textContent = st.pickMoves.length + '/' + need;
    movUi.querySelectorAll('.mv').forEach(function (b) { b.classList.toggle('on', st.pickMoves.indexOf(b.dataset.id) >= 0); });
    movUi.querySelector('[data-br="ok"]').disabled = st.pickMoves.length < need;
  }
  function confirmMoves() {
    var p = PS.Game.player; if (!p || !st.pickMoves.length) return;
    var inst = st.pickMoves.map(function (id) {
      var d = PS.Moves.BY_ID[id], m = PS.Moves.instance(id, d.maxLvl || 1);
      try { if (PS.Moves.EVO && PS.Moves.EVO[id]) PS.Moves.evolve(m); } catch (e) {}   // evolved form when it exists
      return m;
    });
    try { PS.Projectiles.clearOrbs(p); } catch (e) {}
    p.moves = inst;
    p.slots = [inst.slice()];
    p.active = 0;
    p.bonds = 0; p.bondLater = false;
    try { p.bondStale(); } catch (e) {}
    try { PS.Audio.sfx('legend'); } catch (e) {}
    closeMoves();
    st.step = 'item';
    openItems();
  }
  function closeMoves() { if (movUi) movUi.classList.remove('show'); }

  function openStep() {
    if (st.step === 'points') openPoints();
    else if (st.step === 'moves') openMoves();
    else if (st.step === 'item') openItems();
  }

  // ------------------------------------------------------------ item picker (one item for the fight)
  // items whose effect does nothing in a single boss fight are left out
  var NO_ITEMS = { amuletcoin: 1, shinycharm: 1, luckyegg: 1, lansatberry: 1 };
  var itemsUi = null;
  function itemName(id) { var it = PS.Items && PS.Items.BY[id]; return it ? PS.T(it.name) : id; }
  function openItems() {
    if (!PS || !PS.Items) return;
    if (!itemsUi) {
      itemsUi = document.createElement('div'); itemsUi.id = 'br-items'; itemsUi.setAttribute('translate', 'no');
      itemsUi.innerHTML = '<div class="bri"><h3>CHOOSE YOUR ITEM</h3>' +
        '<p class="sub">You can hold only one item during the fight.</p><div class="grid"></div>' +
        '</div>';
      document.body.appendChild(itemsUi);
    }
    var grid = itemsUi.querySelector('.grid');
    grid.innerHTML = '';
    Object.keys(PS.Items.BY).forEach(function (id) {
      if (NO_ITEMS[id]) return;
      var it = PS.Items.BY[id], b = document.createElement('button');
      b.type = 'button'; b.className = 'it' + (st.item === id ? ' on' : '');
      b.innerHTML = '<span class="ic">' + (PS.Icons ? PS.Icons.html(id, 32) : '') + '</span><span><b>' +
        PS.T(it.name) + '</b><small>' + PS.T(it.desc) + '</small></span>';
      b.onclick = function () {
        var p = PS.Game.player;
        if (!p) return;
        try { p.equip(id); } catch (e) { console.error('[bossrush item]', e); }
        st.item = id;
        try { PS.Audio.sfx('confirm'); } catch (e) {}
        closeItems();
        st.step = 'done';
      };
      grid.appendChild(b);
    });
    itemsUi.classList.add('show');
  }
  function closeItems() { if (itemsUi) itemsUi.classList.remove('show'); }

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

  // Menu banner of map 6: there is no Arceus in this mode, so drop the "Arceus not beaten yet" line
  setInterval(function () {
    if (!PS || !PS.Maps || !PS.Maps.selected) return;
    var cur = null; try { cur = PS.Maps.selected(); } catch (e) {}
    var facts = document.querySelectorAll('#pp-info .pp-facts span');
    for (var i = 0; i < facts.length; i++) {
      var sp = facts[i], isArc = /arceus/i.test(sp.textContent || '');
      if (isArc) sp.style.display = cur === BR ? 'none' : '';
    }
  }, 250);

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
    hookAfter(ns, 'SPRITE_META', function (M) { if (M) for (var k in METAS) M[k] = METAS[k]; });
    hookAfter(ns, 'DEX_BY', function (D) {
      if (!D) return;
      BOSSES.forEach(function (B) {
        Object.defineProperty(D, B.skin, { configurable: true, enumerable: false, get: function () {
          var g = D[B.base] || {};
          return Object.assign({}, g, { dex: B.skin, name: B.name, types: B.types.slice(), leg: true });
        } });
      });
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
    hookAfter(ns, 'Player', function (P) {
      var pr = P && P.prototype;
      if (!pr || pr.__brXp) return;
      pr.__brXp = true;
      var gx = pr.gainXp;
      pr.gainXp = function () { if (isBR()) return 0; return gx.apply(this, arguments); };
    });
    // End screen: the game always talks about Arceus; in the Boss Rush use the real boss
    hookAfter(ns, 'RunUI', function (U) {
      if (!U || U.__br || typeof U.showOver !== 'function') return;
      U.__br = true;
      var so = U.showOver;
      U.showOver = function (info) {
        var br = isBR(), B = boss(), e = st.e;
        var hpLeft = e && !e.dead && e.maxHp ? Math.max(1, Math.round(100 * e.hp / e.maxHp)) : 0;
        var r = so.apply(this, arguments);
        var fix = function () {
          try {
            var title = document.getElementById('over-title'), stats = document.getElementById('over-stats');
            if (stats) stats.querySelectorAll('div').forEach(function (d) {
              // breakdown line under "PokéCoins earned": a key the game never translated
              if (d.children.length === 0 && /recogidas/.test(d.textContent)) d.textContent = d.textContent.replace(/recogidas/g, 'pickups');
              if (br && d.children.length === 0 && /\barceus\b/i.test(d.textContent)) d.textContent = d.textContent.replace(/\barceus\b/ig, 'boss reward');
            });
            if (!br || !title) return;
            if (info && info.win) {
              title.setAttribute('translate', 'no');
              title.textContent = 'Victory over ' + B.name + '!';
              var first = stats && stats.querySelector('div > span');
              if (first) { first.setAttribute('translate', 'no'); first.textContent = B.name + ' defeated'; }
            } else if (stats && st.phase === 'fight' && hpLeft && !stats.querySelector('.br-left')) {
              var d = document.createElement('div');
              d.className = 'br-left';
              d.style.gridColumn = '1/-1'; d.setAttribute('translate', 'no');
              d.innerHTML = '<span>' + B.name + '</span><b class="gold">' + hpLeft + '% HP left</b>';
              stats.insertBefore(d, stats.firstChild);
            }
          } catch (er) { console.error('[bossrush over]', er); }
        };
        fix(); setTimeout(fix, 0);
        return r;
      };
    });
    hookAfter(ns, 'Training', function (T) {
      if (!T || T.__brFx || typeof T.drawables !== 'function') return;
      T.__brFx = true;
      var drw = T.drawables;
      T.drawables = function () {
        var list = drw.apply(this, arguments) || [];
        if (!isBR() || (!fx.length && !st.shieldOn)) return list;
        var d = []; try { d = fxDrawables(); } catch (e) { console.error('[bossrush fx]', e); }
        return d.length ? list.concat(d) : list;
      };
    });
    hookAfter(ns, 'Net', function (N) { if (N && N.on && !N.__br) { N.__br = true; N.on(onNet); } });
    requestAnimationFrame(uiLoop);
    window.__bossrush = { state: function () { return st; }, BOSSES: BOSSES, TUNE: TUNE, open: openSel,
      start: startBoss, prog: prog, mech: function (m) { var e = st.e; if (e && START[m]) { say(MECH_SAY[m], 3); START[m](e); } },
      fx: function () { return fx; } };
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
