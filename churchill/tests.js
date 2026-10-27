// Tests for the game core wrapper and the pure game-flow helpers.
// Browser: open tests.html. Headless: node churchill/tests.js, or
// deno run --allow-read churchill/tests.js

import {
  loadCore, landing, decodeMove, encodeMove, rank, suit, cardName, makeCard, validSeed,
} from './core.js';
import {
  targetsFor, canPick, slotFor, chooseLayout, pileOffsets,
  newRecord, withMove, withUndo, withSwitch, replay,
} from './play.js';

// ============= Test Framework =============

const groups = [];
let currentGroup = null;

function describe(name, fn) {
  currentGroup = { name, tests: [], passed: 0, failed: 0 };
  groups.push(currentGroup);
  fn();
  currentGroup = null;
}

function test(name, fn) {
  try {
    fn();
    currentGroup.tests.push({ name, pass: true });
    currentGroup.passed++;
  } catch (e) {
    currentGroup.tests.push({ name, pass: false, error: e.message });
    currentGroup.failed++;
  }
}

function assertEqual(actual, expected, msg = '') {
  if (actual !== expected) {
    throw new Error(`${msg} Expected ${expected}, got ${actual}`);
  }
}

function assert(cond, msg = '') {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// ============= Load the core =============

const wasmBytes = async () => {
  const url = new URL('./core.wasm', import.meta.url);
  if (typeof Deno !== 'undefined') return Deno.readFile(url);
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { readFile } = await import('node:fs/promises');
    return readFile(url);
  }
  return fetch(url);
};

const core = await loadCore(await wasmBytes());
// A second instance stands in for the solver worker.
const solver = await loadCore(await wasmBytes());

// Seed 1, from `churchill show 1` in the analysis repo.
const SEED1_PILES = ['Jc', '9s 8s', 'Kh 6d 5h', '7s 5c 5s 4h', 'Td 4s 3d 9c 9h', 'Td 7d Ks 6h Js', 'Ah 6s 2s 3c', '3s Ad 8d', 'Qc 9s', '8c'];
const RANKS = 'A23456789TJQK';
const parse = (s) => makeCard(RANKS.indexOf(s[0]) + 1, s[1]);

// ============= Tests =============

describe('Cards and moves', () => {
  test('card encoding matches the engine', () => {
    const c = parse('Qh');
    assertEqual(rank(c), 12);
    assertEqual(suit(c), 'h');
    assertEqual(cardName(c), 'Q♥');
  });
  test('move codes round-trip', () => {
    const m = { kind: 'run', from: 3, to: 7, count: 12 };
    const d = decodeMove(encodeMove(m));
    assertEqual(JSON.stringify(d), JSON.stringify(m));
    assertEqual(encodeMove({ kind: 'deal' }), 2);
    assertEqual(encodeMove({ kind: 'devil' }), 3);
  });
  test('seeds', () => {
    assert(validSeed(1) && validSeed(2 ** 53 - 1));
    assert(!validSeed(0) && !validSeed(1.5) && !validSeed(-3));
  });
});

describe('Deal from seed', () => {
  test('seed 1 lays out as in the analysis code', () => {
    core.newGame(1, false);
    const pos = core.position();
    pos.piles.forEach((p, i) => {
      assertEqual(p.cards.map(cardName).join(' '), SEED1_PILES[i].split(' ').map((s) => cardName(parse(s))).join(' '), `pile ${i + 1}`);
      assertEqual(p.down, p.cards.length - 1, `pile ${i + 1} face down`);
    });
    const lay = core.layout();
    assertEqual(lay.devil.map(cardName).join(' '), 'J♣ 5♦ A♠ Q♥ 9♥ K♣');
    assertEqual(lay.stock.length, 68);
    assertEqual(cardName(lay.stock[0]), '10♣');
  });
  test('large seeds split into two halves', () => {
    core.newGame(2 ** 40 + 5, false);
    const a = core.layout();
    core.newGame(5, false);
    const b = core.layout();
    assert(a.stock.join() !== b.stock.join());
  });
  test('open natural starts with every card face up', () => {
    core.newGame(1, true);
    assert(core.position().piles.every((p) => p.down === 0));
  });
});

describe('Take-back costs', () => {
  test('turning a card over costs 1, a deal costs its cards, reversible moves are free', () => {
    core.newGame(1, false);
    // 3c (pile 7) onto 4h (pile 4) turns 2s over.
    assertEqual(core.play(encodeMove({ kind: 'run', from: 6, to: 3, count: 1 })), 1);
    assertEqual(core.play(2), 10);
    assertEqual(core.undoCost(), 10);
    assertEqual(core.undo(), 10);
    assertEqual(core.undo(), 1);
    assertEqual(core.undo(), -1);
  });
  test('illegal moves are refused', () => {
    core.newGame(1, false);
    assertEqual(core.play(encodeMove({ kind: 'run', from: 0, to: 1, count: 1 })), -1);
    assertEqual(core.play(3), -1); // Jc cannot go up yet
  });
});

describe('Selection targets', () => {
  test('3c can go onto 4h', () => {
    core.newGame(1, false);
    const pos = core.position();
    assert(canPick(pos, 6, 3));
    assert(!canPick(pos, 6, 2), 'face-down card');
    const t = targetsFor({ pile: 6, index: 3 }, core.legalMoves(), pos);
    assert(t.piles.has(3));
    assertEqual(t.found, null);
  });
  test('foundation slot for a card', () => {
    core.newGame(1, false);
    const pos = core.position();
    assertEqual(slotFor(pos, parse('As')), 6);
    assertEqual(slotFor(pos, parse('2s')), -1);
  });
});

describe('Stock projection', () => {
  test('ten per deal with no King-headed piles', () => {
    core.newGame(1, false);
    const l = landing(core.position(), core.layout());
    assertEqual(l.length, 68);
    assertEqual(l[9].row, 0);
    assertEqual(l[10].row, 1);
    assertEqual(l[67].row, 6);
    assertEqual(l[67].col, 7);
  });
  test('King-headed piles are skipped', () => {
    const pos = core.position();
    const p2 = { ...pos, piles: pos.piles.map((p, i) => ({ ...p, kingHeaded: i === 0 || i === 4 })) };
    const l = landing(p2, core.layout());
    assertEqual(l[0].col, 1);
    assert(l.every((x) => x.col !== 0 && x.col !== 4));
    assertEqual(l[l.length - 1].row, 8); // 68 cards over 8 piles: 9 deals
  });
});

describe('Records', () => {
  test('replay rebuilds the position, with a switch to natural', () => {
    core.newGame(1, false);
    let rec = newRecord({ seed: 1, variant: 'closed', now: 0 });
    const m1 = encodeMove({ kind: 'run', from: 6, to: 3, count: 1 });
    core.play(m1); rec = withMove(rec, m1);
    rec = withSwitch(rec, 'natural'); core.switchNatural();
    core.play(2); rec = withMove(rec, 2);
    const want = JSON.stringify(core.position());
    replay(core, rec);
    assertEqual(JSON.stringify(core.position()), want);
    // Take both moves back: the switch stays.
    rec = withUndo(withUndo(rec, core.undo()), core.undo());
    assertEqual(rec.switchAt, 0);
    assertEqual(rec.used, 11);
    const before = JSON.stringify(core.position());
    replay(core, rec);
    assertEqual(JSON.stringify(core.position()), before);
    assert(core.position().piles.every((p) => p.down === 0));
  });
});

describe('Solver', () => {
  test('seed 1 is winnable, with a line of legal-looking moves', () => {
    // That the line wins with the Devil's Six played by hand is tested in
    // the Rust crate (wasm/src/lib.rs), which can follow the solver's
    // automatic plays.
    const { result, line } = solver.solve(1, false, 1_000_000, 5000);
    assertEqual(result, 'winnable');
    assert(line.length > 50);
    assert(line.every((c) => ['found', 'run', 'deal'].includes(decodeMove(c).kind)));
  });
  test('a Devil\'s Six order loss is proven', () => {
    assertEqual(solver.solve(12, false, 1000, 1).result, 'lost');
  });
});

describe('Layout', () => {
  test('iPhone 16 portrait gives 36-point cards', () => {
    const l = chooseLayout(393, 760, 'auto');
    assert(!l.landscape);
    assertEqual(l.cw, 36);
  });
  test('desktop and phone landscape', () => {
    assert(chooseLayout(1280, 800, 'auto').landscape);
    const phone = chooseLayout(734, 372, 'auto');
    assert(phone.landscape && phone.cw >= 40 && phone.cw <= 50);
  });
  test('long piles squeeze to fit', () => {
    const pile = { cards: Array(30).fill(1), down: 0 };
    const offs = pileOffsets(pile, true, 36, 300);
    assert(offs[29] + 36 * 1.4 <= 300);
  });
});

// ============= Report =============

const total = groups.reduce((a, g) => a + g.passed + g.failed, 0);
const failed = groups.reduce((a, g) => a + g.failed, 0);
const lines = groups.flatMap((g) => [
  `${g.failed ? 'FAIL' : 'ok  '} ${g.name} (${g.passed}/${g.passed + g.failed})`,
  ...g.tests.filter((t) => !t.pass).map((t) => `     - ${t.name}: ${t.error}`),
]);
lines.push(`${total - failed}/${total} passed`);

if (typeof document !== 'undefined') {
  document.getElementById('results').textContent = lines.join('\n');
} else {
  console.log(lines.join('\n'));
  if (failed && typeof process !== 'undefined') process.exitCode = 1;
}
