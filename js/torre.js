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

    if (f % BOSS_EVERY === 0 && f < FLOORS) {
      var runId = st;                       // mesmo objeto de estado = mesma partida
      setTimeout(function () { if (isTower() && st === runId && inRun()) wrathAnnounce(f); }, 2600);
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

  // Chefes dos andares 5…95: SÓ estes lendários/míticos, sorteados sem repetir na partida.
  // (Nº da Pokédex; os que o jogo não tem — Zarude, Wo-Chien, Chien-Pao, Ting-Lu,
  //  Miraidon, Okidogi, Pecharunt — ficam de fora. A força vem do andar, não do Pokémon.)
  var BOSS_POOL = [
    144, 145, 146, 150, 151,                                   // Articuno … Mew
    243, 244, 245, 249, 250, 251,                              // Raikou … Celebi
    377, 378, 379, 380, 381, 382, 383, 384, 385, 386,          // Regirock … Deoxys
    480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492,   // Uxie … Shaymin
    494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,   // Victini … Genesect
    716, 717, 718, 719, 720, 721,                              // Xerneas … Volcanion
    785, 786, 787, 788, 789, 790, 791, 792, 800, 801, 802, 807, 808, 809,  // Tapus … Melmetal
    888, 889, 890, 891, 892, 894, 895, 896, 897, 898, 905,     // Zacian … Enamorus
    1004, 1007, 1015, 1016, 1017, 1024                         // Chi-Yu, Koraidon, Munkidori, Fezandipiti, Ogerpon, Terapagos
  ];
  function pickBossMon(idx) {
    function ok(dex) { return PS.DEX_BY[dex] && PS.SPRITE_META && PS.SPRITE_META[dex] && !st.used[dex]; }
    var pool = BOSS_POOL.filter(ok);
    if (!pool.length) { st.used = {}; pool = BOSS_POOL.filter(ok); }      // (só se a lista acabasse)
    var dex = pool[Math.floor(Math.random() * pool.length)];
    st.used[dex] = 1;
    return PS.DEX_BY[dex];
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

  // ---------------------------------------------------------------- A IRA DE DEUS
  // A cada 5 andares (5, 10, … 95) Arceus lança uma bênção ou um castigo
  // aleatório sobre os jogadores, por 60 s. O anfitrião sorteia e anuncia;
  // cada jogador aplica no próprio Pokémon ao ver o anúncio.
  var WRATH_TIME = 60;
  var WRATH = [
    // --- bênçãos
    { id: 'vel', buff: true, name: 'Asas do Céu', desc: '+35% de velocidade',
      on: function (p, d) { d.k = 1.35; p.spdMul *= d.k; p.spdPerm *= d.k; },
      off: function (p, d) { p.spdMul /= d.k; p.spdPerm /= d.k; } },
    { id: 'atk', buff: true, name: 'Fúria Divina', desc: '+30% de ataque',
      on: function (p, d) { d.k = 1.30; p.atkMul *= d.k; p.atkPerm *= d.k; },
      off: function (p, d) { p.atkMul /= d.k; p.atkPerm /= d.k; } },
    { id: 'def', buff: true, name: 'Escudo Celestial', desc: '−25% de dano recebido',
      on: function (p, d) { var a = p.dmgReduce || 0; p.dmgReduce = Math.min(PS.Player.DEF_CAP, a + 0.25); d.v = p.dmgReduce - a; },
      off: function (p, d) { p.dmgReduce = (p.dmgReduce || 0) - d.v; } },
    { id: 'rgn', buff: true, name: 'Mão Curadora', desc: 'regenera 2% da vida por segundo',
      on: function (p, d) { d.v = p.maxHp * 0.02; p.regenFlat = (p.regenFlat || 0) + d.v; },
      off: function (p, d) { p.regenFlat = Math.max(0, (p.regenFlat || 0) - d.v); } },
    { id: 'gold', buff: true, name: 'Chuva Dourada', desc: 'experiência e moedas em dobro',
      on: function (p, d) { p.xpMul *= 2; p.xpPerm *= 2; p.coinMul *= 2; },
      off: function (p, d) { p.xpMul /= 2; p.xpPerm /= 2; p.coinMul /= 2; } },
    { id: 'crit', buff: true, name: 'Olho do Criador', desc: '+25% de chance de crítico',
      on: function (p, d) { p.critChance = (p.critChance || 0) + 0.25; p.critPerm = (p.critPerm || 0) + 0.25; },
      off: function (p, d) { p.critChance = Math.max(0, p.critChance - 0.25); p.critPerm = Math.max(0, p.critPerm - 0.25); } },
    { id: 'mag', buff: true, name: 'Atração Celestial', desc: 'ímã ×3: puxa tudo de longe',
      on: function (p, d) { p.magnet *= 3; p.magPerm *= 3; },
      off: function (p, d) { p.magnet /= 3; p.magPerm /= 3; } },
    // --- castigos
    { id: 'slow', buff: false, name: 'Peso do Pecado', desc: '−30% de velocidade',
      on: function (p, d) { d.k = 0.70; p.spdMul *= d.k; p.spdPerm *= d.k; },
      off: function (p, d) { p.spdMul /= d.k; p.spdPerm /= d.k; } },
    { id: 'weak', buff: false, name: 'Braço Trêmulo', desc: '−25% de ataque',
      on: function (p, d) { d.k = 0.75; p.atkMul *= d.k; p.atkPerm *= d.k; },
      off: function (p, d) { p.atkMul /= d.k; p.atkPerm /= d.k; } },
    { id: 'glass', buff: false, name: 'Pele de Vidro', desc: '+30% de dano recebido',
      on: function (p, d) { d.v = 0.30; p.dmgReduce = (p.dmgReduce || 0) - d.v; },
      off: function (p, d) { p.dmgReduce = (p.dmgReduce || 0) + d.v; } },
    { id: 'tired', buff: false, name: 'Exaustão', desc: 'golpes recarregam 35% mais devagar',
      on: function (p, d) { d.k = 1.35; p.cdMul *= d.k; p.cdPerm *= d.k; },
      off: function (p, d) { p.cdMul /= d.k; p.cdPerm /= d.k; } },
    { id: 'starve', buff: false, name: 'Jejum Sagrado', desc: 'sem regeneração de vida',
      on: function (p, d) { d.v = p.regenFlat || 0; p.regenFlat = 0; p.noRegenWrath = 1; },
      off: function (p, d) { p.regenFlat = (p.regenFlat || 0) + d.v; p.noRegenWrath = 0; } },
    { id: 'nomag', buff: false, name: 'Mãos Vazias', desc: 'ímã −70%: vá buscar os itens',
      on: function (p, d) { p.magnet *= 0.3; p.magPerm *= 0.3; },
      off: function (p, d) { p.magnet /= 0.3; p.magPerm /= 0.3; } },
    { id: 'horde', buff: false, name: 'Legião Infernal', desc: '+50% de inimigos nascendo',
      on: function (p, d) { wrathSpawn = 1.5; },
      off: function (p, d) { wrathSpawn = 1; } }
  ];
  var WRATH_BY = {}; WRATH.forEach(function (w) { WRATH_BY[w.name] = w; });
  var wrath = null;              // { w, t, d, p }
  var wrathSpawn = 1;
  var wrathSeen = {};            // andar -> já aplicado (evita repetir)
  var lastWrathId = '';

  function wrathAnnounce(f) {
  // sorteia (anfitrião/solo) e anuncia; o anúncio aplica em todos (ver S.say)
    var pool = WRATH.filter(function (w) { return w.id !== lastWrathId; });
    var w = pool[Math.floor(Math.random() * pool.length)];
    lastWrathId = w.id;
    say('A Ira de Deus (andar ' + f + '): ' + w.name, 4);
  }
  function wrathStart(w, f) {
    var p = PS.Game.player;
    if (!p || p.remote) return;
    if (wrath) wrathEnd(true);
    var d = {};
    try { w.on(p, d); } catch (e) { console.error('[ira]', e); return; }
    wrath = { w: w, t: WRATH_TIME, d: d, p: p };
    showWrath(w);
    try { PS.Audio.sfx(w.buff ? 'legend' : 'boss'); PS.Camera.kick(w.buff ? 0.4 : 1.0); } catch (e) {}
  }
  function wrathEnd(silent) {
    if (!wrath) return;
    try { wrath.w.off(wrath.p, wrath.d); } catch (e) {}
    var w = wrath.w; wrath = null;
    if (!silent) {
      notice((w.buff ? 'A bênção acabou: ' : 'O castigo acabou: ') + w.name, w.buff ? 'buff' : 'debuff', true);
      try { PS.Spawner.say('A Ira de Deus passou: ' + w.name + ' acabou', 2.6, true); PS.Audio.sfx('back'); } catch (e) {}
    }
  }
  function wrathTick(dt) {
    if (!wrath) return;
    var p = PS.Game.player;
    if (!p || p !== wrath.p) { wrath = null; wrathSpawn = 1; return; }
    if (p.noRegenWrath && p.regenFlat > 0) { wrath.d.v += p.regenFlat; p.regenFlat = 0; }   // jejum: guarda o que ganhar e devolve no fim
    wrath.t -= dt;
    if (wrath.t <= 0) wrathEnd(false);
  }

  // ---- retrato do Arceus e avisos
  var wrathUi = null;
  function wrathCss() {
    var st3 = document.createElement('style');
    st3.textContent =
      '#wrath-pop{position:fixed;left:50%;top:18%;transform:translateX(-50%);z-index:30;pointer-events:none;display:flex;' +
      'align-items:center;gap:14px;padding:12px 18px 12px 12px;border-radius:16px;max-width:min(560px,92vw);' +
      'background:linear-gradient(135deg,rgba(28,6,6,.94),rgba(10,4,14,.94));border:2px solid #ffcf4a;' +
      'box-shadow:0 0 0 2px #2a0a0a,0 0 34px rgba(255,140,40,.45);opacity:0;transition:opacity .35s, transform .35s}' +
      '#wrath-pop.show{opacity:1;transform:translateX(-50%) scale(1)}' +
      '#wrath-pop .wp-face{flex:none;width:96px;height:96px;border-radius:50%;border:3px solid #ffcf4a;' +
      'background:radial-gradient(circle at 50% 40%,#3a1208,#120404);overflow:hidden;display:flex;align-items:center;justify-content:center;' +
      'box-shadow:0 0 18px rgba(255,190,60,.6) inset}' +
      '#wrath-pop .wp-face img{width:92%;height:92%;object-fit:contain;image-rendering:pixelated}' +
      '#wrath-pop .wp-say{font:800 20px/1.15 inherit;color:#ffe08a;text-shadow:0 2px 0 #3a0a00,0 0 12px rgba(255,120,30,.7);letter-spacing:.3px}' +
      '#wrath-pop .wp-eff{margin-top:6px;font:700 15px/1.25 inherit;color:#fff}' +
      '#wrath-pop .wp-eff b{display:inline-block;padding:2px 8px;border-radius:7px;margin-right:6px}' +
      '#wrath-pop .wp-eff.buff b{background:#1f8f4d;color:#eafff0}' +
      '#wrath-pop .wp-eff.debuff b{background:#a3161e;color:#ffecec}' +
      '#wrath-pop .wp-eff span{color:#e8d9c8}' +
      '#wrath-pop .wp-time{margin-top:4px;font-size:12px;color:#c9b8a8}' +
      '#wrath-badge{position:fixed;top:78px;left:12px;z-index:20;pointer-events:none;display:none;padding:5px 10px;border-radius:10px;' +
      'font:700 13px/1.2 inherit;color:#fff;background:rgba(12,8,16,.82);border:2px solid #ffcf4a;min-width:190px}' +
      '#wrath-badge.buff{border-color:#3fd27a}#wrath-badge.debuff{border-color:#ff4a4a}' +
      '#wrath-badge small{display:block;font-weight:600;font-size:11px;color:#cfc3b6}' +
      '#wrath-note{position:fixed;left:50%;top:38%;transform:translateX(-50%);z-index:30;pointer-events:none;opacity:0;transition:opacity .3s;' +
      'padding:8px 16px;border-radius:12px;font:700 15px/1.2 inherit;color:#fff;background:rgba(12,8,16,.9);border:2px solid #ffcf4a}' +
      '#wrath-note.show{opacity:1}#wrath-note.buff{border-color:#3fd27a}#wrath-note.debuff{border-color:#ff4a4a}' +
      '@media (max-height:520px){#wrath-pop{top:8%;padding:8px 12px 8px 8px}#wrath-pop .wp-face{width:64px;height:64px}' +
      '#wrath-pop .wp-say{font-size:16px}#wrath-badge{top:50px;left:6px;min-width:150px;font-size:11px}}';
    document.head.appendChild(st3);
  }
  function ensureWrathUi() {
    if (wrathUi) return wrathUi;
    var pop = document.createElement('div'); pop.id = 'wrath-pop'; pop.setAttribute('translate', 'no');
    pop.innerHTML = '<div class="wp-face"><img src="assets/ui/arceus-portrait.png" alt="Arceus"></div>' +
      '<div><div class="wp-say">Sinta a fúria de Deus!</div><div class="wp-eff"></div><div class="wp-time">por 1 minuto</div></div>';
    var badge = document.createElement('div'); badge.id = 'wrath-badge'; badge.setAttribute('translate', 'no');
    var note = document.createElement('div'); note.id = 'wrath-note'; note.setAttribute('translate', 'no');
    document.body.appendChild(pop); document.body.appendChild(badge); document.body.appendChild(note);
    wrathUi = { pop: pop, badge: badge, note: note, popT: 0, noteT: 0 };
    return wrathUi;
  }
  function showWrath(w) {
    var u = ensureWrathUi();
    var eff = u.pop.querySelector('.wp-eff');
    eff.className = 'wp-eff ' + (w.buff ? 'buff' : 'debuff');
    eff.innerHTML = '<b>' + (w.buff ? 'Bênção' : 'Castigo') + '</b>' + w.name + ' <span>· ' + w.desc + '</span>';
    u.pop.classList.add('show');
    clearTimeout(u.popT);
    u.popT = setTimeout(function () { u.pop.classList.remove('show'); }, 3800);   // some logo depois
  }
  function notice(text, kind, ended) {
    var u = ensureWrathUi();
    u.note.className = kind; u.note.textContent = text;
    void u.note.offsetWidth; u.note.classList.add('show');
    clearTimeout(u.noteT);
    u.noteT = setTimeout(function () { u.note.classList.remove('show'); }, 3000);
  }
  function wrathBadge(show) {
    var u = ensureWrathUi();
    if (!show || !wrath) { u.badge.style.display = 'none'; return; }
    var w = wrath.w, t = Math.max(0, Math.ceil(wrath.t));
    u.badge.style.display = 'block';
    u.badge.className = w.buff ? 'buff' : 'debuff';
    var txt = (w.buff ? '✦ ' : '✖ ') + w.name + ' · 0:' + (t < 10 ? '0' : '') + t;
    if (u.badge.dataset.t !== txt) { u.badge.dataset.t = txt; u.badge.innerHTML = txt + '<small>' + w.desc + '</small>'; }
  }

  // ---------------------------------------------------------------- RANKING
  // Tabelas ts_* (solo) e tg_* (grupo), nos mesmos períodos das outras.
  // Valor t = andar × 10000 + (9999 − segundos): mais alto ganha; no empate de
  // andar, quem subiu mais rápido. Derrotar o Arceus conta como "andar 101".
  var lastMembers = [], wasHost = false, submitted = false;
  function towerT(floor, secs) { return floor * 10000 + (9999 - Math.max(1, Math.min(9998, Math.floor(secs)))); }
  window.__towerFmt = function (t) {
    var f = Math.floor(t / 10000), s = 9999 - (t % 10000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var time = (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
    return f >= 101 ? '★ Zerou · ' + time : 'Andar ' + f + ' · ' + time;
  };
  function trackMembers() {
    try {
      if (PS.Coop && PS.Coop.active) { wasHost = !!PS.Coop.isHost; lastMembers = (PS.Coop.members || []).slice(); }
    } catch (e) {}
  }
  function submitTower() {
    if (submitted || !isTower()) return;
    submitted = true;
    try {
      var R = PS.Ranking, me = PS.DB && PS.DB.online && PS.DB.fb, p = PS.Game.player;
      if (!R || !R._put || !me || !me.uid || !PS.Social.me || !p || PS.Game.training) return;
      if (PS.DevMenu && PS.DevMenu.on) return;
      var floor = st.won ? 101 : st.floor, secs = PS.Game.gtime || 0;
      if (floor < 2 || secs < floor * 3) return;
      var group = lastMembers.length >= 2, entry, id, pre;
      if (group) {
        if (!wasHost) return;                       // no grupo, quem envia é o anfitrião
        var mem = lastMembers.slice().sort(function (a, b) { return a.uid < b.uid ? -1 : 1; });
        id = mem.map(function (m) { return m.uid; }).join('_'); pre = 'tg';
        entry = { uids: mem.map(function (m) { return m.uid; }), names: mem.map(function (m) { return m.name; }),
                  dex: mem.map(function (m) { return m.dex; }), shiny: mem.map(function (m) { return !!m.shiny; }) };
      } else {
        id = me.uid; pre = 'ts';
        entry = { uids: [me.uid], names: [PS.Social.me.name], dex: [p.baseDex || p.dex], shiny: [!!p.shiny] };
      }
      entry.t = towerT(floor, secs); entry.lv = p.level | 0 || 1; entry.kills = p.kills | 0;
      var boards = R.PERIODS.map(function (x) { return [R.board(pre, x[0], null), x[0]]; });
      R._put(boards, id, entry).then(function (got) {
        try { R._tag(got, 'Torre Sem Fim'); } catch (e) {}
      }).catch(function (e) { console.warn('[torre ranking]', e); });
    } catch (e) { console.warn('[torre ranking]', e); }
  }

  // ---------------------------------------------------------------- tela de fim
  // quadro "Andar alcançado" na tela de morte/vitória da torre
  function overFloor(floor, won) {
    var box = document.getElementById('over-stats');
    if (!box) return;
    var old = box.querySelector('.tower-floor'); if (old) old.remove();
    var d = document.createElement('div');
    d.className = 'tower-floor';
    d.setAttribute('translate', 'no');
    d.style.gridColumn = '1/-1';
    var pct = Math.round(Math.min(100, Math.max(1, floor)) / FLOORS * 100);
    d.innerHTML = won
      ? '<span>Andar alcançado</span><b class="gold">★ 100 / 100 · Arceus derrotado!</b>'
      : '<span>Andar alcançado</span><b class="gold">' + floor + ' / ' + FLOORS + '</b>' +
        '<i style="display:block;height:6px;margin:6px auto 0;max-width:260px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden">' +
        '<i style="display:block;height:100%;width:' + pct + '%;background:linear-gradient(90deg,#ffd23f,#ff7a1f)"></i></i>';
    // logo depois do bloco de quadros pequenos (Tempo, Nível, Derrotados, Chefes)
    var kids = Array.prototype.slice.call(box.children);
    function wide(el) { return /1\s*\/\s*-1/.test(el.getAttribute('style') || '') || el.style.gridColumn.indexOf('-1') >= 0; }
    var i = 0;
    while (i < kids.length && wide(kids[i])) i++;
    while (i < kids.length && !wide(kids[i])) i++;
    box.insertBefore(d, kids[i] || null);
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
    try { wrathBadge(!!show); } catch (e) {}
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
        rewardsGiven = {}; wrathSeen = {}; wrath = null; wrathSpawn = 1; lastWrathId = '';
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
        window.__spawnK = SPAWN_K * wrathSpawn;
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
        var ira = /^A Ira de Deus \(andar (\d+)\): (.+)$/.exec(text || '');
        if (ira && isTower() && !wrathSeen[ira[1]] && WRATH_BY[ira[2]]) {
          wrathSeen[ira[1]] = 1;
          wrathStart(WRATH_BY[ira[2]], +ira[1]);
        }
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
    hookModule(ns, 'Stats', function (Sx) {
      var dps = Sx.dpsTick, rs = Sx.reset;
      Sx.dpsTick = function (dt) {
        try { if (isTower()) { wrathTick(dt); trackMembers(); } } catch (e) { console.error('[ira]', e); }
        return dps.apply(this, arguments);
      };
      Sx.reset = function () {
        wrath = null; wrathSpawn = 1; wrathSeen = {}; submitted = false; lastMembers = []; wasHost = false;
        return rs.apply(this, arguments);
      };
    });
    hookModule(ns, 'RunUI', function (U) {
      var so = U.showOver;
      U.showOver = function () {
        try { submitTower(); } catch (e) {}
        var tw = isTower(), host = !(PS.Coop && PS.Coop.active) || PS.Coop.isHost;
        var floor = host ? st.floor : lastFloorSeen, won = st.won;
        var r = so.apply(this, arguments);
        if (tw) { try { overFloor(floor, won); } catch (e) { console.error('[torre fim]', e); } }
        return r;
      };
    });
    hookModule(ns, 'Game', function (G) {
      var sv = G.saveRun;
      if (typeof sv === 'function') G.saveRun = function () { wrathEnd(true); return sv.apply(this, arguments); };
    });
    wrathCss();
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
    window.__tower = { state: function () { return st; }, map: MAP,
      wrath: function () { return wrath; }, WRATH: WRATH, _announce: wrathAnnounce };
  }

  var ns0;
  Object.defineProperty(window, '__PS', {
    configurable: true,
    get: function () { return ns0; },
    set: function (v) { ns0 = v; install(v); }
  });
})();
