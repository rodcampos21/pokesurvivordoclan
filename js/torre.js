/* =====================================================================
 * TORRE SEM FIM — modo de jogo com 100 andares
 * ---------------------------------------------------------------------
 *  · Andares normais: derrote a cota de inimigos para subir.
 *  · A cada 5º andar (5, 10, … 95): um chefe SHINY aleatório.
 *    O andar só termina quando ele cai.
 *  · Andar 100: Arceus shiny, que pode (e deve) ser derrotado.
 *    Nada mais nasce nesse andar: é só ele.
 *  · Sem grietas (rifts) e sem a Sentença de Arceus.
 *  · Mais difícil que os níveis normais, mas pensado para ser zerável.
 *    Escala para 1, 2, 3 ou 4 jogadores.
 *
 * Como funciona: o app.min.js expõe o namespace interno em window.__PS.
 * Este arquivo intercepta a criação dos módulos (Maps, Spawner, Rift,
 * Judgment) e acrescenta a lógica da torre, sem reescrever o jogo.
 * ===================================================================== */
(function () {
  'use strict';

  // ---------------------------------------------------------------- ajustes
  var TOWER = 5;              // número do mapa
  var FLOORS = 100;
  var BOSS_EVERY = 5;
  var SEC_PER_FLOOR = 12;     // "tempo virtual" por andar (dita a força dos inimigos)
  var FLOOR_MAX_TIME = 75;    // segundos: se a cota não sair, o andar sobe mesmo assim

  // Força dos inimigos (multiplica a escala normal do jogo).
  // Começa um pouco acima do nível 1 e termina perto do nível 3 (Infierno).
  function r2(x) { return Math.round(x * 100) / 100; }
  function kFor(f) { return r2(1.50 + 0.45 * (f / FLOORS)); }   // vida   1.50 → 1.95
  function dkFor(f) { return r2(1.50 + 0.25 * (f / FLOORS)); }  // dano   1.50 → 1.75
  var SPAWN_K = 1.25;       // +25% de inimigos nascendo (e nas marés)

  // Jogadores: o jogo já escala vida (×1+0,3/jogador extra) e quantidade de
  // inimigos (×1+0,75/jogador extra). Aqui somamos um pouco nos chefes e na cota.
  function teamHp(n) { return 1 + 0.30 * Math.max(0, n - 1); }
  function teamBossExtra(n) { return n > 1 ? 1.4 + 0.1 * (n - 2) : 1; }   // 1 / 1.4 / 1.5 / 1.6
  function teamRate(n) { return 1 + 0.75 * Math.max(0, n - 1); }

  // Vínculos: no modo normal vêm dos rifts. Na torre (sem rifts), cada jogador
  // ganha +1 Vínculo a cada 3 andares concluídos (3, 6, 9, … 99).
  var BOND_EVERY = 3;
  // Itens: cada chefe derrotado dá um item sorteado para CADA jogador (individual).


  // ---------------------------------------------------------------- estado
  var PS = null;
  var st = fresh();
  function fresh() {
    return {
      floor: 1, kills0: 0, quota: 10, floorT: 0,
      boss: null, bossDone: false, arceus: null,
      won: false, winT: 0, used: {}, biome: -1, announced: 0
    };
  }

  var MAP = {
    n: TOWER,
    name: 'Torre Sem Fim',
    tower: true,
    get biome() { return biomeFor(st.floor); },
    types: ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
      'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'],
    arceusK: 10, legendK: 1, arceusMin: 500000, legendMin: 50000,
    coins: 60000, t10: 10,
    // durante a partida acompanha o andar; no menu mostra o valor do andar 1
    get k() { return inRun() ? kFor(st.floor) : kFor(1); },
    get dk() { return inRun() ? dkFor(st.floor) : dkFor(1); },
    bonus: 0.5,
    diff: 'Torre',
    col: '#ffd23f'
  };

  function inRun() {
    var s = PS && PS.Game && PS.Game.state;
    return !!s && s !== 'ui' && s !== 'over';
  }
  function isTower() { return !!(PS && PS.Maps && PS.Maps.cur && PS.Maps.cur.tower); }
  function playersOf(p) { return Array.isArray(p) ? p : (p ? [p] : []); }
  function teamSize() {
    try { return Math.max(1, PS.Game.everyone().length); } catch (e) { return 1; }
  }
  function vtime() {
    var prog = st.quota > 0 ? Math.min(1, killsOnFloor() / st.quota) : 0;
    return SEC_PER_FLOOR * (st.floor - 1) + SEC_PER_FLOOR * prog;
  }
  function killsOnFloor() {
    var p = PS.Game.player;
    return p ? Math.max(0, (p.kills || 0) - st.kills0) : 0;
  }
  // Cenário: o CASTELO INFERNAL — interior escuro de um castelo no inferno.
  // 3 salões exclusivos da torre, trocando a cada chefe derrotado, em loop
  // (andares 1-5 Salão das Brasas, 6-10 Cripta das Cinzas, 11-15 Trono Carmesim…).
  // Piso de lajotas e tochas nas paredes são desenhados por cima (ver castleGround).
  var HELL = [
    { // Salão das Brasas: pedra escura, fossos de lava, brasas no chão
      name: 'Salão das Brasas', liquid: 'lava',
      floor: ['#1b1517', '#1f181a', '#181214'], dirt: ['#151012', '#181214', '#120e10'],
      speck: '#110c0e', light: '#2c2023', flowers: ['#7a1e0e', '#a8380f', '#5a1010'],
      wallTop: ['#2a2226', '#30272b', '#251e21'], wallLight: '#4a3c42', wallEdge: '#030202',
      wallFace: ['#171113', '#130e10'], wallFaceDark: '#070505',
      liq: '#e0400f', liqDeep: '#8a1a08', foam: '#ffb04a', shore: '#0f0909', prop: 'crystal',
      leaf: ['#221c1f', '#2f272b', '#40363b', '#7a2a1a'], trunk: ['#120d0f', '#1c1517'],
      rock: ['#2a2326', '#3a3135', '#4e4448'], grass: ['#1e1719', '#271d20', '#3a2422'],
      castle: { tile: '#0b0809', tileHi: '#2a2124' }
    },
    { // Cripta das Cinzas: pedra cinza-chumbo, canais de sangue
      name: 'Cripta das Cinzas', liquid: 'lava',
      floor: ['#1c1b1e', '#201f22', '#18171a'], dirt: ['#161518', '#19181b', '#131215'],
      speck: '#121114', light: '#2e2c31', flowers: ['#3a3438', '#5a1414', '#2a2628'],
      wallTop: ['#26252a', '#2c2b30', '#222126'], wallLight: '#44424a', wallEdge: '#020203',
      wallFace: ['#141317', '#100f13'], wallFaceDark: '#060508',
      liq: '#6a0a0e', liqDeep: '#3a0406', foam: '#b0302a', shore: '#0d0c0e', prop: 'crystal',
      leaf: ['#1e1d21', '#2a292e', '#3a383f', '#55535c'], trunk: ['#0e0d10', '#18171b'],
      rock: ['#28272c', '#38363d', '#4c4a52'], grass: ['#1b1a1d', '#242226', '#2e2b30'],
      castle: { tile: '#09090b', tileHi: '#2b2a2f' }
    },
    { // Trono Carmesim: mármore negro-arroxeado, poços de miasma, cristais de sangue
      name: 'Trono Carmesim', liquid: 'poison',
      floor: ['#170c13', '#1b0e16', '#140a10'], dirt: ['#12080e', '#150a10', '#10070c'],
      speck: '#0e060b', light: '#2c1222', flowers: ['#6a0a1e', '#8a1030', '#4a0816'],
      wallTop: ['#1f1019', '#25131e', '#1b0e16'], wallLight: '#43243a', wallEdge: '#020001',
      wallFace: ['#12080e', '#0e060b'], wallFaceDark: '#050204',
      liq: '#5e1446', liqDeep: '#36082a', foam: '#d0489a', shore: '#0c050a', prop: 'crystal',
      leaf: ['#3a0610', '#5a0a18', '#8a1424', '#c42234'], trunk: ['#14080e', '#200c16'],
      rock: ['#22121c', '#321a2a', '#46263a'], grass: ['#1c0a14', '#2a0e1e', '#3e1228'],
      castle: { tile: '#070306', tileHi: '#2a1424' }
    }
  ];
  var hellIdx = [];             // posições dos 3 infernos na lista de cenários do jogo
  function installHell(T) {
    if (hellIdx.length || !T || !T.BIOMES) return;
    HELL.forEach(function (b) { hellIdx.push(T.BIOMES.length); T.BIOMES.push(b); });
  }
  function mapLoop() {
    if (!hellIdx.length) { try { installHell(PS.Tiles); } catch (e) {} }
    return hellIdx.length ? hellIdx : [2];
  }
  function biomeFor(f) {
    var list = mapLoop();
    return list[Math.floor((f - 1) / BOSS_EVERY) % list.length];
  }
  function biomeName(b) {
    try { return PS.T(PS.Tiles.BIOMES[b].name); } catch (e) { return ''; }
  }
  function say(t, d) { try { PS.Spawner.say(t, d || 3); } catch (e) {} }
  function isBossFloor(f) { return f % BOSS_EVERY === 0 && f < FLOORS; }

  // ---------------------------------------------------------------- andares
  function quotaFor(f, n) {
    var T = SEC_PER_FLOOR * f, rate = PS.Spawner.rate ? PS.Spawner.rate(T) : 1;
    var q = Math.round(Math.max(10, Math.min(160, rate * SEC_PER_FLOOR * 0.9 * SPAWN_K)) * teamRate(n));
    return q;
  }

  function enterFloor(f, players) {
    st.floor = f;
    st.floorT = 0;
    st.boss = null;
    st.bossDone = false;
    st.kills0 = PS.Game.player ? (PS.Game.player.kills || 0) : 0;
    st.quota = quotaFor(f, players.length || teamSize());

    var b = biomeFor(f), newMap = '';
    if (b !== st.biome) {
      st.biome = b;
      if (f > 1) {
        try { PS.World.setBiome(b); } catch (e) {}
        newMap = ' · ' + biomeName(b);
      }
    }

    if (f === FLOORS) {
      say('Andar 100/100 · O topo da torre…', 4);
      spawnArceus(players);
    } else if (isBossFloor(f)) {
      say('Andar ' + f + '/100 · Chefe shiny!', 3.5);
      spawnFloorBoss(players);
    } else {
      say('Andar ' + f + '/100' + newMap, newMap ? 3.4 : 2.4);
    }
    try { PS.Audio.sfx(f % BOSS_EVERY === 0 ? 'boss' : 'levelup'); } catch (e) {}
  }

  function floorCleared(players) {
    if (st.floor >= FLOORS) return;
    var f = st.floor, parts = [];
    if (isBossFloor(f)) parts.push('item individual');
    if (f % BOND_EVERY === 0) parts.push('+1 Vínculo');
    // o aviso vai para todos (no coop o anfitrião o transmite); cada jogador
    // recebe a própria recompensa ao ver o aviso (ver S.say mais abaixo)
    if (parts.length) say('Recompensa do andar ' + f + ': ' + parts.join(' · '), 3.2);
    enterFloor(f + 1, players);
  }

  // ---------------------------------------------------------------- chefes
  function pickTarget(players) {
    var alive = players.filter(function (p) { return p && !p.dead; });
    return alive.length ? alive[Math.floor(Math.random() * alive.length)] : players[0] || PS.Game.player;
  }
  function edgePos(p) {
    var a = Math.random() * 6.2832;
    var r = PS.Camera.outerRadius() + 10 + Math.random() * 60;
    for (var i = 0; i < 10; i++) {
      var x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r * 0.9;
      if (!PS.World.isFree || PS.World.isFree(x, y, 14)) return [x, y];
      a += 0.7;
    }
    return [p.x + Math.cos(a) * r, p.y + Math.sin(a) * r * 0.9];
  }

  function slotStats(idx) {
    // interpola a tabela de chefes do jogo (6 faixas) pelos 19 chefes da torre
    var S = PS.Enemies.BOSS_SLOTS;
    var s = (idx - 1) / 18 * (S.length - 1);
    var i = Math.min(S.length - 2, Math.floor(s)), t = s - i;
    function L(k) { return S[i][k] + (S[i + 1][k] - S[i][k]) * t; }
    return { hp: L('hp'), dmg: L('dmg'), xp: L('xp'), bmin: S[i].bst[0] + (S[i + 1].bst[0] - S[i].bst[0]) * t };
  }

  function pickBossMon(idx) {
    var lo = 440 + idx * 9, hi = 540 + idx * 12;
    function ok(d) {
      return d && d.dex !== 493 && PS.SPRITE_META && PS.SPRITE_META[d.dex] &&
        PS.Sprites.hasShiny(d.dex) && !st.used[d.dex];
    }
    var pool = PS.DEX.filter(function (d) { return ok(d) && d.bst >= lo && d.bst <= hi; });
    if (!pool.length) pool = PS.DEX.filter(function (d) { return ok(d) && d.bst >= 480; });
    if (!pool.length) pool = PS.DEX.filter(function (d) { return ok(d); });
    var m = pool[Math.floor(Math.random() * pool.length)];
    st.used[m.dex] = 1;
    return m;
  }

  function behaviorFor(m) {
    var sp = (m.spd - 78) / 0.42;
    var r = Math.random();
    if (r < 0.3) return 'ranged';
    return sp > 90 ? 'charger' : 'chase';
  }

  function spawnFloorBoss(players) {
    var idx = st.floor / BOSS_EVERY;           // 1..19
    var n = players.length || teamSize();
    var s = slotStats(idx);
    var m = pickBossMon(idx);
    var T = SEC_PER_FLOOR * st.floor;
    var bs = PS.Enemies.bossScale(T, idx >= 8 ? 2 : 0);
    var spd = Math.round(Math.max(40, Math.min(100, 40 + 0.5 * ((m.spd - 78) / 0.42))));
    // 0,45 no andar 5 (≈ 1º chefe do nível 1) → 0,55 no andar 95 (≈ último chefe do nível 3)
    var mult = 0.45 + 0.10 * (idx - 1) / 18;
    var hp = s.hp * 1.35 * mult * bs.hp * teamHp(n) * teamBossExtra(n);
    // nunca fácil demais: pelo menos alguns segundos do DPS real do grupo
    // (makeShiny() dobra a vida depois, então o mínimo efetivo é o dobro)
    hp = Math.max(hp, 4 * PS.Stats.hpRef());
    var beh = behaviorFor(m);
    var def = {
      dex: m.dex, name: m.name, hp: Math.round(hp), spd: spd,
      dmg: Math.round(1.2 * s.dmg), xp: Math.round(s.xp),
      behavior: beh, shotDmg: Math.round(0.55 * s.dmg), shotCd: 1.1, range: 260
    };
    var p = pickTarget(players), pos = edgePos(p);
    var e = new PS.Enemy(def, pos[0], pos[1], PS.Maps.sc({ hp: 1, dmg: bs.dmg, spd: 1 }), true);
    e.castK = 1 + 0.04 * idx;
    e.towerBoss = true;
    e.makeShiny();                         // antes do add: o coop envia o shiny junto
    PS.EnemyMgr.add(e);
    st.boss = e;
    try { PS.Sprites.preload([m.dex], 4000, true); } catch (er) {}
    say(e.name + ' shiny apareceu! (andar ' + st.floor + ')', 3.4);
    try { PS.Camera.kick(1.1); PS.Audio.sfx('boss'); } catch (er) {}
  }

  function spawnArceus(players) {
    // o topo é só dele: os inimigos que sobraram do andar anterior desaparecem
    try {
      PS.EnemyMgr.all().slice().forEach(function (e) {
        if (!e || e.dead || e.boss || e.remote) return;
        try { PS.FX.burst(e.x, e.y - 10, '#ffd23f', 8, 90); } catch (er) {}
        PS.EnemyMgr.removeRemote(e.id, false);                     // some sem dar dano/recompensa
        if (PS.Coop && PS.Coop.isHost) PS.Coop.enemyGone(e, false);
      });
    } catch (er) {}
    var n = players.length || teamSize();
    var T = SEC_PER_FLOOR * FLOORS;
    var bs = PS.Enemies.bossScale(T, 2);       // vida ×5, dano ×3
    var hp = 40000 * bs.hp * teamHp(n) * teamBossExtra(n);
    hp = Math.max(hp, 30 * PS.Stats.hpRef()); // pelo menos ~1 min do DPS do grupo (×2 do shiny)
    var name = (PS.DEX_BY[493] && PS.DEX_BY[493].name) || 'Arceus';
    var def = {
      dex: 493, name: name, hp: Math.round(hp), spd: 72,
      dmg: 92, xp: 6000, behavior: 'ranged', shotDmg: 55, shotCd: 0.85, range: 300
    };
    var p = pickTarget(players), pos = edgePos(p);
    var e = new PS.Enemy(def, pos[0], pos[1], PS.Maps.sc({ hp: 1, dmg: bs.dmg, spd: 1 }), true);
    e.towerArceus = true;
    e.castK = 1.6;
    e.makeShiny();
    try {
      e.bossInit();
      e.ai.ranged = ['rain', 'beam', 'nova', 'volley'];   // todo o repertório
      e.ai.melee = ['slam', 'dash', 'leap'];
    } catch (er) {}
    PS.EnemyMgr.add(e);
    st.arceus = e;
    try { PS.Sprites.preload([493], 4000, true); } catch (er) {}
    say(name + ' shiny desceu para lutar! Derrote-o!', 4);
    try { PS.Camera.kick(1.6); PS.Audio.sfx('legend'); } catch (er) {}
  }

  // ---------------------------------------------------------------- loop (anfitrião/solo)
  function tick(dt, players) {
    if (st.won) {
      st.winT += dt;
      if (st.winT > 2.2 && !st.winSent) {
        st.winSent = true;
        try { PS.Game.winRun(TOWER); } catch (e) {}
      }
      return;
    }
    if (st.announced === 0) { st.announced = 1; enterFloor(st.floor || 1, players); return; }
    st.floorT += dt;

    if (st.floor === FLOORS) {
      if (st.arceus && st.arceus.dead) {
        st.won = true;
        say('ARCEUS FOI DERROTADO! A Torre Sem Fim foi conquistada!', 5);
        try { PS.Audio.sfx('legend'); } catch (e) {}
      } else if (!st.arceus || (!st.arceus.dead && PS.EnemyMgr.all().indexOf(st.arceus) < 0)) {
        spawnArceus(players);              // sumiu (ex.: retomada de partida): volta
      }
      return;
    }
    if (isBossFloor(st.floor)) {
      if (!st.boss || (!st.boss.dead && PS.EnemyMgr.all().indexOf(st.boss) < 0)) spawnFloorBoss(players);
      if (st.boss && st.boss.dead) floorCleared(players);
      return;
    }
    if (killsOnFloor() >= st.quota || st.floorT >= FLOOR_MAX_TIME) floorCleared(players);
  }

  // ---------------------------------------------------------------- Vínculo
  var rewardsGiven = {};
  function giveBond() {
    var p = PS.Game.player;
    if (!p) return;
    p.bonds = (p.bonds || 0) + 1;            // o jogo oferece a escolha sozinho no próximo quadro
    try {
      PS.FX.dmgText(p.x, p.y - p.bodyH - 10, '¡Vínculo!', '#ff8ad8', true);
      PS.FX.ring(p.x, p.y, 8, 90, '#ff8ad8', 0.7, 5);
    } catch (e) {}
  }

  function giveItem() {
    var p = PS.Game.player;
    if (!p || p.dead || !isTower()) return;
    var id = PS.Items.roll(p.item);           // sorteia um item diferente do que já carrega
    try {
      PS.FX.dmgText(p.x, p.y - p.bodyH - 26, 'Item!', '#9ae6ff', true);
      PS.Audio.sfx('shinyGet');
    } catch (e) {}
    PS.Game.giveItem(id);                     // equipa, ou pergunta se quer trocar
  }

  // ---------------------------------------------------------------- chão do castelo
  // Desenhado logo depois do chão do jogo e antes dos líquidos/personagens:
  // lajotas em fileiras desencontradas e tochas nas paredes viradas para o salão.
  function hash2(x, y, k) {
    var h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function castleBiome() {
    if (!isTower() || !hellIdx.length) return null;
    var i = hellIdx.indexOf(st.biome);
    return i >= 0 ? HELL[i] : null;
  }
  function castleGround(ctx, cam) {
    var B = castleBiome();
    if (!B || !B.castle) return;
    var W = PS.World, TS = W.TS || 32, C = PS.Camera;
    var x0 = Math.floor(C.left() / TS) - 1, y0 = Math.floor(C.top() / TS) - 1;
    var x1 = Math.ceil((C.left() + C.w) / TS) + 1, y1 = Math.ceil((C.top() + C.h) / TS) + 2;
    var t = performance.now() / 1000, torches = [];
    ctx.save();
    // lajotas: 2×1 blocos, fileiras desencontradas
    for (var ty = y0; ty <= y1; ty++) {
      var off = (ty & 1) ? 1 : 0;
      for (var tx = x0; tx <= x1; tx++) {
        var cx = tx * TS + TS / 2, cy = ty * TS + TS / 2;
        if (W.isWall(cx, cy)) {
          // parede com salão logo abaixo: lugar de tocha
          if (!W.isWall(cx, cy + TS) && !W.isLiquid(cx, cy + TS) && hash2(tx, ty, 7) < 0.16) torches.push([cx, ty * TS + TS - 6, tx, ty]);
          continue;
        }
        if (W.isLiquid(cx, cy)) continue;
        var px = tx * TS, py = ty * TS;
        ctx.fillStyle = B.castle.tile;
        ctx.globalAlpha = 0.85;
        ctx.fillRect(px, py, TS, 2);                                   // junta horizontal
        if (((tx + off) & 1) === 0) ctx.fillRect(px, py, 2, TS);       // junta vertical (a cada 2 blocos)
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = B.castle.tileHi;
        ctx.fillRect(px, py + 2, TS, 1);                               // brilho da borda da lajota
        if (hash2(tx, ty, 3) < 0.12) {                                 // lajota rachada
          ctx.globalAlpha = 0.6; ctx.fillStyle = B.castle.tile;
          var rx = px + 6 + Math.floor(hash2(tx, ty, 4) * 14), ry = py + 8;
          ctx.fillRect(rx, ry, 2, 6); ctx.fillRect(rx + 2, ry + 6, 2, 6); ctx.fillRect(rx + 4, ry + 12, 2, 5);
        }
      }
    }
    ctx.globalAlpha = 1;
    // tochas: suporte de ferro, chama tremulando e luz quente
    for (var i = 0; i < torches.length; i++) {
      var tc = torches[i], x = tc[0], y = tc[1], fl = 0.85 + 0.15 * Math.sin(t * 9 + tc[2] * 1.7) + 0.08 * Math.sin(t * 23 + tc[3]);
      ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(x, y - 8, 2, x, y - 8, 120 * fl);
      g.addColorStop(0, 'rgba(255,150,60,0.42)');
      g.addColorStop(0.35, 'rgba(220,70,20,0.16)');
      g.addColorStop(1, 'rgba(120,20,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 130, y - 140, 260, 260);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#1a1414'; ctx.fillRect(x - 3, y - 6, 6, 10);   // suporte
      ctx.fillStyle = '#3a3030'; ctx.fillRect(x - 5, y - 8, 10, 3);
      var fh = 9 + 4 * fl;
      ctx.fillStyle = '#ff5a14'; ctx.fillRect(x - 4, y - 8 - fh, 8, fh);
      ctx.fillStyle = '#ffb23a'; ctx.fillRect(x - 2, y - 8 - fh + 3, 4, fh - 3);
      ctx.fillStyle = '#fff1a8'; ctx.fillRect(x - 1, y - 8 - fh + 6, 2, Math.max(2, fh - 8));
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- clima do inferno
  // vinheta vermelho-escura e brasas subindo pela tela (só na torre, em jogo)
  var hellFx = null, embers = [], hellLast = 0;
  function ensureHellFx() {
    if (hellFx) return hellFx;
    var wrap = document.createElement('div');
    wrap.id = 'tower-hell';
    wrap.innerHTML = '<canvas></canvas>';
    document.body.appendChild(wrap);
    var st2 = document.createElement('style');
    st2.textContent =
      '#tower-hell{position:fixed;inset:0;z-index:4;pointer-events:none;display:none;' +
      'background:radial-gradient(ellipse at 50% 55%,rgba(0,0,0,0) 30%,rgba(20,0,0,.55) 68%,rgba(5,0,0,.88) 100%)}' +
      '#tower-hell canvas{position:absolute;inset:0;width:100%;height:100%}' +
      '@media (prefers-reduced-motion:reduce){#tower-hell canvas{display:none}}';
    document.head.appendChild(st2);
    hellFx = { el: wrap, cv: wrap.querySelector('canvas') };
    return hellFx;
  }
  function hellLoop(now, show) {
    var fx = ensureHellFx();
    fx.el.style.display = show ? 'block' : 'none';
    if (!show) { embers.length = 0; return; }
    var cv = fx.cv, w = window.innerWidth, h = window.innerHeight;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    var dt = Math.min(0.05, (now - (hellLast || now)) / 1000); hellLast = now;
    var paused = PS.Game.state !== 'playing';
    while (embers.length < 26) {
      embers.push({ x: Math.random() * w, y: h + Math.random() * h * 0.6, v: 25 + Math.random() * 55,
        s: 1 + Math.random() * 2.2, ph: Math.random() * 6.28, a: 0.35 + Math.random() * 0.55 });
    }
    var c = cv.getContext('2d');
    c.clearRect(0, 0, w, h);
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      if (!paused) { e.y -= e.v * dt; e.ph += dt * 2; e.x += Math.sin(e.ph) * 12 * dt; }
      if (e.y < -10) { e.y = h + 10; e.x = Math.random() * w; }
      var fade = Math.min(1, e.y / (h * 0.35));
      c.globalAlpha = e.a * fade;
      c.fillStyle = i % 3 ? '#ff6a1f' : '#ffc23d';
      c.fillRect(Math.round(e.x), Math.round(e.y), Math.ceil(e.s), Math.ceil(e.s));
    }
    c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- HUD
  var hud = null, lastFloorSeen = 1;
  function ensureHud() {
    if (hud) return hud;
    hud = document.createElement('div');
    hud.id = 'tower-hud';
    hud.innerHTML = '<div class="th-t">TORRE SEM FIM</div><div class="th-f"></div><div class="th-bar"><i></i></div>';
    document.body.appendChild(hud);
    return hud;
  }
  function hudLoop() {
    requestAnimationFrame(hudLoop);
    if (!PS || !PS.Game) return;
    var stt = PS.Game.state;
    var show = isTower() && stt && stt !== 'ui' && stt !== 'over' && PS.Game.player;
    var h = ensureHud();
    h.style.display = show ? '' : 'none';
    try { hellLoop(performance.now(), !!show); } catch (e) {}
    if (!show) return;
    var host = !(PS.Coop && PS.Coop.active) || PS.Coop.isHost;
    var f = host ? st.floor : lastFloorSeen;
    var label = 'Andar ' + f + '/' + FLOORS;
    if (f === FLOORS) label += ' · ARCEUS';
    else if (isBossFloor(f)) label += ' · CHEFE';
    var fe = h.querySelector('.th-f');
    if (fe.textContent !== label) fe.textContent = label;
    var bar = h.querySelector('.th-bar i'), w = 0;
    if (host) {
      if (f === FLOORS && st.arceus) w = 1 - st.arceus.hp / st.arceus.maxHp;
      else if (isBossFloor(f) && st.boss) w = 1 - st.boss.hp / st.boss.maxHp;
      else w = st.quota ? Math.min(1, killsOnFloor() / st.quota) : 0;
      h.querySelector('.th-bar').style.display = '';
    } else h.querySelector('.th-bar').style.display = 'none';
    bar.style.width = Math.round(Math.max(0, Math.min(1, w)) * 100) + '%';
    h.classList.toggle('boss', f % BOSS_EVERY === 0);
  }

  // ---------------------------------------------------------------- ganchos nos módulos
  function hookModule(ns, name, fn) {
    var val;
    Object.defineProperty(ns, name, {
      configurable: true, enumerable: true,
      get: function () { return val; },
      set: function (v) { val = v; try { fn(v); } catch (e) { console.error('[torre]', name, e); } }
    });
  }

  function install(ns) {
    PS = ns;

    hookModule(ns, 'Maps', function (M) {
      if (M.LIST.indexOf(MAP) < 0) M.LIST.push(MAP);
      var isOpen = M.isOpen, selected = M.selected, set = M.set;
      M.isOpen = function (n) { return n === TOWER ? true : isOpen.apply(this, arguments); };
      M.selected = function () {
        var s = PS.DB && PS.DB.save;
        if (s && s.mapSel === TOWER) return TOWER;
        return selected.apply(this, arguments);
      };
      M.set = function (n) {
        if ((n | 0) === TOWER) { st = fresh(); }
        return set.apply(this, arguments);
      };
    });

    hookModule(ns, 'Spawner', function (S) {
      var update = S.update, reset = S.reset, snap = S.snap, restore = S.restore, sayF = S.say;
      S.reset = function () {
        var r = reset.apply(this, arguments);
        rewardsGiven = {};
        if (isTower()) {
          st = fresh();
          st.biome = biomeFor(1);
          try { S.debugSkip(1e9); } catch (e) {}   // sem os chefes da agenda normal
        }
        return r;
      };
      S.update = function (dt, players, time) {
        if (!isTower()) return update.apply(this, arguments);
        var ps = playersOf(players);
        tick(dt, ps);
        if (st.floor >= FLOORS) {        // andar 100: só o Arceus
          if (S.tickBanner) S.tickBanner(dt);
          return;
        }
        window.__spawnK = SPAWN_K;
        try { return update.call(this, dt, players, vtime()); }
        finally { window.__spawnK = 1; }
      };
      S.snap = function () {
        var o = snap.apply(this, arguments);
        if (isTower() && o) o.tower = { floor: st.floor, used: Object.keys(st.used) };
        return o;
      };
      S.restore = function (o) {
        var r = restore.apply(this, arguments);
        if (isTower() && o && o.tower) {
          st = fresh();
          st.floor = Math.max(1, Math.min(FLOORS, o.tower.floor | 0));
          (o.tower.used || []).forEach(function (d) { st.used[d] = 1; });
          st.biome = -1;
          try { S.debugSkip(1e9); } catch (e) {}
        }
        return r;
      };
      S.say = function (text) {
        var m = /^Andar (\d+)\/100/.exec(text || '');
        if (m) lastFloorSeen = +m[1];
        var r = /^Recompensa do andar (\d+): (.*)$/.exec(text || '');
        if (r && isTower() && !rewardsGiven[r[1]]) {
          rewardsGiven[r[1]] = 1;
          if (r[2].indexOf('Vínculo') >= 0) giveBond();
          if (r[2].indexOf('item') >= 0) setTimeout(giveItem, 700);
        }
        return sayF.apply(this, arguments);
      };
    });

    // Derrotar um shiny normalmente dá o Pokémon shiny de presente.
    // Na torre isso fica desligado para os chefes (e o Arceus); shinies selvagens comuns seguem iguais.
    hookModule(ns, 'onShinyCaught', function (fn) {
      if (typeof fn !== 'function' || fn.__tower) return;
      var w = function (e) {
        if (isTower() && e && (e.boss || e.towerBoss || e.towerArceus)) return;
        return fn.apply(this, arguments);
      };
      w.__tower = true;
      ns.onShinyCaught = w;
    });

    hookModule(ns, 'Tiles', function (T) { installHell(T); });
    hookModule(ns, 'World', function (W) {
      var dg = W.drawGround;
      W.drawGround = function (ctx, cam) {
        var r = dg.apply(this, arguments);
        try { castleGround(ctx, cam); } catch (e) { console.error('[torre castelo]', e); }
        return r;
      };
    });

    hookModule(ns, 'Rift', function (R) {
      var u = R.update;
      R.update = function () { if (isTower()) return; return u.apply(this, arguments); };
    });
    hookModule(ns, 'Judgment', function (J) {
      var u = J.update;
      J.update = function () { if (isTower()) return; return u.apply(this, arguments); };
    });

    requestAnimationFrame(hudLoop);
    window.__tower = { state: function () { return st; }, map: MAP };
  }

  var ns0;
  Object.defineProperty(window, '__PS', {
    configurable: true,
    get: function () { return ns0; },
    set: function (v) { ns0 = v; install(v); }
  });
})();
