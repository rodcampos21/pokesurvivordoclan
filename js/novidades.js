/* Novidades ("What's new") do fork — entradas acrescentadas no topo da lista
 * oficial (CHANGELOG do app.min.js), sem mexer no bundle.
 * Mesmo formato do jogo: d (AAAA-MM-DD), title [es, en] e as seções
 * top / new / chg / fix, cada item [es, en]. Itens que começam com "§" viram
 * subtítulo; com "· " viram subitem. Francês e português caem no inglês.
 * Precisa ser carregado DEPOIS do torre.js (encadeia o setter de window.__PS).
 */
(function () {
  'use strict';

  var ENTRIES = [
    {
      d: '2026-10-21',
      title: ['Maestría y Boss Rush', 'Mastery & Boss Rush'],
      top: [
        ['Nuevo sistema de Maestría: cada Pokémon gana insignias según el daño total que inflige.',
         'New Mastery system: every Pokémon earns badges based on the total damage it deals.'],
        ['Nuevo modo Boss Rush: 4 jefes legendarios en arenas cerradas, con preparación propia.',
         'New Boss Rush mode: 4 legendary bosses in closed arenas, with their own prep phase.']
      ],
      'new': [
        ['§Maestría', '§Mastery'],
        ['10 rangos por Pokémon: Rookie (5M de daño) → Challenger → Veteran → Gym Leader → Frontier Brain → Elite Four → Champion → Pokémon Master → Legendary → Monarch (100M).',
         '10 ranks per Pokémon: Rookie (5M damage) → Challenger → Veteran → Gym Leader → Frontier Brain → Elite Four → Champion → Pokémon Master → Legendary → Monarch (100M).'],
        ['Al llegar a un hito la maestría evoluciona; equípala en Mejoras y su insignia aparece sobre tu Pokémon (tus aliados también la ven).',
         'Reaching a milestone evolves your mastery; equip it in Upgrades and its badge floats over your Pokémon (teammates see it too).'],
        ['La barra de progreso en Mejoras muestra cuánto falta para el siguiente rango. El daño en Boss Rush no cuenta.',
         'A progress bar in Upgrades shows how far you are from the next rank. Boss Rush damage does not count.'],
        ['§Boss Rush', '§Boss Rush'],
        ['Primal Groudon, Primal Kyogre, Mega Rayquaza y Deoxys (Ataque), desbloqueados en orden, cada uno con su arena y clima.',
         'Primal Groudon, Primal Kyogre, Mega Rayquaza and Deoxys (Attack), unlocked in order, each with its own arena and weather.'],
        ['Antes de luchar: reparte 50 puntos de atributos, elige 4 movimientos (al máximo y evolucionados) y 1 objeto.',
         'Before the fight: spend 50 stat points, pick 4 moves (maxed and evolved) and 1 item.'],
        ['Equilibrado para 1 a 4 jugadores; en grupo la lucha empieza cuando todos están listos.',
         'Balanced for 1 to 4 players; in co-op the fight starts once everyone is ready.'],
        ['Ranking propio para cada jefe (solo y en grupo): gana quien lo derrote más rápido.',
         'Its own leaderboard for each boss (solo and group): the fastest kill wins.'],
        ['§Otros', '§Other'],
        ['La Megaevolución ahora supera los límites de atributos mientras dura.',
         'Mega Evolution now goes past the stat caps while it lasts.']
      ]
    },
    {
      d: '2026-10-20',
      title: ['Megaevolución, Torre Sin Fin y saltar el gacha', 'Mega Evolution, Endless Tower & Gacha Skip'],
      top: [
        ['Megaevolución: Charizard y Gengar pueden megaevolucionar en plena partida (tecla F o botón Mega).',
         'Mega Evolution: Charizard and Gengar can now Mega Evolve mid-run (F key or the Mega button).'],
        ['Nuevo modo Torre Sin Fin: 100 pisos, un legendario shiny cada 5 y Arceus shiny en la cima.',
         'New Endless Tower mode: 100 floors, a shiny Legendary every 5 and Shiny Arceus at the top.'],
        ['Botón «Saltar» en el gacha para ver el resultado al instante.',
         'New "Skip" button on the gacha to see your results instantly.']
      ],
      'new': [
        ['§Megaevolución', '§Mega Evolution'],
        ['Mega Charizard X y Mega Gengar: +50 % de poder durante 30 s, con aspecto y aura nuevos; recarga de 50 s.',
         'Mega Charizard X and Mega Gengar: +50% power for 30 s, with a new look and aura; 50 s cooldown.'],
        ['En grupo, tus aliados ven tu forma Mega y tu aura en tiempo real.',
         'In co-op, your teammates see your Mega form and aura in real time.'],
        ['Nueva pestaña «MegaEvo» en la Pokédex (después de Paldea): silueta hasta que tengas el Pokémon base.',
         'New "MegaEvo" tab in the Pokédex (after Paldea): silhouette until you own the base Pokémon.'],
        ['§Torre Sin Fin', '§Endless Tower'],
        ['Jefes legendarios shiny sin repetir, con aura de llamas azules, +10 % de daño y una IA que te persigue mucho más. Arceus espera en el piso 100.',
         'Shiny Legendary bosses that never repeat, with a blue flame aura, +10% damage and an AI that hunts you down. Arceus waits on floor 100.'],
        ['Más difícil: +25 % de enemigos y vida/daño desde ×1,5, subiendo con la altura. Equilibrada para 1 a 4 jugadores.',
         'Harder: +25% enemies and HP/damage from ×1.5, rising as you climb. Balanced for 1 to 4 players.'],
        ['Recompensas: 1 vínculo cada 3 pisos y un objeto para cada jugador tras vencer a un jefe.',
         'Rewards: 1 Bond every 3 floors and an item for every player after each boss.'],
        ['La Ira de Dios: cada 5 pisos, Arceus impone una bendición o maldición al azar durante 60 s.',
         'The Wrath of God: every 5 floors, Arceus casts a random blessing or curse for 60 s.'],
        ['Tres interiores de castillo oscuro que se turnan tras cada jefe, y música propia: «Ascensión al Trono».',
         'Three dark castle interiors that rotate after each boss, and its own theme: "Ascension to the Throne".'],
        ['Ranking propio (solo y en grupo) por piso alcanzado; el piso aparece también en la pantalla final.',
         'Its own leaderboard (solo and group) by floor reached; the floor also shows on the end screen.'],
        ['§Otros', '§Other'],
        ['Pokémon destacados: 5 Pokémon con +15 % en todos los atributos, cambian cada 5 días (se ven al entrar y en el menú).',
         'Featured Pokémon: 5 Pokémon get +15% to all stats, rotating every 5 days (shown at login and in the menu).']
      ]
    }
  ];

  function hookChangelog(ns) {
    if (!ns) return;
    var val;
    Object.defineProperty(ns, 'CHANGELOG', {
      configurable: true, enumerable: true,
      get: function () { return val; },
      set: function (v) {
        if (Array.isArray(v)) {
          var have = {};
          v.forEach(function (e) { if (e && e.d) have[e.d + '|' + JSON.stringify(e.title)] = 1; });
          v = ENTRIES.filter(function (e) { return !have[e.d + '|' + JSON.stringify(e.title)]; }).concat(v);
        }
        val = v;
      }
    });
  }

  // encadeia com o setter de window.__PS que o torre.js já instalou
  var d = Object.getOwnPropertyDescriptor(window, '__PS');
  var prevGet = d && d.get, prevSet = d && d.set, own = d && 'value' in d ? d.value : undefined;
  if (own && own.CHANGELOG) {            // bundle já carregou (não deveria acontecer)
    var cur = own.CHANGELOG; hookChangelog(own); own.CHANGELOG = cur;
    return;
  }
  Object.defineProperty(window, '__PS', {
    configurable: true,
    get: function () { return prevGet ? prevGet() : own; },
    set: function (v) {
      try { hookChangelog(v); } catch (e) { console.error('[novidades]', e); }
      if (prevSet) prevSet(v); else own = v;
    }
  });
})();
