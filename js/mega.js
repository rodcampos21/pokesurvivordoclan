/* =====================================================================
 * MEGA EVOLUÇÃO — Charizard → Mega Charizard X
 * ---------------------------------------------------------------------
 *  · Botão com o símbolo da Mega (ou tecla F) quando o seu Pokémon é Charizard.
 *  · Transformação: aura de cristais azuis e troca de sprite para o Mega.
 *  · Dura 30 s com +50% em todos os atributos; depois volta ao normal.
 *  · Recarga: 50 s, contados a partir do fim da transformação.
 * ===================================================================== */
(function () {
  'use strict';

  var BASE_DEX = 6;               // Charizard
  var SKIN = '6_megax';           // pasta assets/pokemon/6_megax/
  var DURATION = 30;              // segundos de Mega
  var COOLDOWN = 50;              // segundos de recarga (após a Mega acabar)
  var BONUS = 0.50;               // +50% em todos os atributos
  var KEY = 'KeyF';

  // Quadros dos sprites do Mega Charizard X (8 direções em cada folha)
  var META = {
    s: 2,
    a: {
      Idle:   { w: 48, h: 56, n: 4,  r: 8, d: [15, 15, 15, 15], ax: 23.5, ay: 31.5 },
      Walk:   { w: 48, h: 56, n: 4,  r: 8, d: [8, 10, 8, 10], ax: 23.5, ay: 31.5 },
      Attack: { w: 88, h: 96, n: 14, r: 8, d: [2, 2, 2, 2, 4, 1, 1, 2, 2, 2, 2, 2, 2, 2], ax: 43.5, ay: 50.5 },
      Shoot:  { w: 56, h: 64, n: 11, r: 8, d: [4, 6, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 27.5, ay: 34.5 },
      Charge: { w: 48, h: 56, n: 10, r: 8, d: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2], ax: 23.5, ay: 31.5 },
      Hurt:   { w: 64, h: 64, n: 2,  r: 8, d: [2, 8], ax: 31.5, ay: 33.5 },
      Faint:  { w: 40, h: 40, n: 2,  r: 8, d: [12, 14], ax: 19.5, ay: 25.5 }
    }
  };

  // Aura: 21 quadros de 192 px — 0-8 brilhos, 9-18 chamas de cristal, 19-20 anel
  var AURA_FPS = 14, AURA_N = 21, SWAP_AT = 9, CELL = 192, FEET_Y = 164;

  var PS = null;
  var aura = new Image(); aura.src = 'assets/ui/mega-aura.webp';

  var st = { active: false, t: 0, cd: 0, fx: null, p: null };

  function player() { return PS && PS.Game && PS.Game.player; }
  function playing() { var s = PS && PS.Game && PS.Game.state; return s === 'playing' || s === 'held'; }
  function canMega(p) { return p && !p.remote && !p.dead && p.dex === BASE_DEX && !(p.evoT > 0); }

  // ------------------------------------------------------------ troca de sprite
  function setSkin(p, mega) {
    var dir = p.anim ? p.anim.dir : 0;
    if (mega) { p._megaMon = p.mon; p.mon = Object.assign({}, p.mon, { skin: SKIN }); }
    else if (p._megaMon) { p.mon = p._megaMon; p._megaMon = null; }
    var skin = p.mon.skin || p.dex;
    p.anim = new PS.Sprites.Animator(skin, 1, p.shiny);
    p.anim.dir = dir;
    p.r = PS.Sprites.playerRadius(skin);
    p.bodyH = PS.Sprites.bodyHeight(skin);
  }

  // ------------------------------------------------------------ atributos (+50%)
  function buff(p) {
    var k = 1 + BONUS, P = PS.Player;
    var hp0 = p.maxHp;
    p.maxHp = Math.min(P.HP_CAP, Math.round(p.maxHp * k));
    p._mgHp = p.maxHp - hp0;
    p.hp = Math.min(p.maxHp, p.hp + p._mgHp);
    p.atkMul *= k; p.atkPerm *= k;
    p.spdMul *= k; p.spdPerm *= k;
    p.cdMul /= k; p.cdPerm /= k;
    var d0 = p.dmgReduce || 0;
    p.dmgReduce = Math.min(P.DEF_CAP, 1 - (1 - d0) / k);
    p._mgDef = p.dmgReduce - d0;
    p._mgRgn = (p.regenFlat || 0) * BONUS + 0.5;
    p.regenFlat = (p.regenFlat || 0) + p._mgRgn;
    p.magnet *= k; p.magPerm *= k;
    p.xpMul *= k; p.xpPerm *= k;
    p._mgCrit = (p.critChance || 0) * BONUS + 0.05;
    p.critChance = (p.critChance || 0) + p._mgCrit; p.critPerm = (p.critPerm || 0) + p._mgCrit;
    p.megaK = k;
  }
  function unbuff(p) {
    var k = p.megaK || 1;
    if (k === 1) return;
    p.maxHp = Math.max(1, p.maxHp - (p._mgHp || 0));
    p.hp = Math.min(p.hp, p.maxHp);
    p.atkMul /= k; p.atkPerm /= k;
    p.spdMul /= k; p.spdPerm /= k;
    p.cdMul *= k; p.cdPerm *= k;
    p.dmgReduce = Math.max(0, (p.dmgReduce || 0) - (p._mgDef || 0));
    p.regenFlat = Math.max(0, (p.regenFlat || 0) - (p._mgRgn || 0));
    p.magnet /= k; p.magPerm /= k;
    p.xpMul /= k; p.xpPerm /= k;
    p.critChance = Math.max(0, (p.critChance || 0) - (p._mgCrit || 0));
    p.critPerm = Math.max(0, (p.critPerm || 0) - (p._mgCrit || 0));
    p.megaK = 1; p._mgHp = p._mgDef = p._mgRgn = p._mgCrit = 0;
  }

  // ------------------------------------------------------------ ativar / terminar
  function activate() {
    var p = player();
    if (!playing() || !canMega(p) || st.active || st.cd > 0 || st.fx) return;
    st.p = p;
    st.fx = { t: 0, swapped: false, kind: 'in' };
    p.invuln = Math.max(p.invuln || 0, 1.6);       // protegido durante a transformação
    try {
      PS.Audio.sfx('legend');
      PS.Camera.kick(0.8);
      PS.Spawner.say('Charizard está Mega Evoluindo!', 2.4, true);
    } catch (e) {}
  }

  function becomeMega(p) {
    setSkin(p, true);
    buff(p);
    st.active = true; st.t = DURATION;
    try {
      PS.FX.ring(p.x, p.y, 10, 140, '#5fd4ff', 0.8, 6);
      PS.FX.burst(p.x, p.y - 30, '#9ae6ff', 30, 220);
      PS.FX.dmgText(p.x, p.y - p.bodyH - 14, 'MEGA! +50%', '#5fd4ff', true);
      PS.Spawner.say('Mega Charizard X! +50% nos atributos por 30 s', 3.2, true);
      PS.Audio.sfx('shinyGet');
    } catch (e) {}
  }

  function endMega(p, silent) {
    p = p || st.p;
    if (p && st.active) {
      unbuff(p);
      setSkin(p, false);
      if (!silent) {
        st.fx = { t: 1.36, swapped: true, kind: 'out' };   // só o anel final
        try {
          PS.FX.burst(p.x, p.y - 20, '#9ae6ff', 18, 160);
          PS.Spawner.say('A Mega Evolução acabou', 2.2, true);
        } catch (e) {}
      }
    }
    st.active = false; st.t = 0; st.cd = silent ? 0 : COOLDOWN;
    if (silent) st.fx = null;
  }

  function resetAll() { st = { active: false, t: 0, cd: 0, fx: null, p: null }; }

  // ------------------------------------------------------------ relógio (só corre em jogo)
  function tick(dt) {
    var p = player();
    if (!p) return;
    if (st.p && st.p !== p) resetAll();
    if (st.fx) {
      st.fx.t += dt;
      var f = Math.floor(st.fx.t * AURA_FPS);
      if (st.fx.kind === 'in' && !st.fx.swapped && f >= SWAP_AT) { st.fx.swapped = true; becomeMega(p); }
      if (f >= AURA_N) st.fx = null;
    }
    if (st.active) {
      st.t -= dt;
      if (p.dead) endMega(p, false);
      else if (st.t <= 0) endMega(p, false);
    } else if (st.cd > 0) st.cd = Math.max(0, st.cd - dt);
  }

  // ------------------------------------------------------------ desenho da aura (no mundo)
  function auraDrawable() {
    var p = st.p;
    if (!st.fx || !p || !aura.complete || !aura.naturalWidth) return null;
    return {
      y: p.y + 3,                                  // desenhado logo à frente do Charizard
      draw: function (ctx) {
        var f = Math.min(AURA_N - 1, Math.floor(st.fx.t * AURA_FPS));
        var size = Math.max(150, (p.bodyH || 60) * 2.6);
        var sc = size / CELL;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.95;
        ctx.drawImage(aura, f * CELL, 0, CELL, CELL, p.x - size / 2, p.y - FEET_Y * sc, size, size);
        ctx.restore();
      }
    };
  }

  // ------------------------------------------------------------ botão (HUD)
  var btn = null;
  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#mega-btn{position:fixed;z-index:25;left:calc(50% - 356px);bottom:22px;width:68px;height:68px;' +
      'border-radius:50%;border:3px solid #5fd4ff;background:radial-gradient(circle at 50% 40%,#1d3b7a,#0b1430);' +
      'box-shadow:0 0 0 2px #0b1430,0 0 16px rgba(95,212,255,.6);cursor:pointer;padding:0;display:none;touch-action:manipulation}' +
      '#mega-btn img{width:74%;height:74%;object-fit:contain;margin-top:3px;pointer-events:none;filter:drop-shadow(0 0 4px rgba(255,255,255,.5))}' +
      '#mega-btn .mk{position:absolute;right:-4px;bottom:-4px;background:#ffd23f;color:#3a2a00;font:800 11px/1 sans-serif;' +
      'border-radius:6px;padding:3px 5px;border:2px solid #0b1430}' +
      '#mega-btn .cd{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
      'font:800 20px/1 sans-serif;color:#fff;text-shadow:0 2px 0 #000;pointer-events:none}' +
      '#mega-btn.wait{filter:grayscale(1) brightness(.6);border-color:#555;box-shadow:none}' +
      '#mega-btn.on{border-color:#fff;animation:megaPulse .8s ease-in-out infinite alternate}' +
      '#mega-btn.ready{animation:megaReady 1.4s ease-in-out infinite}' +
      '@keyframes megaPulse{from{box-shadow:0 0 10px #5fd4ff}to{box-shadow:0 0 26px #9ae6ff,0 0 6px #fff inset}}' +
      '@keyframes megaReady{0%,100%{box-shadow:0 0 0 2px #0b1430,0 0 10px rgba(95,212,255,.5)}50%{box-shadow:0 0 0 2px #0b1430,0 0 22px rgba(95,212,255,.95)}}' +
      '@media (max-width:820px){#mega-btn{left:50%;bottom:118px;transform:translateX(-50%)}}' +
      '@media (max-height:520px){#mega-btn{width:54px;height:54px;bottom:auto;top:50%;left:auto;right:12px;transform:none}}';
    document.head.appendChild(s);
  }
  function ensureBtn() {
    if (btn) return btn;
    btn = document.createElement('button');
    btn.id = 'mega-btn';
    btn.type = 'button';
    btn.setAttribute('translate', 'no');
    btn.title = 'Mega Evolução (F)';
    btn.innerHTML = '<img src="assets/ui/mega-icon.png" alt="Mega"><span class="cd"></span><span class="mk">F</span>';
    btn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); activate(); });
    document.body.appendChild(btn);
    return btn;
  }
  function uiLoop() {
    requestAnimationFrame(uiLoop);
    if (!PS || !PS.Game) return;
    var p = player(), stt = PS.Game.state;
    var show = p && stt && stt !== 'ui' && stt !== 'over' && (canMega(p) || st.active) &&
      !document.querySelector('.scr:not(.hidden):not(#scr-pause)');
    var b = ensureBtn();
    b.style.display = show ? 'block' : 'none';
    if (!show) return;
    var cd = b.querySelector('.cd'), txt = '';
    b.classList.toggle('on', st.active);
    b.classList.toggle('wait', !st.active && st.cd > 0);
    b.classList.toggle('ready', !st.active && st.cd <= 0 && !st.fx);
    if (st.active) txt = Math.ceil(st.t);
    else if (st.cd > 0) txt = Math.ceil(st.cd);
    if (cd.textContent !== String(txt)) cd.textContent = txt;
  }

  // ------------------------------------------------------------ instalação
  function install() {
    PS.SPRITE_META[SKIN] = META;
    css();

    // relógio: Stats.dpsTick roda uma vez por quadro, só com o jogo rodando
    var dps = PS.Stats.dpsTick;
    PS.Stats.dpsTick = function (dt) {
      try { tick(dt); } catch (e) { console.error('[mega]', e); }
      return dps.apply(this, arguments);
    };
    // nova partida: tudo zerado
    var reset = PS.Stats.reset;
    PS.Stats.reset = function () { resetAll(); return reset.apply(this, arguments); };
    // salvar a partida no meio da Mega: volta ao normal antes (não grava o +50%)
    var save = PS.Game.saveRun;
    if (typeof save === 'function') {
      PS.Game.saveRun = function () {
        var p = player();
        if (p && st.active) endMega(p, true);
        return save.apply(this, arguments);
      };
    }
    // aura desenhada junto com os objetos do mundo
    var drw = PS.Training.drawables;
    PS.Training.drawables = function () {
      var list = drw.apply(this, arguments) || [];
      var d = auraDrawable();
      return d ? list.concat([d]) : list;
    };
    // tecla F
    window.addEventListener('keydown', function (e) {
      if (e.code !== KEY || e.repeat) return;
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      activate();
    });

    PS.Sprites.preload([SKIN], 8000, false);
    requestAnimationFrame(uiLoop);
    window.__mega = { state: function () { return st; }, activate: activate };
  }

  var wait = setInterval(function () {
    var ns = window.__PS;
    if (ns && ns.SPRITE_META && ns.Sprites && ns.Stats && ns.Game && ns.Training && ns.Player) {
      clearInterval(wait);
      PS = ns;
      install();
    }
  }, 50);
})();
