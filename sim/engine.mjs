/**
 * Mean Streets — Monte Carlo Simulation Engine
 *
 * Open-ended, configurable game engine that explores the design space
 * through thousands of simulated games under varying conditions.
 *
 * Usage: node sim/engine.mjs [--sweep <name>] [--games <n>] [--verbose]
 */

// ============================================================
// CARD & DECK GENERATION
// ============================================================

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Generate a deck of cards for a gang.
 * Each card has: dayAtk, dayDef, nightAtk, nightDef, name, gang
 * Stats are generated from a gang's stat curve template.
 */
function generateDeck(gang, deckSize = 20) {
  const cards = [];
  for (let i = 0; i < deckSize; i++) {
    const tier = i / (deckSize - 1); // 0.0 (weakest) to 1.0 (strongest)
    const stats = gang.statCurve(tier, i);
    cards.push({
      uid: generateId(),
      name: gang.names[i] || `${gang.id}-${i + 1}`,
      gang: gang.id,
      dayAtk: stats.dayAtk,
      dayDef: stats.dayDef,
      nightAtk: stats.nightAtk,
      nightDef: stats.nightDef,
      tier: i + 1,
    });
  }
  return cards;
}

/**
 * Gang definitions with stat curves.
 * Each gang has a function that takes a tier (0-1) and returns day/night ATK/DEF.
 */
const GANGS = {
  KNUCKLES: {
    id: 'KNUCKLES',
    passive: 'BRUTAL', // +1 damage on attacks
    passiveDesc: '+1 ATK damage',
    statCurve: (t, _i) => ({
      dayAtk: Math.round(2 + t * 7),    // 2-9, aggressive day
      dayDef: Math.round(1 + t * 4),    // 1-5, weak defense
      nightAtk: Math.round(1 + t * 5),  // 1-6, weaker at night
      nightDef: Math.round(1 + t * 5),  // 1-6, slightly better def at night
    }),
    names: [
      'Twitch', 'Skids', 'Rash', 'Smack', 'Gutter',
      'Brick', 'Hammer', 'Scar', 'Grinder', 'Torch',
      'Mauler', 'Breaker', 'Iron', 'Anvil', 'Crusher',
      'Wrecker', 'Titan', 'Goliath', 'Havoc', 'The Fist',
      'Fury', 'Carnage', 'Rampage', 'Juggernaut', 'Oblivion',
    ],
  },
  CHAINS: {
    id: 'CHAINS',
    passive: 'ANCHOR', // +2 shield on vanguard promotion
    passiveDesc: '+2 shield on promote',
    statCurve: (t, _i) => ({
      dayAtk: Math.round(1 + t * 5),    // 1-6, moderate attack
      dayDef: Math.round(2 + t * 7),    // 2-9, strong defense day
      nightAtk: Math.round(1 + t * 4),  // 1-5, weak attack night
      nightDef: Math.round(2 + t * 7),  // 2-9, strong defense night too
    }),
    names: [
      'Latch', 'Bolt', 'Rivet', 'Clamp', 'Brace',
      'Girder', 'Rebar', 'Bulwark', 'Bastion', 'Rampart',
      'Sentinel', 'Warden', 'Garrison', 'Fortress', 'Citadel',
      'Monolith', 'Bedrock', 'Ironclad', 'Aegis', 'The Wall',
      'Vault', 'Bunker', 'Anchor', 'Foundation', 'Immovable',
    ],
  },
  SHIVS: {
    id: 'SHIVS',
    passive: 'BLEED', // on kill, opponent discards 1
    passiveDesc: 'enemy discards 1 on kill',
    statCurve: (t, _i) => ({
      dayAtk: Math.round(2 + t * 7),    // 2-9, strong attack day
      dayDef: Math.round(1 + t * 3),    // 1-4, glass cannon day
      nightAtk: Math.round(1 + t * 3),  // 1-4, weak attack night
      nightDef: Math.round(2 + t * 7),  // 2-9, strong defense night
    }),
    names: [
      'Flick', 'Nip', 'Scratch', 'Prick', 'Slice',
      'Slash', 'Pierce', 'Stiletto', 'Razor', 'Fang',
      'Viper', 'Needle', 'Ghost', 'Shadow', 'Phantom',
      'Specter', 'Wraith', 'Eclipse', 'Silence', 'The Blade',
      'Whisper', 'Mirage', 'Void', 'Nightshade', 'Oblivion',
    ],
  },
  CROWS: {
    id: 'CROWS',
    passive: 'SCAVENGE', // draw 1 when you sacrifice
    passiveDesc: 'draw 1 on sacrifice',
    statCurve: (t, _i) => ({
      dayAtk: Math.round(2 + t * 5),    // 2-7, moderate
      dayDef: Math.round(2 + t * 5),    // 2-7, moderate
      nightAtk: Math.round(2 + t * 5),  // 2-7, same at night
      nightDef: Math.round(2 + t * 5),  // 2-7, same at night
    }),
    names: [
      'Peck', 'Scraps', 'Rummage', 'Salvage', 'Glean',
      'Picker', 'Scrounge', 'Hoarder', 'Magpie', 'Jackdaw',
      'Rook', 'Corvus', 'Talon', 'Carrion', 'Murder',
      'Omen', 'Prophet', 'Oracle', 'Harbinger', 'The Flock',
      'Feast', 'Remnant', 'Vestige', 'Relic', 'Eternity',
    ],
  },
};

// ============================================================
// STAT CURVE VARIANTS
// ============================================================

function applyStatCurveVariant(variant, savedCurves) {
  for (const [id, gang] of Object.entries(GANGS)) {
    savedCurves[id] = gang.statCurve;
    const original = gang.statCurve;
    switch (variant) {
      case 'flat':
        gang.statCurve = (t, i) => {
          const o = original(t, i);
          // Compress toward average: halve the spread from midpoint
          const avg = (k) => (original(0, 0)[k] + original(1, 19)[k]) / 2;
          return {
            dayAtk: Math.round(avg('dayAtk') + (o.dayAtk - avg('dayAtk')) * 0.5),
            dayDef: Math.round(avg('dayDef') + (o.dayDef - avg('dayDef')) * 0.5),
            nightAtk: Math.round(avg('nightAtk') + (o.nightAtk - avg('nightAtk')) * 0.5),
            nightDef: Math.round(avg('nightDef') + (o.nightDef - avg('nightDef')) * 0.5),
          };
        };
        break;
      case 'steep':
        gang.statCurve = (t, i) => {
          const o = original(t, i);
          return {
            dayAtk: Math.max(1, Math.round(o.dayAtk * (0.5 + t))),
            dayDef: Math.max(1, Math.round(o.dayDef * (0.5 + t))),
            nightAtk: Math.max(1, Math.round(o.nightAtk * (0.5 + t))),
            nightDef: Math.max(1, Math.round(o.nightDef * (0.5 + t))),
          };
        };
        break;
      case 'compressed_high':
        gang.statCurve = (t, i) => {
          const o = original(t, i);
          return {
            dayAtk: Math.max(3, o.dayAtk),
            dayDef: Math.max(3, o.dayDef),
            nightAtk: Math.max(3, o.nightAtk),
            nightDef: Math.max(3, o.nightDef),
          };
        };
        break;
      case 'compressed_low':
        gang.statCurve = (t, i) => {
          const o = original(t, i);
          return {
            dayAtk: Math.min(6, o.dayAtk),
            dayDef: Math.min(6, o.dayDef),
            nightAtk: Math.min(6, o.nightAtk),
            nightDef: Math.min(6, o.nightDef),
          };
        };
        break;
    }
  }
}

function restoreStatCurves(savedCurves) {
  for (const [id, curve] of Object.entries(savedCurves)) {
    GANGS[id].statCurve = curve;
  }
}

// ============================================================
// GAME ENGINE
// ============================================================

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Get the active ATK/DEF for a card given the current phase.
 */
function getStats(card, isNight) {
  if (isNight) {
    return { atk: card.nightAtk, def: card.nightDef };
  }
  return { atk: card.dayAtk, def: card.dayDef };
}

/**
 * Create a fresh game state.
 */
function createGameState(config) {
  const { gangA, gangB, deckSize } = config;
  const deckSizeA = config.deckSizeA || deckSize;
  const deckSizeB = config.deckSizeB || deckSize;

  // Apply stat curve variant if configured
  const savedCurves = {};
  if (config.curveVariant && config.curveVariant !== 'default') {
    applyStatCurveVariant(config.curveVariant, savedCurves);
  }

  const deckA = shuffle(generateDeck(GANGS[gangA], deckSizeA));
  const deckB = shuffle(generateDeck(GANGS[gangB], deckSizeB));

  // Restore original curves
  if (config.curveVariant && config.curveVariant !== 'default') {
    restoreStatCurves(savedCurves);
  }

  // Coin flip
  const firstPlayer = Math.random() < 0.5 ? 'A' : 'B';

  // Draw vanguards
  const vanA = deckA.pop();
  const vanB = deckB.pop();

  // Deal hands — second player gets +1 if configured
  const handSizeFirst = 4;
  const handSizeSecond = config.secondPlayerBonus ? 5 : 4;

  const handA = [];
  const handB = [];
  const countA = firstPlayer === 'A' ? handSizeFirst : handSizeSecond;
  const countB = firstPlayer === 'B' ? handSizeFirst : handSizeSecond;

  for (let i = 0; i < countA && deckA.length > 0; i++) handA.push(deckA.pop());
  for (let i = 0; i < countB && deckB.length > 0; i++) handB.push(deckB.pop());

  // Vanguard HP = dayDef (start during day)
  const vanAState = {
    card: vanA,
    hp: vanA.dayDef,
    maxHp: vanA.dayDef,
    shield: GANGS[gangA].passive === 'ANCHOR' ? 2 : 0,
  };
  const vanBState = {
    card: vanB,
    hp: vanB.dayDef,
    maxHp: vanB.dayDef,
    shield: GANGS[gangB].passive === 'ANCHOR' ? 2 : 0,
  };

  return {
    config,
    turn: firstPlayer,
    firstPlayer,
    isNight: false,
    nightShiftCounter: 0, // counts toward day/night flip
    turnNumber: 0,
    consecutivePasses: 0,

    A: {
      gang: gangA,
      deck: deckA,
      hand: handA,
      vanguard: vanAState,
      discard: [],
    },
    B: {
      gang: gangB,
      deck: deckB,
      hand: handB,
      vanguard: vanBState,
      discard: [],
    },

    // Metrics
    metrics: {
      turns: 0,
      passes: 0,
      attacks: 0,
      sacrifices: 0,
      hustles: 0,
      dieRolls: 0,
      dieHits: 0,
      dieMisses: 0,
      dieVanguardHits: 0,
      precisionLocks: 0,
      overdrawPenalties: 0,
      shieldSaves: 0,
      vanguardDeaths: 0,
      runsPlayed: 0,
      setsPlayed: 0,
      nightShifts: 0,
      killsByA: 0,
      killsByB: 0,
      forcedDieRolls: 0, // from opponent SHIV-like effects
      sacrificeDraws: 0, // CROWS passive triggers
      bleedDiscards: 0,  // SHIVS passive triggers
      stallBreakers: 0,
      cardsRemainingInDeck: 0,
    },

    winner: null,
    endReason: null,
    forcedDieNextTurn: { A: false, B: false },
  };
}

// ============================================================
// GAME ACTIONS
// ============================================================

function getAtk(card, isNight, gang) {
  const base = isNight ? card.nightAtk : card.dayAtk;
  // KNUCKLES passive: +1 damage
  if (gang === 'KNUCKLES') return base + 1;
  return base;
}

function getDef(card, isNight) {
  return isNight ? card.nightDef : card.dayDef;
}

function canAttack(attackCard, targetVanguard, isNight, attackerGang, config) {
  const atk = getAtk(attackCard, isNight, attackerGang);
  const targetHp = targetVanguard.hp;
  // Precision rule: ATK <= HP * multiplier
  return atk <= targetHp * config.precisionMult;
}

function findRuns(hand, isNight, gang) {
  if (hand.length < 2) return [];
  // Sort by ATK value
  const indexed = hand.map((c, i) => ({
    card: c, idx: i, atk: getAtk(c, isNight, gang),
  }));
  indexed.sort((a, b) => a.atk - b.atk);

  const runs = [];
  let current = [indexed[0]];

  for (let i = 1; i < indexed.length; i++) {
    if (indexed[i].atk === current[current.length - 1].atk + 1) {
      current.push(indexed[i]);
    } else {
      if (current.length >= 2) runs.push([...current]);
      current = [indexed[i]];
    }
  }
  if (current.length >= 2) runs.push([...current]);

  return runs;
}

function findSets(hand, isNight, gang) {
  if (hand.length < 2) return [];
  const byAtk = {};
  hand.forEach((c, i) => {
    const atk = getAtk(c, isNight, gang);
    if (!byAtk[atk]) byAtk[atk] = [];
    byAtk[atk].push({ card: c, idx: i, atk });
  });
  return Object.values(byAtk).filter(g => g.length >= 2);
}

function rollDie(state, targetSide) {
  const { dieSize } = state.config;
  const roll = Math.floor(Math.random() * dieSize) + 1;
  const player = state[targetSide];
  const totalPositions = player.hand.length + 1; // hand + vanguard

  state.metrics.dieRolls++;

  if (roll > totalPositions) {
    // Miss — roll exceeds card positions
    state.metrics.dieMisses++;
    return { hit: false, roll, target: 'miss' };
  }

  // Check shield absorption
  if (player.vanguard && player.vanguard.shield > 0) {
    player.vanguard.shield--;
    state.metrics.shieldSaves++;
    return { hit: false, roll, target: 'shield_absorbed' };
  }

  if (roll <= player.hand.length) {
    // Hit a hand card — discard it
    const discarded = player.hand.splice(roll - 1, 1)[0];
    player.discard.push(discarded);
    state.metrics.dieHits++;
    return { hit: true, roll, target: 'hand', card: discarded };
  } else {
    // Hit the vanguard — take 2 damage
    if (player.vanguard) {
      player.vanguard.hp = Math.max(0, player.vanguard.hp - 2);
      state.metrics.dieVanguardHits++;
    }
    state.metrics.dieHits++;
    return { hit: true, roll, target: 'vanguard' };
  }
}

function drawCard(state, side, count = 1) {
  const player = state[side];
  const { handMax } = state.config;

  for (let i = 0; i < count; i++) {
    if (player.deck.length === 0) continue;
    const card = player.deck.pop();
    player.hand.push(card);

    // Check overdraw
    if (player.hand.length > handMax) {
      if (player.vanguard && player.vanguard.shield > 0) {
        // Shield absorbs overdraw
        player.vanguard.shield--;
        const overflow = player.hand.pop();
        player.discard.push(overflow);
        state.metrics.shieldSaves++;
      } else {
        // Forced promotion — first card becomes vanguard
        state.metrics.overdrawPenalties++;
        const forced = player.hand.shift();
        if (player.vanguard) {
          player.discard.push(player.vanguard.card);
        }
        const def = getDef(forced, state.isNight);
        player.vanguard = {
          card: forced,
          hp: def,
          maxHp: def,
          shield: GANGS[player.gang].passive === 'ANCHOR' ? 2 : 0,
        };
      }
    }
  }
}

function promoteVanguard(state, side, cardIndex) {
  const player = state[side];
  const card = player.hand.splice(cardIndex, 1)[0];
  const def = getDef(card, state.isNight);
  player.vanguard = {
    card: card,
    hp: def,
    maxHp: def,
    shield: GANGS[player.gang].passive === 'ANCHOR' ? 2 : 0,
  };
}

function handleVanguardDeath(state, deadSide, killerSide) {
  state.metrics.vanguardDeaths++;
  const dead = state[deadSide];
  const killer = state[killerSide];

  if (killerSide === 'A') state.metrics.killsByA++;
  else state.metrics.killsByB++;

  // Discard dead vanguard
  dead.discard.push(dead.vanguard.card);
  dead.vanguard = null;

  // Kill bounty: killer draws 2
  drawCard(state, killerSide, 2);

  // SHIVS passive: BLEED — opponent discards 1 on kill
  if (GANGS[killer.gang].passive === 'BLEED' && dead.hand.length > 0) {
    const discIdx = Math.floor(Math.random() * dead.hand.length);
    dead.discard.push(dead.hand.splice(discIdx, 1)[0]);
    state.metrics.bleedDiscards++;
  }

  // Check starvation
  if (dead.hand.length === 0) {
    state.winner = killerSide;
    state.endReason = 'starvation';
    return;
  }

  // Die-driven night shift: increment counter, check for phase flip
  const nightFreq = state.config.nightShiftEvery || 2;
  state.nightShiftCounter++;
  if (state.nightShiftCounter >= nightFreq) {
    state.isNight = !state.isNight;
    state.nightShiftCounter = 0;
    state.metrics.nightShifts++;
    // Update surviving vanguard maxHp to match new phase def
    for (const s of ['A', 'B']) {
      const p = state[s];
      if (p.vanguard) {
        const newDef = getDef(p.vanguard.card, state.isNight);
        // Scale HP proportionally
        const ratio = p.vanguard.hp / p.vanguard.maxHp;
        p.vanguard.maxHp = newDef;
        p.vanguard.hp = Math.max(1, Math.round(ratio * newDef));
      }
    }
  }

  // AI promotes — pick highest DEF card for current phase
  let bestIdx = 0;
  let bestDef = -1;
  dead.hand.forEach((c, i) => {
    const d = getDef(c, state.isNight);
    if (d > bestDef) { bestDef = d; bestIdx = i; }
  });
  promoteVanguard(state, deadSide, bestIdx);
}

// ============================================================
// AI DECISION MAKING
// ============================================================

function aiDecide(state, side) {
  const player = state[side];
  const opponent = state[side === 'A' ? 'B' : 'A'];
  const opSide = side === 'A' ? 'B' : 'A';
  const { isNight, config } = state;

  if (!player.vanguard || !opponent.vanguard) return { action: 'pass' };

  // Forced die roll from opponent's effect
  if (state.forcedDieNextTurn[side]) {
    state.forcedDieNextTurn[side] = false;
    state.metrics.forcedDieRolls++;
    return { action: 'roll_die' };
  }

  // Check what attacks are possible
  const validAttacks = [];
  player.hand.forEach((card, idx) => {
    if (canAttack(card, opponent.vanguard, isNight, player.gang, config)) {
      const atk = getAtk(card, isNight, player.gang);
      const isLethal = atk >= opponent.vanguard.hp;
      validAttacks.push({ idx, card, atk, isLethal });
    }
  });

  // 1. Check for runs (if enabled)
  if (config.runsEnabled && player.hand.length >= 2) {
    const runs = findRuns(player.hand, isNight, player.gang);
    for (const run of runs) {
      if (run.length >= 3) {
        // Check if all cards in the run can individually attack
        const allValid = run.every(r =>
          canAttack(r.card, opponent.vanguard, isNight, player.gang, config)
        );
        if (allValid) {
          return {
            action: 'run',
            indices: run.map(r => r.idx).sort((a, b) => b - a), // reverse for safe removal
            totalAtk: run.reduce((sum, r) => sum + r.atk, 0),
          };
        }
      }
    }
  }

  // 2. Check for sets (if enabled)
  if (config.setsEnabled && player.hand.length >= 2) {
    const sets = findSets(player.hand, isNight, player.gang);
    for (const set of sets) {
      if (set.length >= 2) {
        const canPlay = canAttack(set[0].card, opponent.vanguard, isNight, player.gang, config);
        if (canPlay) {
          return {
            action: 'set',
            indices: set.map(s => s.idx).sort((a, b) => b - a),
            atk: set[0].atk,
          };
        }
      }
    }
  }

  // 3. Exact lethal single attack
  const lethals = validAttacks.filter(a => a.isLethal);
  if (lethals.length > 0) {
    // Pick lowest ATK lethal (preserve high cards)
    lethals.sort((a, b) => a.atk - b.atk);
    return { action: 'attack', idx: lethals[0].idx, card: lethals[0].card };
  }

  // 4. Best valid single attack
  if (validAttacks.length > 0) {
    validAttacks.sort((a, b) => b.atk - a.atk);
    return { action: 'attack', idx: validAttacks[0].idx, card: validAttacks[0].card };
  }

  // 5. Precision locked — track it
  if (player.hand.length > 0) {
    state.metrics.precisionLocks++;
  }

  // 6. If precision-locked with die available, roll
  if (player.hand.length > 2 && config.dieSize > 0) {
    return { action: 'roll_die' };
  }

  // 7. Sacrifice lowest ATK card to heal (if damaged)
  const vanHp = player.vanguard.hp;
  const vanMax = player.vanguard.maxHp;
  if (player.hand.length > 0 && vanHp < vanMax - 1) {
    let lowestIdx = 0;
    let lowestAtk = Infinity;
    player.hand.forEach((c, i) => {
      const a = getAtk(c, isNight, player.gang);
      if (a < lowestAtk) { lowestAtk = a; lowestIdx = i; }
    });
    return { action: 'sacrifice', idx: lowestIdx };
  }

  // 8. Hustle (pay 2 HP, draw 1)
  if (vanHp > 3 && player.hand.length < config.handMax && player.deck.length > 0) {
    return { action: 'hustle' };
  }

  // 9. Sacrifice anyway if we have cards (prevent pure stall)
  if (player.hand.length > 0) {
    let lowestIdx = 0;
    let lowestAtk = Infinity;
    player.hand.forEach((c, i) => {
      const a = getAtk(c, isNight, player.gang);
      if (a < lowestAtk) { lowestAtk = a; lowestIdx = i; }
    });
    return { action: 'sacrifice', idx: lowestIdx };
  }

  return { action: 'pass' };
}

// ============================================================
// GAME LOOP
// ============================================================

function executeTurn(state) {
  const side = state.turn;
  const player = state[side];
  const opSide = side === 'A' ? 'B' : 'A';
  const opponent = state[opSide];

  state.turnNumber++;
  state.metrics.turns++;

  // Check for game end conditions
  if (!player.vanguard && player.hand.length === 0) {
    state.winner = opSide;
    state.endReason = 'starvation';
    return;
  }
  if (!opponent.vanguard && opponent.hand.length === 0) {
    state.winner = side;
    state.endReason = 'starvation';
    return;
  }

  const decision = aiDecide(state, side);

  switch (decision.action) {
    case 'attack': {
      state.metrics.attacks++;
      state.consecutivePasses = 0;
      const card = player.hand.splice(decision.idx, 1)[0];
      player.discard.push(card);
      const atk = getAtk(card, state.isNight, player.gang);
      let dmg = atk;

      // Apply damage (shield first)
      if (opponent.vanguard.shield > 0) {
        const absorbed = Math.min(opponent.vanguard.shield, dmg);
        opponent.vanguard.shield -= absorbed;
        dmg -= absorbed;
      }
      opponent.vanguard.hp = Math.max(0, opponent.vanguard.hp - dmg);

      // Check vanguard death
      if (opponent.vanguard.hp <= 0) {
        handleVanguardDeath(state, opSide, side);
      }
      break;
    }

    case 'run': {
      state.metrics.runsPlayed++;
      state.metrics.attacks++;
      state.consecutivePasses = 0;
      let totalDmg = decision.totalAtk;
      // Remove cards (indices sorted descending for safe splice)
      for (const idx of decision.indices) {
        player.discard.push(player.hand.splice(idx, 1)[0]);
      }
      // Apply total damage
      if (opponent.vanguard.shield > 0) {
        const absorbed = Math.min(opponent.vanguard.shield, totalDmg);
        opponent.vanguard.shield -= absorbed;
        totalDmg -= absorbed;
      }
      opponent.vanguard.hp = Math.max(0, opponent.vanguard.hp - totalDmg);
      if (opponent.vanguard.hp <= 0) {
        handleVanguardDeath(state, opSide, side);
      }
      break;
    }

    case 'set': {
      state.metrics.setsPlayed++;
      state.metrics.attacks++;
      state.consecutivePasses = 0;
      let dmg = decision.atk;
      for (const idx of decision.indices) {
        player.discard.push(player.hand.splice(idx, 1)[0]);
      }
      if (opponent.vanguard.shield > 0) {
        const absorbed = Math.min(opponent.vanguard.shield, dmg);
        opponent.vanguard.shield -= absorbed;
        dmg -= absorbed;
      }
      opponent.vanguard.hp = Math.max(0, opponent.vanguard.hp - dmg);
      if (opponent.vanguard.hp <= 0) {
        handleVanguardDeath(state, opSide, side);
      }
      break;
    }

    case 'sacrifice': {
      state.metrics.sacrifices++;
      state.consecutivePasses = 0;
      const card = player.hand.splice(decision.idx, 1)[0];
      player.discard.push(card);
      const def = getDef(card, state.isNight);
      if (player.vanguard) {
        player.vanguard.hp = Math.min(player.vanguard.maxHp, player.vanguard.hp + def);
      }
      // CROWS passive: draw 1 on sacrifice
      if (GANGS[player.gang].passive === 'SCAVENGE') {
        drawCard(state, side, 1);
        state.metrics.sacrificeDraws++;
      }
      break;
    }

    case 'hustle': {
      state.metrics.hustles++;
      state.consecutivePasses = 0;
      if (player.vanguard) {
        player.vanguard.hp = Math.max(0, player.vanguard.hp - 2);
        if (player.vanguard.hp <= 0) {
          handleVanguardDeath(state, side, opSide);
          break;
        }
      }
      drawCard(state, side, 1);
      break;
    }

    case 'roll_die': {
      state.consecutivePasses = 0;
      rollDie(state, side);
      break;
    }

    case 'pass':
    default: {
      state.metrics.passes++;
      state.consecutivePasses++;

      // Stall breaker: both pass consecutively → both draw 1
      if (state.consecutivePasses >= 2) {
        state.metrics.stallBreakers++;
        drawCard(state, 'A', 1);
        drawCard(state, 'B', 1);
        state.consecutivePasses = 0;
      }
      break;
    }
  }

  // Swap turn
  state.turn = state.turn === 'A' ? 'B' : 'A';
}

function playGame(config) {
  const state = createGameState(config);
  const maxTurns = config.maxTurns || 200;

  while (!state.winner && state.turnNumber < maxTurns) {
    executeTurn(state);
  }

  if (!state.winner) {
    state.endReason = 'stall';
    // Assign winner by remaining resources
    const scoreA = (state.A.hand.length * 2) + (state.A.vanguard ? state.A.vanguard.hp : 0);
    const scoreB = (state.B.hand.length * 2) + (state.B.vanguard ? state.B.vanguard.hp : 0);
    state.winner = scoreA >= scoreB ? 'A' : 'B';
  }

  state.metrics.cardsRemainingInDeck = state.A.deck.length + state.B.deck.length;
  return state;
}

// ============================================================
// MONTE CARLO RUNNER
// ============================================================

function runSimulation(config, numGames) {
  const results = {
    config: { ...config },
    games: numGames,
    winsA: 0,
    winsB: 0,
    firstMoverWins: 0,
    stallOuts: 0,
    starvationWins: 0,
    avgTurns: 0,
    medianTurns: 0,
    avgPassRate: 0,
    avgPrecisionLockRate: 0,
    avgAttacks: 0,
    avgSacrifices: 0,
    avgHustles: 0,
    avgDieRolls: 0,
    avgDieHitRate: 0,
    avgOverdraw: 0,
    avgShieldSaves: 0,
    avgVanguardDeaths: 0,
    avgRuns: 0,
    avgSets: 0,
    avgNightShifts: 0,
    avgBleedDiscards: 0,
    avgSacrificeDraws: 0,
    avgStallBreakers: 0,
    avgCardsRemaining: 0,
    turnDistribution: { '1-10': 0, '11-20': 0, '21-30': 0, '31-40': 0, '41-50': 0, '51+': 0 },
  };

  const allTurns = [];

  for (let i = 0; i < numGames; i++) {
    const state = playGame(config);
    const m = state.metrics;

    if (state.winner === 'A') results.winsA++;
    else results.winsB++;

    if (state.winner === state.firstPlayer) results.firstMoverWins++;
    if (state.endReason === 'stall') results.stallOuts++;
    if (state.endReason === 'starvation') results.starvationWins++;

    allTurns.push(m.turns);
    results.avgTurns += m.turns;
    results.avgPassRate += m.turns > 0 ? m.passes / m.turns : 0;
    results.avgPrecisionLockRate += m.turns > 0 ? m.precisionLocks / m.turns : 0;
    results.avgAttacks += m.attacks;
    results.avgSacrifices += m.sacrifices;
    results.avgHustles += m.hustles;
    results.avgDieRolls += m.dieRolls;
    results.avgDieHitRate += m.dieRolls > 0 ? m.dieHits / m.dieRolls : 0;
    results.avgOverdraw += m.overdrawPenalties;
    results.avgShieldSaves += m.shieldSaves;
    results.avgVanguardDeaths += m.vanguardDeaths;
    results.avgRuns += m.runsPlayed;
    results.avgSets += m.setsPlayed;
    results.avgNightShifts += m.nightShifts;
    results.avgBleedDiscards += m.bleedDiscards;
    results.avgSacrificeDraws += m.sacrificeDraws;
    results.avgStallBreakers += m.stallBreakers;
    results.avgCardsRemaining += m.cardsRemainingInDeck;

    if (m.turns <= 10) results.turnDistribution['1-10']++;
    else if (m.turns <= 20) results.turnDistribution['11-20']++;
    else if (m.turns <= 30) results.turnDistribution['21-30']++;
    else if (m.turns <= 40) results.turnDistribution['31-40']++;
    else if (m.turns <= 50) results.turnDistribution['41-50']++;
    else results.turnDistribution['51+']++;
  }

  // Average everything
  const n = numGames;
  results.avgTurns = +(results.avgTurns / n).toFixed(1);
  results.avgPassRate = +(results.avgPassRate / n * 100).toFixed(1);
  results.avgPrecisionLockRate = +(results.avgPrecisionLockRate / n * 100).toFixed(1);
  results.avgAttacks = +(results.avgAttacks / n).toFixed(1);
  results.avgSacrifices = +(results.avgSacrifices / n).toFixed(1);
  results.avgHustles = +(results.avgHustles / n).toFixed(1);
  results.avgDieRolls = +(results.avgDieRolls / n).toFixed(1);
  results.avgDieHitRate = +(results.avgDieHitRate / n * 100).toFixed(1);
  results.avgOverdraw = +(results.avgOverdraw / n).toFixed(2);
  results.avgShieldSaves = +(results.avgShieldSaves / n).toFixed(2);
  results.avgVanguardDeaths = +(results.avgVanguardDeaths / n).toFixed(1);
  results.avgRuns = +(results.avgRuns / n).toFixed(2);
  results.avgSets = +(results.avgSets / n).toFixed(2);
  results.avgNightShifts = +(results.avgNightShifts / n).toFixed(1);
  results.avgBleedDiscards = +(results.avgBleedDiscards / n).toFixed(2);
  results.avgSacrificeDraws = +(results.avgSacrificeDraws / n).toFixed(2);
  results.avgStallBreakers = +(results.avgStallBreakers / n).toFixed(2);
  results.avgCardsRemaining = +(results.avgCardsRemaining / n).toFixed(1);

  // Median turns
  allTurns.sort((a, b) => a - b);
  results.medianTurns = allTurns[Math.floor(n / 2)];

  // Win rates as percentages
  results.winRateA = +(results.winsA / n * 100).toFixed(1);
  results.winRateB = +(results.winsB / n * 100).toFixed(1);
  results.firstMoverWinRate = +(results.firstMoverWins / n * 100).toFixed(1);
  results.stallRate = +(results.stallOuts / n * 100).toFixed(1);
  results.starvationRate = +(results.starvationWins / n * 100).toFixed(1);

  return results;
}

// ============================================================
// SWEEP CONFIGURATIONS
// ============================================================

const SWEEPS = {
  // Sweep 1: All matchups with baseline config
  matchups: () => {
    const gangs = ['KNUCKLES', 'CHAINS', 'SHIVS', 'CROWS'];
    const configs = [];
    for (let i = 0; i < gangs.length; i++) {
      for (let j = i; j < gangs.length; j++) {
        configs.push({
          label: `${gangs[i]} vs ${gangs[j]}`,
          gangA: gangs[i], gangB: gangs[j],
          deckSize: 20, dieSize: 6, precisionMult: 1.5,
          handMax: 5, runsEnabled: true, setsEnabled: true,
          secondPlayerBonus: true,
        });
      }
    }
    return configs;
  },

  // Sweep 2: Deck sizes
  deckSize: () => [15, 18, 20, 24, 28].map(size => ({
    label: `${size}-card deck`,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: size, dieSize: 6, precisionMult: 1.5,
    handMax: 5, runsEnabled: true, setsEnabled: true,
    secondPlayerBonus: true,
  })),

  // Sweep 3: Precision multipliers
  precision: () => [1.0, 1.25, 1.5, 2.0, 2.5, 3.0].map(mult => ({
    label: `precision ${mult}x`,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: 20, dieSize: 6, precisionMult: mult,
    handMax: 5, runsEnabled: true, setsEnabled: true,
    secondPlayerBonus: true,
  })),

  // Sweep 4: Die sizes (difficulty)
  dieSize: () => [0, 4, 6, 8, 10, 12, 20].map(size => ({
    label: size === 0 ? 'no die' : `d${size}`,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: 20, dieSize: size, precisionMult: 1.5,
    handMax: 5, runsEnabled: true, setsEnabled: true,
    secondPlayerBonus: true,
  })),

  // Sweep 5: Runs/sets combinations
  combos: () => [
    { runsEnabled: false, setsEnabled: false, label: 'singles only' },
    { runsEnabled: true, setsEnabled: false, label: 'runs only' },
    { runsEnabled: false, setsEnabled: true, label: 'sets only' },
    { runsEnabled: true, setsEnabled: true, label: 'runs + sets' },
  ].map(combo => ({
    ...combo,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: 20, dieSize: 6, precisionMult: 1.5,
    handMax: 5, secondPlayerBonus: true,
  })),

  // Sweep 6: Hand max sizes
  handMax: () => [4, 5, 6, 7].map(max => ({
    label: `hand max ${max}`,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: 20, dieSize: 6, precisionMult: 1.5,
    handMax: max, runsEnabled: true, setsEnabled: true,
    secondPlayerBonus: true,
  })),

  // Sweep 7: Second player bonus
  bonus: () => [
    { secondPlayerBonus: false, label: 'no bonus' },
    { secondPlayerBonus: true, label: '+1 card bonus' },
  ].map(b => ({
    ...b,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: 20, dieSize: 6, precisionMult: 1.5,
    handMax: 5, runsEnabled: true, setsEnabled: true,
  })),

  // Sweep 8: Die as difficulty across all matchups
  difficulty: () => {
    const difficulties = [
      { dieSize: 4, label: 'BRUTAL (d4)' },
      { dieSize: 6, label: 'HARD (d6)' },
      { dieSize: 8, label: 'MEDIUM (d8)' },
      { dieSize: 12, label: 'EASY (d12)' },
      { dieSize: 20, label: 'CASUAL (d20)' },
    ];
    return difficulties.map(d => ({
      ...d,
      gangA: 'KNUCKLES', gangB: 'CHAINS',
      deckSize: 20, precisionMult: 1.5,
      handMax: 5, runsEnabled: true, setsEnabled: true,
      secondPlayerBonus: true,
    }));
  },

  // Sweep 9: Asymmetric deck sizes (gang-specific card counts)
  asymmetricDecks: () => {
    // Aggressive gang (KNUCKLES) with fewer cards vs defensive (CHAINS) with more
    const configs = [
      { gangA: 'KNUCKLES', gangB: 'CHAINS', deckSizeA: 16, deckSizeB: 24, label: 'KNU:16 vs CHN:24' },
      { gangA: 'KNUCKLES', gangB: 'CHAINS', deckSizeA: 18, deckSizeB: 22, label: 'KNU:18 vs CHN:22' },
      { gangA: 'KNUCKLES', gangB: 'CHAINS', deckSizeA: 20, deckSizeB: 20, label: 'KNU:20 vs CHN:20 (mirror)' },
      { gangA: 'KNUCKLES', gangB: 'CHAINS', deckSizeA: 22, deckSizeB: 18, label: 'KNU:22 vs CHN:18' },
      { gangA: 'SHIVS', gangB: 'CROWS', deckSizeA: 16, deckSizeB: 24, label: 'SHV:16 vs CRW:24' },
      { gangA: 'SHIVS', gangB: 'CROWS', deckSizeA: 18, deckSizeB: 22, label: 'SHV:18 vs CRW:22' },
      { gangA: 'SHIVS', gangB: 'CROWS', deckSizeA: 20, deckSizeB: 20, label: 'SHV:20 vs CRW:20 (mirror)' },
      { gangA: 'SHIVS', gangB: 'CROWS', deckSizeA: 24, deckSizeB: 16, label: 'SHV:24 vs CRW:16' },
    ];
    return configs.map(c => ({
      ...c,
      deckSize: c.deckSizeA, // engine uses this for A, we override B below
      dieSize: 6, precisionMult: 1.5,
      handMax: 5, runsEnabled: true, setsEnabled: true,
      secondPlayerBonus: true,
    }));
  },

  // Sweep 10: Stat curve variants — what if gangs had different stat ranges?
  statCurves: () => {
    // Test with modified gang stat curves to explore the design space
    const configs = [
      { label: 'default curves', curveVariant: 'default' },
      { label: 'flatter (less spread)', curveVariant: 'flat' },
      { label: 'steeper (more spread)', curveVariant: 'steep' },
      { label: 'high floor low ceiling', curveVariant: 'compressed_high' },
      { label: 'low floor high ceiling', curveVariant: 'compressed_low' },
    ];
    return configs.map(c => ({
      ...c,
      gangA: 'KNUCKLES', gangB: 'CHAINS',
      deckSize: 20, dieSize: 6, precisionMult: 1.5,
      handMax: 5, runsEnabled: true, setsEnabled: true,
      secondPlayerBonus: true,
    }));
  },

  // Sweep 11: Night shift frequency (how often does day/night flip)
  nightFreq: () => [1, 2, 3, 4, 5, 99].map(freq => ({
    label: freq === 99 ? 'never' : `every ${freq} kills`,
    nightShiftEvery: freq,
    gangA: 'KNUCKLES', gangB: 'CHAINS',
    deckSize: 20, dieSize: 6, precisionMult: 1.5,
    handMax: 5, runsEnabled: true, setsEnabled: true,
    secondPlayerBonus: true,
  })),
};

// ============================================================
// OUTPUT FORMATTING
// ============================================================

function printResults(sweepName, allResults) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  SWEEP: ${sweepName.toUpperCase()}`);
  console.log(`${'='.repeat(80)}`);

  const metrics = [
    ['Win Rate A', 'winRateA', '%'],
    ['Win Rate B', 'winRateB', '%'],
    ['1st Mover Win%', 'firstMoverWinRate', '%'],
    ['Avg Turns', 'avgTurns', ''],
    ['Median Turns', 'medianTurns', ''],
    ['Pass Rate', 'avgPassRate', '%'],
    ['Precision Lock%', 'avgPrecisionLockRate', '%'],
    ['Stall Rate', 'stallRate', '%'],
    ['Starvation Win%', 'starvationRate', '%'],
    ['Avg Attacks', 'avgAttacks', ''],
    ['Avg Sacrifices', 'avgSacrifices', ''],
    ['Avg Hustles', 'avgHustles', ''],
    ['Avg Die Rolls', 'avgDieRolls', ''],
    ['Die Hit Rate', 'avgDieHitRate', '%'],
    ['Avg Overdraw', 'avgOverdraw', ''],
    ['Avg Shield Saves', 'avgShieldSaves', ''],
    ['Avg Van Deaths', 'avgVanguardDeaths', ''],
    ['Avg Runs Played', 'avgRuns', ''],
    ['Avg Sets Played', 'avgSets', ''],
    ['Avg Night Shifts', 'avgNightShifts', ''],
    ['Avg Bleed Discard', 'avgBleedDiscards', ''],
    ['Avg Scav Draws', 'avgSacrificeDraws', ''],
    ['Avg Stall Breaks', 'avgStallBreakers', ''],
    ['Cards Left in Deck', 'avgCardsRemaining', ''],
  ];

  // Header
  const labels = allResults.map(r => r.config.label || '???');
  const colWidth = Math.max(16, ...labels.map(l => l.length + 2));
  const metricCol = 18;

  let header = ''.padEnd(metricCol);
  labels.forEach(l => { header += l.padStart(colWidth); });
  console.log(header);
  console.log('-'.repeat(metricCol + colWidth * labels.length));

  // Rows
  for (const [name, key, suffix] of metrics) {
    let row = name.padEnd(metricCol);
    for (const r of allResults) {
      const val = r[key] !== undefined ? `${r[key]}${suffix}` : 'N/A';
      row += val.padStart(colWidth);
    }
    console.log(row);
  }

  // Turn distribution
  console.log('\nTurn Distribution:');
  let distHeader = ''.padEnd(metricCol);
  labels.forEach(l => { distHeader += l.padStart(colWidth); });
  console.log(distHeader);
  for (const bucket of ['1-10', '11-20', '21-30', '31-40', '41-50', '51+']) {
    let row = `  ${bucket} turns`.padEnd(metricCol);
    for (const r of allResults) {
      const pct = (r.turnDistribution[bucket] / r.games * 100).toFixed(1) + '%';
      row += pct.padStart(colWidth);
    }
    console.log(row);
  }
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const args = process.argv.slice(2);
  const sweepArg = args.find((a, i) => args[i - 1] === '--sweep');
  const gamesArg = args.find((a, i) => args[i - 1] === '--games');
  const numGames = parseInt(gamesArg) || 5000;

  const sweepsToRun = sweepArg ? [sweepArg] : Object.keys(SWEEPS);

  console.log(`\nMEAN STREETS — Monte Carlo Simulation Engine`);
  console.log(`Games per config: ${numGames}`);
  console.log(`Sweeps: ${sweepsToRun.join(', ')}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  for (const sweepName of sweepsToRun) {
    if (!SWEEPS[sweepName]) {
      console.error(`Unknown sweep: ${sweepName}`);
      continue;
    }

    const configs = SWEEPS[sweepName]();
    console.log(`\nRunning sweep "${sweepName}" (${configs.length} configs × ${numGames} games)...`);

    const results = [];
    for (const config of configs) {
      const start = Date.now();
      const result = runSimulation(config, numGames);
      const elapsed = Date.now() - start;
      results.push(result);
      process.stdout.write(`  ✓ ${config.label} (${elapsed}ms)\n`);
    }

    printResults(sweepName, results);
  }

  // Summary recommendations
  console.log(`\n${'='.repeat(80)}`);
  console.log('  ANALYSIS COMPLETE');
  console.log(`${'='.repeat(80)}`);
  console.log(`\nFinished: ${new Date().toISOString()}`);
}

main();
