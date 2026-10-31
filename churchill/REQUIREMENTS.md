# Churchill Solitaire PWA - requirements

Status (2026-10-27): built. Sections 1-14 are implemented except where
noted; section 15 lists later requirements.

## 1. Purpose

Play Churchill Solitaire on an iPhone, any deal by seed number, either
closed (the normal game) or open (every card visible). Seeds name the same
deals as the analysis code in this repo, so a game in the app can be
compared with the computer players' results on that deal. The analysis
code lives in the `churchill` repo (private).

## 2. Platform

- Installable PWA, works offline after first load.
- Target: iPhone 16 and larger (393 x 852 CSS points; about 393 x 760
  usable in standalone mode after the Dynamic Island and home indicator
  safe areas). Must also work in a desktop browser for testing.
- Portrait and landscape (section 6). The layout follows the screen's shape
  (device orientation on a phone, window shape on a desktop); a setting can
  force either one.
- Served at `https://tomsdavis.github.io/churchill/` from the PWA monorepo.

## 3. Architecture

- **Game core in WebAssembly** (`core.wasm`), compiled from the Rust
  engine in the `churchill` repo (`src/card.rs`, `deal.rs`, `game.rs`,
  `proofs.rs`, `solver.rs`), so seeds, legal moves and move kinds are
  identical by construction. The crate `wasm/` there exposes a plain
  C-style API over a shared buffer (no wasm-bindgen); `core.js` wraps it.
  Rebuild with `wasm/build.sh <path to this folder>`.
- **UI in vanilla HTML/CSS/JS**, no build step, following the monorepo's
  conventions. Changing the UI never needs the Rust toolchain.
- The built `.wasm` file is committed to `churchill/` in the monorepo.
  It is rebuilt only when the core changes; the deployed file records the
  churchill commit it was built from.
- Game state lives in the core, which also keeps the take-back history.
  The UI keeps a game record (seed, variant, move list, events); on
  reopening the app it replays the record's move list through the core.
- Service worker: network first (bypassing the HTTP cache), cache only as
  the offline fallback, so the app's files always come from one version.
  If app.js fails to start, the page offers Repair (clears the cached
  files, keeps saved games).
- Files: `index.html`, `style.css`, `app.js` (UI, storage, solver worker),
  `play.js` (pure game-flow helpers), `core.js` (core wrapper, card and
  move helpers, stock projection), `solver-worker.js`, `sw.js`,
  `manifest.json`, icons, `tests.html` / `tests.js`.

## 4. Variants

Chosen when a game starts. A Closed game may be switched to either open
variant at any point; the switch is one-way, is recorded with the move
number at which it happened, and take-backs across it leave the game open.

| Variant | Tableau cards under the top | Movable runs | King-headed pile (skipped by deals) |
|---|---|---|---|
| **Closed** | face down, hidden | face-up runs only | bottom card is a face-up King, nothing face down (RULES.md) |
| **Open, classic** | face down but shown, marked unavailable | face-up runs only | as Closed |
| **Open, natural** | all face up from the start | any run: a card plus everything above it, descending in alternating colours | bottom card is a King and the whole pile is one run |

In both open variants the stock is fully visible (section 7).

*Open, natural* plays as if Churchill had been designed open: there are no
face-down cards and nothing to turn over, and runs count as they land.
Example: a pile dealt K-Q-J-T-9 in alternating colours is King-headed from
the first deal. It needs a small extension to the core (run start and the
King-skip test ignore face-down status). It should be only slightly easier
than Open, classic, since only the 20 cards that start face down differ;
the analysis code can measure the gap.

## 5. Automatic play

Only what the rules require:

- a face-down card left on top of a pile turns over (Closed and Open, classic);
- an Ace on top of a pile goes to the foundations.

The Devil's Six is played by a tap, when the player chooses (only the next
card in order, and only when a foundation accepts it). This needs a core
change: the engine's `settle` plays it automatically today, so the core
gets an option for manual Devil's Six play and a move for it. Playing a
Devil's Six card is irreversible (counts as "other irreversible", section 9).

No optional automatic play in version 1 (the engine's `safe_auto` stays off).

## 6. Layout

### Portrait, top to bottom

Cards are about 37 x 52 points (10 columns across 393 points with small
gutters). A card face shows only a large rank and suit index in its top
left corner, red/black.

1. **Top bar** (about 40 pt): seed, variant, take-back button with counts
   (section 9), menu button.
2. **Foundations** (about 56 pt): 8 slots, two per suit, top card only.
3. **Stock and Devil's Six** (about 56 pt): stock pile with cards left and
   a Deal button on the left; Devil's Six on the right, laid out right to
   left so the next card to play is on the right, cards overlapping.
4. **Tableau**: 10 piles. Face-down cards (Closed) overlap tightly (about
   5 pt each); face-up and open-unavailable cards overlap enough to show
   their index (about 18 pt). A pile that would run past its space
   compresses its spacing.
5. **Stock panel** (open variants only): section 7.

### Landscape

For desktops, and as an option on phones held sideways (iPhone 16: 852 x
393 points, about 734 x 372 usable after the side safe areas).

- A **side column** on the right holds the top bar's controls, the
  foundations as two rows of four, the Devil's Six and the stock.
- The **main area** on the left holds the tableau with the stock panel
  under it, sharing the same 10 columns.
- Cards scale with the space: about 50 points wide on a phone in landscape,
  capped at about 90 on a desktop.
- On a phone in landscape the stock panel shows the next deal and two or
  three later deals and scrolls almost always; that is accepted.

## 7. Stock panel (open variants)

Shows every stock card and where it will land.

- A grid with one column per pile, aligned exactly under the tableau
  columns (same column widths and gaps; a scroll bar must not take width
  from the panel), one row per remaining deal, the next deal at the top.
  A skipped pile keeps its column, left empty.
- The next deal is shown as a row of mini-cards; later deals as compact
  text cells (about 18 pt tall).
- Piles that a deal will skip (King-headed) show an empty, hatched column.
- The projection assumes the current King-headed piles stay as they are.
  It is recalculated after every move; cells whose landing pile changed
  flash briefly.
- **Rows:** 68 cards make 7 rows only when no pile is skipped. With k
  piles skipped there are ceil(68 / (10 - k)) rows: 8 at k = 1, 10 at
  k = 3, 14 at k = 5, up to 34 at k = 8 (8 Kings). So the panel takes the
  space left below the tableau (at least the mini-card row plus two
  compact rows), scrolls vertically when it has more rows than fit, and
  its header shows "deals left: N" and which deals are in view. A drag
  handle or tap on the header collapses it to the header alone.
- The last deal may be partial; its unused columns stay blank.

## 8. Moving cards

- Tap a card to select it and every card above it (it must head a movable
  run). Legal destinations highlight: tableau piles and foundation slots.
  Tap a destination to move. Tap the selection again, or anywhere else, to
  cancel.
- Tap the stock or the Deal button to deal.
- Illegal taps do nothing (a short shake of the card, no message).
- Later option: drag and drop; double-tap to send a card to a foundation.

## 9. Take-back

Unlimited, one move at a time, no redo. One count of take-backs used.
Each move is classified as in `rules::move_kind` (agreed 2026-10-26):

- **Reversible:** a run move that leaves behind a card of the same colour
  and rank as the card it now sits on (or a King-headed run between two
  empty piles), and that triggers no automatic play. Taking it back is
  free.
- **Deals:** taking back a deal of N cards counts N.
- **Turning a card over:** taking back a move that turned face-down cards
  over counts 1 per card.
- **Other irreversible:** foundation plays (including Devil's Six plays)
  and other run moves (including any that trigger an automatic Ace play).
  Counts 1.

The top bar shows the count next to the take-back button, for example
`↶ 15`. The button looks different when the next take-back will be
counted. The count applies in all three variants: in the open variants
nothing is hidden, but the commitment is still taken back. The game record
keeps the cost of each take-back, so the count can be split by kind later.

## 10. Solvability

Whether the deal can be won with every card known (perfect information).
For Closed games this is not whether a player who cannot see the cards
can win it.

- **Rule sets.** Closed and Open, classic play by the same rules, so they
  share one answer. Open, natural has its own answer, and it can go either
  way: more runs can move, but different piles count as King-headed, so
  deals land differently.
- **Solver.** The core's perfect-information solver, compiled to WASM with
  the rest of the core and run in a Web Worker so the game never waits on
  it. It plays the Devil's Six and safe cards automatically and prunes
  run moves: a win found that way is a win with the player's rules too.
  The only losses it proves come from the Devil's Six order check in
  `proofs.rs`, which depends only on the order the Devil's Six must go up,
  so it holds with manual play. The time budget is 30 s; the worker is
  stopped after that and the answer is Unknown.
- **Open natural is only slightly easier.** On seeds 1-2000 with the same
  search budget a win is found for 73.40% of deals under the normal rules
  and 74.95% under open natural rules (69 deals found only with natural
  rules, 38 only with the normal rules; the same 317 proven lost).
- **Answers:** *Winnable* (a winning line was found), *Not winnable*
  (proven), or *Unknown* (time budget used up). On seeds 1-2000 (native
  code, one core) a winning line is found for 73% of deals, half of them
  within 0.05 s, 90% within 1.2 s, 99% within 4.5 s; 15.9% are proven lost
  at once; the rest stay unknown after about 6 s. Larger budgets find wins
  for 78.45% (perfect-information findings). Expect WASM on an iPhone to
  be 1.5 to 3 times slower.
- **Indicator.** After a deal is chosen the top bar shows *Checking*, then
  the answer. A setting chooses: Live, show when known (default), show on
  request, or never.
- **Live** (added 2026-10-30; opt in for every variant). The indicator
  follows the game: after each move it answers for the position on the
  board, with every card known. States: *Checking*, *Winnable* (green),
  *Win not yet found* (amber), *Lost* (red), *Won* (green).
  - Losses are proven three ways (`proofs.rs`, `solver.rs`): the Devil's
    Six order check and the dead-end test (a card that can never reach
    the foundations; added 2026-10-31) at any time, and in the last two
    deals (20 stock cards or fewer) a full search (every move under the
    player's own rules, up to 1,000,000 positions and 100,000 moves deep,
    in the full-budget check, cutting positions the dead-end test proves
    lost). On seeds 1-39 pressing Deal only, Node: red for 37 with the
    stock gone (24 at once), 27 one deal before the end, 13 two deals
    before; slowest 5.7 s, up to 44 MB. Earlier in the game red is rare
    and amber is the usual sign that a move threw the win away. Amber can
    be a false alarm: the search may just not find the win.
  - No search is needed when the move follows the known winning line,
    when it is reversible (take-back cost 0: it can be moved back, so it
    keeps the win), or from a lost position. Answers are cached by
    position, so take-backs answer at once.
  - While the player thinks, the 'check' worker checks the positions after
    the other legal moves (300,000 nodes or 3 s each). A position with no
    win found is checked again with the full budget (30 s) before amber
    shows; until then the indicator shows *Checking*. The full search
    can grow the worker's memory to about 45 MB, which WebAssembly never
    gives back, so the 'check' worker is closed once a full-budget check
    answers and a fresh one (about 1 MB) takes the next job; answers live
    in the page's cache, so nothing is lost. Checking stops while
    the app is hidden, during Solve from here and when the game ends, and
    when Live is switched off.
  - Lines from Hint, Still winnable? and Solve from here feed the cache.
  - Recorded: each change of answer (event `l`), and `live`: whether a win
    was shown, the move after which the shown win was first lost and how
    (`lostAt`, `lostAs`), and take-backs made while no win showed
    (`backs`). The end screen shows the first loss. In the closed game Live
    counts as help (it shows what the hidden cards allow).
  - Core call: `check_current` (as `solve_current` without simplifying).
- **Winnable deals only** (new-game option). Random picks seeds and checks
  each with a short budget (about 3 s) until one is winnable; usually done
  in a second or two. An entered seed is never refused; it just shows its
  answer.
- The answer, and whether the player looked at it before the end, go into
  the game record.


## 11. Starting, saving and ending

- **New game:** enter a seed (positive integer, up to 2^53 - 1) or tap
  Random; choose the variant.
- **Restart** the same seed and variant (counts reset; recorded as a new
  attempt, linked to the earlier ones on that seed).
- **Switch to open** (Closed games only): choose Open, classic or Open,
  natural. Recorded (section 4).
- The game in progress survives closing the app (localStorage: seed,
  variant, move list, counts).
- **Win:** all 104 cards on the foundations.
- **Stuck:** stock empty and no legal moves at all; the game ends as a
  loss. Otherwise the player can **Resign**.
- Every game is recorded per seed, finished or not: variant at the start,
  any switch to open (variant and move number), restarts, result (won,
  stuck, resigned, abandoned), moves, take-back counts, start and end
  dates, and the move list. Version 1 only stores these; showing them is
  a later requirement (section 15, Statistics).

## 12. Help from the solver (added 2026-10-27)

All three ask the core for a winning line from the current position
(`solve_current`, in the 'line' worker, 30 s budget). The solver's line
is expanded into moves the player can make (Devil's Six and foundation
plays explicit) and simplified in the core (`src/simplify.rs` in the
churchill repo: loops cut, shortcuts searched 2 moves ahead, unneeded
moves dropped, foundation plays as early as the line allows; about 2.7%
shorter and 22% fewer reversible moves). Each use is recorded in the game
record (events `h`, `w`, `a`; counts `hints`, `checks`, `assisted`).
The live indicator (section 10) also feeds on these lines.

- **Hint:** highlights the first move of the line (source selected, the
  destination pulsing) and names it in a toast.
- **Still winnable?** Says whether a winning line exists from here.
- **Solve from here:** plays the line out. A bar at the bottom shows the
  move count, Pause/Play, Step (while paused), speed (4, 2, 1 or 0.5 moves
  a second; default 2, also in Settings) and Stop. Stopping hands the game
  back. Once the solver has played, a finished game is recorded as
  *solved*, not won, even if the player finishes it by hand.
- If no line is found: "can't be won" (Devil's Six order proof) or "no
  winning line found within 30 s".
- A move or take-back while the solver is working cancels the request.

## 13. History (added 2026-10-27)

- **Export history** (Settings): the game in progress and every stored
  game as one JSON file, through the share sheet where the device offers
  it (iPhone), otherwise as a download.
- **Clear history**: deletes the stored finished games after a
  confirmation on the page; the game in progress and settings stay.
- Each game takes about 5-10 KB, so browser storage holds several hundred.

## 14. Menu

New game (seed, variant, random, winnable only), This game (Restart,
Resign, Hint, Still winnable?, Solve from here, Switch to open), Settings
(layout, winnable indicator, solver speed), History (export, clear), Rules,
core version.

## 15. Later requirements (all from the menu)

- **Benchmarks** after a game: for seeds 1-2000 and 200001-210000, what
  the rule list, the advice version, the lookahead and rollout players
  did on that deal, and the perfect-information result where known.
  Hidden until the game ends.
- **Replay exported games** in the Rust CLI, so a person's play can be
  compared with the rule list (the export exists; the CLI side does not).
- **Rule-list hints:** the rule list's move, or a lookahead move, as well
  as the solver's.
- **Where it was lost:** the move after which the game could no longer be
  won.
- **Optional automatic play:** safe foundation plays (`safe_auto`).
- **Drag and drop**, double-tap to foundation.
- **Four-colour suits** setting.
- **"No progress possible"** notice when the stock is empty and only
  reversible moves remain.
- **Statistics** across seeds and variants.

## 16. Testing

- Rust unit tests cover the core, including the Open, natural extension.
- JS tests (in-browser `tests.html`, runnable with Deno) cover the WASM
  API and UI state logic: replay of recorded rule-list games from the
  Rust CLI, take-back counts, the stock projection.
- Manual check on an iPhone 16 (or Safari's responsive mode at 393 x 852).

## 17. Decisions (2026-10-27)

- Only Aces play automatically; the Devil's Six is the player's choice.
- Switching Closed to either open variant is allowed and recorded.
- Restarts are recorded.
- One take-back count (deals count N); the per-move cost is kept in the
  record.
- Landscape layout as well as portrait.
- Solvability shown live from a solver in the app (section 10).
- Records are stored from version 1 but not shown in the UI yet.
- Clear history and export; Hint, Still winnable? and Solve from here,
  with solver lines simplified in the core; a solver finish counts as
  solved, not won.

## 18. Visual design (settled 2026-10-31)

Chosen with the user from the mock-up page
https://claude.ai/artifact/TerjoQsm3PrKnqMUnuLW9Y (private; read it with
the Artifact tool's `read` action for exact CSS and SVG). Choices:

| Item | Choice |
|---|---|
| Card face | "Classic": serif index, Source Serif 4 Bold glyph shapes |
| Corners | Upright corners: rank + suit top left; suit + rank the right way up bottom right; no centre pip |
| Court cards | Plain (same as number cards) |
| Card back | Inset: burgundy with a fine lattice inside a thin cream line |
| Suit colours | Two (red and black) |
| Felt | Lit: soft radial gradient plus faint noise |
| Icon | Devil's Six fan: six cards fanned, alternating colours, no text |
| Movement | Cards slide (about 170 ms) |

Findings behind them:
- Suits drawn as text characters vary by font (the heart much heavier than
  the spade, the diamond small; iPhones may show emoji), so suits are
  drawn as SVG shapes.
- Georgia has old-style figures (3, 4, 5, 7, 9 drop below the line), which
  left the bottom-right index touching the edge. Ranks are also drawn as
  SVG shapes, taken once from Source Serif 4 Bold (SIL Open Font License),
  so every device shows the same card and margins can be set exactly.
- The index must stay rank and suit side by side: in a pile only a strip
  about 0.42 card widths deep shows, and a suit stacked under the rank
  would be hidden.
- Mirrored (rotated) corners were rejected: 9 and 6 are confusing upside
  down. Cards are never shown upside down in the app, so upright corners
  lose nothing.
- Measured margins in the mock-up (card width `cw`): top index at left
  0.07, top 0.02 cw; bottom index at right 0.09, bottom 0.04 cw; Q's bottom
  index at bottom 0.09 cw so its tail clears the edge. With drawn glyphs,
  set them from the glyph bounding boxes instead, all four margins equal.
- Court art: emblems (crown, coronet, cap) stayed legible at phone size;
  double-ended portraits did not. Plain was chosen.
- The manifest had no maskable icon, so Android shrinks the icon onto a
  white disc.

### Plan

Each stage is a commit the user reviews on a phone before the next. Each
bumps `CACHE_NAME` in `sw.js` and adds new files to its asset list.
`node churchill/tests.js` passes at every stage. The Rust core and
`core.wasm` do not change.

1. **Drawn suits and ranks.** `glyphs.js`: the four suits and 13 ranks
   (A, 2-10, J, Q, K) as SVG paths; ranks extracted once from Source
   Serif 4 Bold by a script kept outside the deploy (font and licence
   noted in a comment). Used on card faces, the Devil's Six, foundation
   slots and the stock panel's mini cards. Card names in sentences (hints,
   solver lines) keep text suits, followed by U+FE0E so they are not
   drawn as emoji. Tests: every card value has a path; lookups agree with
   `core.js`.
2. **Card faces, backs and felt** (`style.css`, card building in
   `app.js`). Faces as in the table above, warm ivory with a soft shadow,
   corner margins checked on enlarged screenshots. The Devil's Six
   (overlapped sideways, rank above suit) gets the same treatment. Inset
   back on face-down cards and the Deal button. Lit felt with an inline
   noise texture. Screenshots before and after, portrait and landscape.
   Stages 1 and 2 may ship as one deploy.
3. **Icon.** Fan SVG with no text; PNGs rendered with the pre-installed
   Playwright browser and committed: 192, 512, apple-touch 180, and a
   512 maskable version (fan inside the central safe zone, felt to the
   edge), marked `"purpose": "maskable"` in `manifest.json`. The home
   page link uses the new icon.
4. **Sliding moves** (`app.js`). The table is fully re-rendered after each
   move, so: record the on-screen rectangles of the cards about to move,
   re-render, then start each moved card from its old place and slide it
   home (about 170 ms). The move says which cards moved: a run between
   piles, a card to a foundation slot, a Devil's Six card going up, a deal
   (stock to each pile). Automatic plays after a move (Aces) slide as a
   quick second step. Take-back slides in reverse. Off under
   `prefers-reduced-motion` and at 4 moves a second in solver playback.
   Last because it touches move handling; its own commit, easy to revert.
Stages 1 and 2 shipped together on 2026-10-31 (cache v11): `glyphs.js`
holds the paths and places the corner indices from the glyph ink boxes
(margin 0.07 card widths on all four sides; J and Q, which both drop below
the baseline in Source Serif 4, sit higher at the bottom right). Covered
Devil's Six cards hide their bottom corner.
Stage 3 shipped the same day (cache v12): icons built by
`docs/pwa/make_icons.js` in the churchill repo; the maskable icon keeps
every card corner inside the central circle (radius 40%). The home page
link shows `icon.svg`.

5. **Polish.** Menu and take-back buttons drawn as SVG icons. Update this
   section with what shipped, and the analysis repo's `docs/pwa/README.md`.
