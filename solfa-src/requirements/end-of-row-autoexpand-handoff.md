# End-of-row drop + auto-expand — handoff

Source: planning session 2026-05-16. Status: **complete** (implemented 2026-05-16).

## Background

Two related features from `detailed_requirements.md` / CLAUDE.md "What Is Not Yet Built":

- **End-of-row drop target** — the `{ kind: 'end-of-row'; row: number }` type already exists in `src/lib/types/grid.ts` and `drop-handler.ts` already has a handler for it (inserts at `row+1, col 0`). But `resolveDropTarget` in `droppable.ts` never emits it — there is no DOM element to hit-test. Dragging past the last cell in a row currently resolves to `outside`.
- **Auto-expand grid** — `insertAndShift` in `grid-operations.ts` already appends a new row when the grid is full. What is missing: a MAX_ROWS ceiling, and no trim of trailing empty rows after deletions.

These are bundled because the end-of-row zone on the last row is the primary trigger for auto-expand. Trim is the complementary cleanup direction.

---

## Plan

### Step 1 — MAX_ROWS guard + `trimTrailingEmptyRows` (`src/lib/utils/grid-operations.ts`)

In `insertAndShift`, before the row-append branch, add:
```ts
if (cells.length / columns >= MAX_ROWS) return cells;
```
Import `MAX_ROWS` from `$lib/constants`.

Add new pure export:
```ts
export function trimTrailingEmptyRows(
  cells: GridCell[], columns: number, minRows: number
): GridCell[] {
  let rows = cells.length / columns;
  while (rows > minRows && cells.slice((rows - 1) * columns).every(c => c === null)) {
    rows--;
  }
  return cells.slice(0, rows * columns);
}
```

Tests to add in `src/tests/lib/utils/grid-operations.test.ts`:
- MAX_ROWS guard: inserting into a MAX_ROWS-full grid returns unchanged cells
- `trimTrailingEmptyRows`: removes empty trailing rows; never goes below `minRows`; leaves rows that contain notes; multiple trailing empty rows all removed; grid already at minRows unchanged

### Step 2 — `trimTrailingRows` method (`src/lib/stores/grid-state.svelte.ts`)

```ts
trimTrailingRows(minRows: number = DEFAULT_ROWS): void {
  this.cells = trimTrailingEmptyRows(this.cells, this.columns, minRows);
}
```

Import `trimTrailingEmptyRows` and `DEFAULT_ROWS`.

Tests to add in `src/tests/lib/stores/grid-state.test.ts`:
- After removing the only note in the last row, `trimTrailingRows` collapses to `minRows`
- Does not collapse below `minRows` when all rows have notes

### Step 3 — End-of-row drop zone element (`src/lib/components/GridRow.svelte`)

After the `{#each cells}` block, add:
```html
<div
  class="eor-zone"
  class:drop-target={isDropTarget}
  data-end-of-row={row}
></div>
```

Add to script:
```ts
import { dragState } from '$lib/stores/drag-state.svelte';
const isDropTarget = $derived(
  dragState.dropTarget?.kind === 'end-of-row' && dragState.dropTarget.row === row
);
```

Style: normally invisible, same height as grid cells, approximately half a cell wide. On `drop-target` class: show a dashed left border or a subtle `+` indicator, consistent with existing cell highlight style (`--highlight` or `--accent` CSS var). The zone must not break the existing row layout.

### Step 4 — Hit-test update (`src/lib/actions/droppable.ts`)

Add (unexported helper):
```ts
function findEndOfRowAtPoint(x: number, y: number): { row: number } | null {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el instanceof HTMLElement && el.dataset.endOfRow !== undefined)
      return { row: parseInt(el.dataset.endOfRow, 10) };
  }
  return null;
}
```

Update `resolveDropTarget`:
```ts
export function resolveDropTarget(x: number, y: number): DropTarget {
  const cell = findCellAtPoint(x, y);
  if (cell) return hitTestCell(cell.element, x, { row: cell.row, col: cell.col });
  const eor = findEndOfRowAtPoint(x, y);
  if (eor) return { kind: 'end-of-row', row: eor.row };
  return { kind: 'outside' };
}
```

No changes to `drop-handler.ts` — the `end-of-row` branch is already correct. Dropping on the last row's zone produces `insertRow = gridState.rows`, which `insertAndShift` handles by appending a new row (now guarded by MAX_ROWS).

### Step 5 — Wire trim into +page.svelte (`src/routes/+page.svelte`)

In the `dropHandlerState.setHandler` callback, call `gridState.trimTrailingRows()` after `handleDrop`:
```ts
dropHandlerState.setHandler((op) => {
  handleDrop(op, gridState, paletteState.refMidi, paletteState.mode, paletteState.pitchSystem, paletteState.paletteOctave);
  gridState.trimTrailingRows();
});
```

Also call `gridState.trimTrailingRows()` in `handleLoad` after restoring `gridState.cells`.

No change needed for `handleNew` / `handleClearConfirm` — `clear()` already resets to the original fixed size.

### Step 6 — Tests for drop-handler (`src/tests/lib/utils/drop-handler.test.ts`)

Add:
- Palette → end-of-row: note placed at (row+1, 0), grid has row+2 rows
- Grid → end-of-row: note moved to (row+1, 0) with insert-and-shift
- End-of-row on last row: verify grid auto-extends (cells.length increases by columns)
- End-of-row on MAX_ROWS grid: verify grid does NOT extend (cells.length unchanged)

---

## Constraints (from CLAUDE.md)

- Deno 2.x — `deno task` not npm. Tasks: `dev`, `build`, `check`, `test`.
- Svelte 5 runes (`$state`, `$derived`, `$props`). No legacy `$:` syntax.
- Do not touch the audio path. The components being edited (GridRow, droppable) don't need audio changes but be aware of the iOS user-gesture invariant.
- Vanilla CSS only. CSS variable theme system in `app.css`.
- No new dependencies.

## Verification gate before reporting done

1. `deno task test` — all existing tests pass, new tests pass.
2. `deno task check` — TypeScript clean.
3. `deno task build` — no build errors.
4. `deno task preview` — manual check:
   - Drag a palette note and hover past the last cell in a row — end-of-row zone becomes visible.
   - Drop it — note appears at start of next row.
   - Drag a palette note onto the end-of-row zone of the last row — grid grows by one row.
   - Fill a MAX_ROWS grid (or set MAX_ROWS to 5 temporarily) — confirm no further expansion.
   - Delete all notes in the last row via drag-outside — last row disappears (trimmed), grid stays at DEFAULT_ROWS minimum.
   - Load a saved composition — trailing empty rows trimmed on load.
   - All existing drag, drop, tap-to-play, save/load, mode toggle behaviour unchanged.

## Opus vs Sonnet

All steps are Sonnet-appropriate. Clear scope, existing patterns throughout, no novel architectural decisions.
