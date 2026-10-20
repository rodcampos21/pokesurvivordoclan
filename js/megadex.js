/* =====================================================================
 * Aba "MegaEvo" na tela Pokémon (Pokédex), depois de Paldea.
 * ---------------------------------------------------------------------
 * Mostra as Mega Evoluções com sprite, tipos, raridade e atributos
 * (os do Pokémon base +50%), sem número de Pokédex.
 * Só aparece "de verdade" para quem tem o Pokémon base; senão fica como
 * sombra ("???"), igual aos Pokémon que você ainda não obteve.
 * A aba é montada por fora, reaproveitando o HTML/CSS e os ajudantes
 * visuais do próprio jogo.
 * ===================================================================== */
(function () {
  'use strict';

  var MEGAS = [
    {
      id: 'megax6', base: 6, skin: '6_megax', name: 'Mega Charizard X',
      types: ['fire', 'dragon'], bonus: 0.5,
      info: 'Durante a partida com Charizard, use o botão da Mega (tecla F): ' +
        '30 s com +50% em todos os atributos · recarga de 50 s.'
    },
    {
      id: 'mega94', base: 94, skin: '94_mega', name: 'Mega Gengar',
      types: ['ghost', 'poison'], bonus: 0.5,
      info: 'Durante a partida com Gengar, use o botão da Mega (tecla F): ' +
        '30 s com +50% em todos os atributos · recarga de 50 s.'
    }
  ];

  var PS = null, megaMode = false, sel = 0;
  var MAX_HP = 183, MAX_ATK = 1.55, MAX_SPD = 137;   // mesmas escalas das barras do jogo

  function $(id) { return document.getElementById(id); }
  function owned(m) { var s = PS.DB.save; return !!(s && s.owned && s.owned[m.base]); }
  function baseMon(m) { return PS.DEX_BY[m.base]; }
  function stats(m) {
    var b = baseMon(m), k = 1 + m.bonus;
    return { hp: Math.round(b.hp * k), atk: +(b.atk * k).toFixed(2), spd: Math.round(b.spd * k), rarity: b.rarity };
  }
  function filterOn() {
    var on = document.querySelector('#dex-filters .chip.on');
    var all = document.querySelectorAll('#dex-filters .chip');
    var i = Array.prototype.indexOf.call(all, on);
    return ['all', 'own', 'miss', 'shiny', '5', '4', '3', '2', '1'][i] || 'all';
  }

  // ------------------------------------------------------------ aba
  function addTab() {
    var gens = $('dex-gens');
    if (!gens || gens.querySelector('.mega-tab')) return;
    var have = MEGAS.filter(owned).length;
    var b = document.createElement('button');
    b.className = 'gen-tab mega-tab' + (megaMode ? ' on' : '');
    b.setAttribute('translate', 'no');
    b.innerHTML = '<b>MegaEvo</b><small>' + have + '/' + MEGAS.length + '</small>';
    b.onclick = function () {
      megaMode = true;
      try { PS.Audio.sfx('click'); } catch (e) {}
      render();
    };
    gens.appendChild(b);
  }

  // ------------------------------------------------------------ grade
  function render() {
    var gens = $('dex-gens');
    if (gens) gens.querySelectorAll('.gen-tab').forEach(function (t) { t.classList.toggle('on', t.classList.contains('mega-tab')); });
    var cnt = gens && gens.querySelector('.mega-tab small');
    if (cnt) cnt.textContent = MEGAS.filter(owned).length + '/' + MEGAS.length;
    var grid = $('dex-grid');
    if (!grid) return;
    grid.innerHTML = '';
    var f = filterOn(), shown = [];
    MEGAS.forEach(function (m, i) {
      var have = owned(m), st = stats(m);
      if (f === 'own' && !have) return;
      if (f === 'miss' && have) return;
      if (f === 'shiny') return;
      if (/^\d$/.test(f) && st.rarity !== +f) return;
      shown.push(i);
      var cell = document.createElement('div');
      cell.className = 'cell' + (have ? '' : ' locked') + (i === sel ? ' on' : '');
      cell.setAttribute('translate', 'no');
      // sem número de Pokédex
      try {
        cell.appendChild(PS.UI.spriteCanvas(m.skin, 92, 80, { scale: 2, silhouette: !have, shadow: have }));
      } catch (e) {}
      cell.insertAdjacentHTML('beforeend', '<b>' + (have ? m.name : '???') + '</b>' + PS.UI.stars(st.rarity, 9));
      cell.onclick = function () {
        sel = i;
        grid.querySelectorAll('.cell').forEach(function (c) { c.classList.remove('on'); });
        cell.classList.add('on');
        detail(m);
      };
      grid.appendChild(cell);
    });
    if (!shown.length) {
      grid.innerHTML = '<p class="sub" style="grid-column:1/-1">Ninguno con este filtro.</p>';
    }
    detail(MEGAS[shown.indexOf(sel) >= 0 ? sel : (shown[0] || 0)]);
  }

  // ------------------------------------------------------------ painel de detalhes
  function bar(label, v, max, txt) {
    return '<div class="stat"><span>' + label + '</span><div class="bar"><i style="width:' +
      Math.min(100, v / max * 100) + '%"></i></div><span>' + txt + '</span></div>';
  }
  function detail(m) {
    var box = $('dex-detail');
    if (!box || !m) return;
    var have = owned(m), st = stats(m), b = baseMon(m);
    var html =
      '<canvas id="dex-big" class="stage" width="220" height="190"></canvas>' +
      '<div class="center">' +
      '<div style="color:var(--muted);font-size:13px" translate="no">' + (have ? 'Mega Evolução · ' + b.name : 'Mega Evolução') + '</div>' +
      '<h3 translate="no">' + (have ? m.name : '???') + '</h3>' +
      '<div style="color:' + PS.Gacha.RARITY_COLOR[st.rarity] + '">' + PS.UI.stars(st.rarity, 24) + ' ' +
      PS.Gacha.RARITY_NAME[st.rarity] + '</div>' +
      '<div style="margin:6px 0">' + (have ? PS.UI.typeChips(m.types) : '') + '</div>' +
      '</div>';
    if (have) {
      html +=
        bar('Vida', st.hp, MAX_HP, st.hp + '') +
        bar('Ataque', st.atk, MAX_ATK, '×' + st.atk.toFixed(2) + '') +
        bar('Velocidad', st.spd, MAX_SPD, st.spd + '') +
        '<p translate="no" style="font-size:13px;color:var(--muted);margin:6px 0 2px">Os atributos de ' + b.name +
        ' com +50% (vida, ataque, velocidade, recarga, defesa, regeneração, crítico, ímã e experiência).</p>' +
        '<p translate="no" style="font-size:14px;margin:8px 0 4px">' + m.info + '</p>';
    } else {
      html += '<p class="center" style="color:var(--muted)">Aún no lo tienes.</p>' +
        '<p class="center" translate="no" style="color:var(--muted);margin-top:-4px">Obtenha o Pokémon base para desbloquear esta Mega Evolução.</p>';
    }
    box.innerHTML = html;
    var cv = box.querySelector('#dex-big');
    cv.style.setProperty('--stage-c', have ? (m.base === 94 ? '#b46bff' : '#5fd4ff') : '#5b83d6');
    try {
      PS.UI.sprite(cv, m.skin, { lively: have, spin: have, silhouette: !have, scale: 3, hero: true });
    } catch (e) {}
  }

  // ------------------------------------------------------------ ligação com a tela
  function install() {
    var gens = $('dex-gens'), scr = $('scr-dex'), filters = $('dex-filters');
    if (!gens || !scr) return;

    // o jogo redesenha a tela inteira (abas, filtros, grade): recoloca a aba e,
    // se a MegaEvo estava aberta, redesenha a grade dela por cima
    new MutationObserver(function () {
      if (!gens.querySelector('.mega-tab')) {
        addTab();
        if (megaMode) render();
      }
    }).observe(gens, { childList: true });

    // clicar em outra região sai da MegaEvo
    gens.addEventListener('click', function (e) {
      var t = e.target.closest('.gen-tab');
      if (t && !t.classList.contains('mega-tab')) megaMode = false;
    }, true);

    // ao fechar a tela Pokémon, volta ao normal na próxima abertura
    new MutationObserver(function () {
      if (scr.classList.contains('hidden')) megaMode = false;
    }).observe(scr, { attributes: true, attributeFilter: ['class'] });

    addTab();
    window.__megadex = { render: render, list: MEGAS };
  }

  var wait = setInterval(function () {
    var ns = window.__PS;
    if (ns && ns.UI && ns.UI.spriteCanvas && ns.DB && ns.DEX_BY && ns.Gacha && ns.SPRITE_META &&
        ns.SPRITE_META['6_megax'] && ns.SPRITE_META['94_mega'] && document.getElementById('dex-gens')) {
      clearInterval(wait);
      PS = ns;
      install();
    }
  }, 100);
})();
