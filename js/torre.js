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
  function kFor(f) { return r2(1.25 + 0.45 * (f / FLOORS)); }   // vida   1.25 → 1.70
  function dkFor(f) { return r2(1.10 + 0.25 * (f / FLOORS)); }  // dano   1.10 → 1.35

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
  // Cenário: troca a cada chefe derrotado, em loop sem repetir
  // (andares 1-5 no 1º mapa, 6-10 no 2º, … e depois de todos volta ao 1º).
  function mapLoop() {
    var list = [0, 1, 2];                       // Bosque Umbrío, Cueva Cristal, Volcán Ceniza
    try { list = list.concat(PS.Tiles.ZZ); } catch (e) {}   // + Zona Cero (3 cenários)
    return list;
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
    var q = Math.round(Math.max(10, Math.min(140, rate * SEC_PER_FLOOR * 0.9)) * teamRate(n));
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
        return update.call(this, dt, players, vtime());
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
