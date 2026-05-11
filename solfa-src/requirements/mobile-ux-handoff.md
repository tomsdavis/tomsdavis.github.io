# Solfa mobile-UX rework — handoff

Source: analysis session 2026-05-11. Status: Stage 1 done (2026-05-11). Stage 2 deferred.

## Background

On mobile, the Solfa app fails ergonomically:

- **Portrait, chromatic palette:** Ti (the last entry) is only just visible; the
  Edit button below it falls off-screen entirely.
- **Landscape, chromatic palette:** only Do–Mi fit in the vertical sidebar.
- **All sizes:** cells are hard-coded at 64px, so the grid neither scales down
  to phones nor up to large desktops.

Root cause: `+page.svelte` lays out a fixed 80px vertical palette sidebar + grid
in a flex row, with `--cell-size: 64px` hard-coded. The Edit button is at the
bottom of the palette scroller, so 12 chromatic entries push it off-screen.

## Plan summary

Three plans were drafted. Stage 1 (Plan A + Plan C-clamp) is the safe Sonnet
hand-off below. Stage 2 (Plan B + Plan C-computed-fit) follows only if stage 1
on a real phone still doesn't fix the pain.

---

## Stage 1 — Sonnet handoff prompt (copy-paste ready)

```
You're implementing two UX fixes in the Solfa music-composition app (a SvelteKit + Svelte 5 + Deno PWA, source in /home/tsd/repos/pwas/solfa-src/, built artifact in /home/tsd/repos/pwas/solfa/).

## Why
On mobile, the "Edit palette" button is hidden below the fold because it lives at the bottom of a vertical scrolling palette sidebar — with 12 chromatic entries, Ti is barely visible and Edit is not. Separately, cell size is hard-coded at 64px so the grid doesn't scale to the viewport. Both issues are visible today on a phone in either orientation.

## Scope
Two changes only. **Do not** add a horizontal-dock palette layout, a viewport-fit JS helper, or any orientation-aware logic — those land in a separate later stage.

### Change 1 — Move "Edit palette" out of the palette, slim the toolbar

- In `src/lib/components/Palette.svelte`:
  - Remove the `showEdit` state, the `<PaletteEditDialog>` mount, the `edit-btn` button, and the `PaletteEditDialog` import.
  - Drop the `onDestructiveChange` prop from `Props` — it moves to the route.
  - The palette is now just `OctaveControl` + entries.

- In `src/lib/components/Toolbar.svelte`:
  - Add an `onEditPalette?: () => void` prop.
  - Add a gear-icon button rendered between Save/Load and ModeToggle, only shown when `onEditPalette` is set. Use inline SVG (no icon font, no dep). `aria-label="Edit palette"`. Match the existing `.toolbar-btn` style except icon-sized (~28px square).
  - Icon-ify the Save/Load and Clear buttons too: inline SVG (a floppy/disk for save, a trash-can for clear), `aria-label="Save and load"` / `aria-label="Clear grid"`. Keep them as buttons in the same flex containers. BasePitchControl and ModeToggle stay text-labelled.
  - The toolbar title "Solfa" can stay as-is; if you find it's still crowding things on a 360px viewport, drop it to 16px font, or hide it under `@media (max-width: 400px)` — your call.

- In `src/routes/+page.svelte`:
  - Lift `showEdit` state up here as `let showEdit = $state(false);`.
  - Mount `<PaletteEditDialog open={showEdit} onClose={() => (showEdit = false)} onDestructiveChange={() => gridState.clear()} />` as a sibling of `<SaveLoadDialog>`.
  - Pass `onEditPalette={() => (showEdit = true)}` to `<Toolbar>`.
  - Remove the `onDestructiveChange={() => gridState.clear()}` prop from `<Palette>` (still cleared via the dialog now).

### Change 2 — Clamp cell + palette-entry size

- In `src/app.css`:
  - Change `--cell-size: 64px;` to `--cell-size: clamp(44px, 8vmin, 64px);`. 44px floor matches Apple HIG minimum touch target — do not go below this.
  - If the palette entry width (currently `56px` in `PaletteEntry.svelte`) starts dwarfing or being dwarfed by the grid cells after the change, also expose it as a CSS variable and clamp it similarly. Specifically, add `--palette-entry-size: clamp(40px, 7vmin, 56px);` to `app.css` and use it in `PaletteEntry.svelte` for `width` and `height`.

- In `src/lib/components/NoteDisplay.svelte`:
  - If the existing font-size is fixed pixels, change it to a `clamp()` that scales with the cell. Aim for legible labels at the 44px floor (probably `clamp(11px, 2.2vmin, 14px)` for the small-variant label). Check that the small/large variants both still read.

## Constraints

- Deno 2.x — use `deno task` not `npm`. Tasks: `dev`, `build`, `check`, `test`.
- Svelte 5 runes (`$state`, `$derived`, `$props`, `$effect`). No legacy `$:` syntax.
- Do not touch the audio path (`audioState`, `engine.ts`, GridCell / PaletteEntry `onPointerDown`). There is a load-bearing iOS-Safari user-gesture invariant — see `solfa-src/CLAUDE.md` "Notes / Gotchas". The components you're editing don't need any audio-related changes, but be aware.
- Vanilla CSS only (no PostCSS plugins). The existing CSS-variable theme system in `app.css` is the only convention.
- No new dependencies.
- Read `solfa-src/CLAUDE.md` first if you haven't — it has the architecture rationale and several gotchas relevant to this surface.

## Tests

- Run `deno task test` after the change — it must still pass (no logic changed; existing 100+ tests should be untouched).
- Run `deno task check` — TypeScript must pass.
- No new tests required. The changes are presentational; existing palette-state and drop-handler tests cover behavior.

## Verification gate before reporting "done"

1. Confirm `deno task check && deno task test` both pass.
2. Build with `deno task build` (writes to `../solfa/`). Confirm no build errors.
3. `deno task preview` to serve the built bundle, open in a desktop browser.
4. Manual desktop check, both modes:
   - Composition: drag a palette entry into the grid, drag a placed note to a new cell — drop highlights still appear correctly.
   - Playback: tap palette entries and grid cells — they sound.
   - Click the gear icon in the toolbar — PaletteEditDialog opens. Make a destructive palette change (switch pitch system, say) — confirm grid clears.
   - Click Save/Load icon — SaveLoadDialog opens.
   - Click Clear icon — grid clears.
5. Resize the browser window down to ~375px wide (iPhone SE width). Confirm toolbar doesn't wrap into two rows, palette doesn't overflow horizontally, all grid cells are visible.
6. Resize to ~1400px wide. Confirm cells don't blow up past 64px (the clamp ceiling).
7. Open Chrome DevTools device emulation, switch to iPhone SE + landscape (667×375). Confirm grid still fits without scrolling. (It may need to scroll vertically because the palette is still a tall sidebar — this is the bug we are NOT fixing in this stage; just confirm nothing got worse.)
8. Stop reporting "done" until 1–7 are all green. If anything in the emulator behaves oddly, say so explicitly rather than glossing it as "looks fine".

## What success looks like

- Toolbar gets 3 icon buttons (gear, save, clear) + BasePitchControl + Mode toggle, fits on a 360px viewport.
- Palette contains only OctaveControl + entries + edit-dialog-free.
- Cell size scales between 44px (small phones) and 64px (default desktop).
- Existing functionality unchanged: drag, drop, tap-to-play, save/load, mode toggle, octave control, pitch system switching, key picker.
- Tests + typecheck + build clean.

Don't drift into orientation-aware layouts or computed viewport fitting — those are deliberately deferred. If the current bug list (Ti hidden in portrait, Do-Mi only visible in landscape) isn't fully fixed by these two changes, that's expected — they're stage 1 of 2.
```

---

## Stage 2 — Deferred notes (Plan B + Plan C-computed-fit)

Pick these up only after stage 1 lands and has been tested on a real phone.
Stage 1 alone may resolve enough of the pain that B becomes optional.

### Plan B — Orientation-aware palette (vertical sidebar ↔ horizontal dock)

**Trigger to do this:** stage 1 ships, and on a real iPhone in landscape the
user still can't see all 12 chromatic entries, or the bottom of the palette is
still being clipped in portrait at small sizes.

**Approach:**

- `+page.svelte`'s `.main-area` becomes a CSS grid with two
  `grid-template-areas` arrangements switched by
  `@media (orientation: portrait) and (max-width: 700px)`:
  - landscape/desktop: `"palette grid" / auto 1fr`
  - portrait small: `"grid" "palette" / 1fr / 1fr auto`
- `Palette.svelte` style flips inside the same media query:
  - `.palette { flex-direction: row; overflow-x: auto; overflow-y: hidden; border-top: 1px solid var(--border); border-right: none; }`
  - `.palette-entries { flex-direction: row; }`
  - `.octave-separator { width: 1px; height: 80%; margin: 0 4px; }`
- `OctaveControl` anchors at the left of the horizontal dock (it already lays
  out flex-row internally; no change needed).
- Stage 1 already moved Edit to the toolbar, so the dock is clean.

**What to verify on real devices:**

1. iPhone in portrait — palette is a horizontal scroll dock pinned to bottom;
   all 12 chromatic entries reachable.
2. iPhone in landscape — palette is back to a vertical sidebar OR (depending on
   media-query thresholds) still a bottom dock. Pick whichever scrolls less.
   Document the choice.
3. iPad in both orientations — should stay vertical sidebar (768px portrait
   > 700px threshold).
4. Rotate mid-drag — drag is allowed to be canceled; just verify no JS crash.
5. iOS safe-area: if the dock is bottom-pinned, add
   `padding-bottom: env(safe-area-inset-bottom)` so it sits above the home
   indicator.
6. Drag-from-dock-onto-grid still works — pointer-event hit-testing in
   `droppable.ts` is direction-agnostic so it should "just work", but confirm
   with a real touch device.

**Gotchas to watch:**

- iOS landing-pad swipe-from-bottom may conflict with drags starting near the
  screen edge. The body already has `touch-action: none` which should suppress
  this inside the app, but verify.
- `overflow-x: auto` on the palette + `touch-action: none` on individual
  entries: scrolling the dock should require touching gaps between entries,
  dragging requires touching an entry itself. Verify both gestures coexist.
- `--cell-size` clamp from stage 1 still applies; the grid will get more
  vertical room in portrait once the palette moves to the bottom and the cells
  will grow accordingly — this is the "B + C clamp" interaction that may make
  C-computed-fit unnecessary.

**Sonnet handoff feasibility:** medium-high. CSS-only switch but lives or dies
on real-device verification. Prompt should explicitly require a phone
screenshot before declaring done, or be run by a person who can test on
hardware.

### Plan C-computed-fit — JS-driven exact viewport fit

**Trigger to do this:** stage 1 + B ship, and there's still a case where the
grid clips or wastes significant space (e.g. iPhone SE landscape still shows a
horizontal scrollbar on the grid).

**Approach:**

- New pure module `src/lib/utils/viewport-fit.ts` exporting:

  ```ts
  function computeCellSize(args: {
    viewportWidth: number;
    viewportHeight: number;
    cols: number;
    rows: number;
    paletteAxis: 'vertical' | 'horizontal';
    paletteThickness: number;  // px sidebar width OR dock height
    toolbarHeight: number;
    cellGap: number;
    gridPadding: number;
    min: number;  // 44px floor
    max: number;  // 64px ceiling
  }): number
  ```

  Compute `availableW`, `availableH` after subtracting palette/toolbar/padding,
  then `cellW = (availableW - (cols-1)*gap) / cols`,
  `cellH = (availableH - (rows-1)*gap) / rows`, return
  `clamp(min, min(cellW, cellH), max)`. Pure, easy to unit-test.

- New test file `src/tests/lib/utils/viewport-fit.test.ts` covering: small
  viewport floors at `min`, large viewport ceilings at `max`, axis-mismatch
  (palette horizontal vs vertical) produces different results, gap math correct
  for 8×4 grid, palette-axis swap halves the constraining dimension correctly.

- In `+page.svelte` (or `+layout.svelte`), an `$effect` that:
  1. Reads `window.innerWidth/innerHeight`, current palette axis (via the same
     media query, queried with `window.matchMedia(...).matches`), and constants.
  2. Calls `computeCellSize(...)`.
  3. Writes `document.documentElement.style.setProperty('--cell-size', px + 'px')`.

- Wire up a single `window.addEventListener('resize', handler)` +
  `orientationchange` listener; debounce to one `requestAnimationFrame`.

- The `--cell-size` clamp from stage 1 stays as a fallback for the brief moment
  before the effect first fires (or for users with JS disabled, though
  SvelteKit SPA mode kinda requires JS).

**Gotchas to watch:**

- iOS Safari's dynamic toolbar changes `window.innerHeight` when it shows/hides.
  The grid will resize a few px every time the user scrolls. Either accept it
  (visually minor) or use `visualViewport` which doesn't include the dynamic
  toolbar.
- `matchMedia` listeners are fine but make sure to clean up in `$effect`'s
  return function.
- The palette thickness in the horizontal-dock case depends on
  `paletteState.entries.length` × `--palette-entry-size`. So the effect should
  also re-run when entries change.

**Sonnet handoff feasibility:** medium. The pure helper is straightforward and
testable; the integration is fiddly and easy to ship "almost right". Prompt
should require unit tests on the helper + a real-phone screenshot
verification.

### Suggested cadence

1. Ship stage 1 (the prompt above). Test on a real iPhone in both orientations.
2. Reassess: is the pain resolved? If yes, stop.
3. If no, ship Plan B. Re-test on real iPhone.
4. Reassess again. If still problems, ship Plan C-computed-fit.
5. Don't pre-commit to all four — stage 1 + clamp may be enough alone.
