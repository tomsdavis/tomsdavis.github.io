# Solfa file-handling rework — handoff

Source: design session 2026-05-11. Status: stage 1 complete, stages 2–5 planned.

## Background

Today's "file handling" is a single combined modal (`SaveLoadDialog.svelte`) talking
to `localStorage` via key prefix `solfa2-save-<name>`. Limitations:

- Flat namespace, no folders.
- No rename / copy / paste / move.
- No dirty indicator — Save Load always feels equivalent.
- No export to filesystem or share.
- Versioned-migration code (v1→v2→v3→v4) carries weight for users who don't exist
  yet — the app has no real users beyond the developer.

This rework adds an OPFS-backed file tree with full management ops, splits Save
from Save-As with a live/dim indicator, adds confirmation dialogs for destructive
operations, and exposes import/export via the File System Access API (desktop)
or Web Share API (mobile). Migration code is stripped.

## Confirmed decisions

1. **Save vs Save-As:** two separate toolbar icons. Disk icon = Save (overwrites
   current file, dimmed when no current file or no unsaved changes). Folder
   icon = Files (opens the file-browser modal, which itself contains Save-As /
   Load / Rename / Delete / Copy / Paste / New / Import / Export).
2. **Existing localStorage saves:** drop entirely. No migration path.
3. **File browser placement:** replace the existing `SaveLoadDialog` modal.
4. **Export / import scope:** single file (current composition) at a time.
   Desktop uses File System Access API; mobile uses Web Share API; both fall
   back to `<a download>` / `<input type="file">`.
5. **Save-As to an existing path:** ConfirmDialog "Overwrite?". No auto-rename.
6. **Clear Grid:** clears `currentPath` along with the grid. The filename no
   longer applies to the new empty composition.
7. **New file:** explicit "New" button inside the file browser. Clears the grid
   and `currentPath`. The trashcan stays in the toolbar for "clear this
   composition without leaving the file context" — except per (6) we DO clear
   the path. (The trashcan and "New" therefore do effectively the same thing;
   New also closes the dialog.)

## File format

Canonical extension: **`.solfa.json`**. The file-browser UI hides this
extension in listings but preserves it on disk. Format version is reset to
**`1`** as part of stage 1. Files whose `version !== 1` are rejected with an
error (no migration).

---

## Stage 1 — Cleanup + ConfirmDialog primitive

**Model: Sonnet.** Pure refactor + one new component. Low risk, ship alone.

### Sonnet handoff prompt

```
You're implementing stage 1 of the Solfa file-handling rework. Source in /home/tsd/repos/pwas/solfa-src/. Read solfa-src/CLAUDE.md and solfa-src/requirements/file-handling-handoff.md before starting.

## Scope (do not exceed)

Three changes only:

1. Strip versioned migration from serialization
2. Add a reusable ConfirmDialog component
3. Wire it to the Clear Grid (trashcan) button

Do NOT touch any OPFS code, dirty-indicator code, file-browser UI, or import/export. Those are later stages.

## Change 1 — Strip migrations

In `src/lib/utils/serialization.ts`:
- Set `const CURRENT_VERSION = 1;`
- Delete `migratePalette` and `migrateGrid` entirely.
- `deserializePalette`, `deserializeGrid`, and `deserializeAppState` should: parse the JSON, check `version === 1` at the top level (and on the nested grid/palette where applicable), and **throw `new Error('Unsupported file version')`** if it doesn't match. No silent fallback. No `?? defaults` for fields that the new format has.
- Delete `saveToLocalStorage` and `loadFromLocalStorage` and the `APP_STATE_STORAGE_KEY` constant — they're dead code (no caller).
- Leave `saveNamed` / `loadNamed` / `listSaves` / `deleteNamed` in place for now. They still hit localStorage. Stage 2 swaps the backend.

In `src/lib/types/serialization.ts`:
- Remove the deprecated `octave?: number` field from `SerializedPalette`.
- Update JSDoc comments to remove references to "v3+ defaults" etc — there's only v1 now.
- Make `pitchSystem`, `paletteOctave`, `diatonicKey` non-optional on `SerializedPalette`. Update call-sites of `serializePalette` and `serializeAppState` to require these (they already pass them).

In `src/tests/lib/utils/serialization.test.ts`:
- Delete every test that exercises migration: anything with `version: 1`/`version: 2`/`version: 3` input, anything mentioning "migrates", anything testing `octave` field.
- Keep round-trip tests, current-version tests, error-on-missing-data tests.
- Add **one** new test: `it('rejects payload with wrong version', () => { ... })` that calls `deserializeAppState` on a `{ version: 0, ... }` blob and expects it to throw.

In `src/routes/+page.svelte`:
- The `handleLoad` function currently does `state.palette.pitchSystem ?? 'relative'` and similar `??`-defaults. Now that fields are required, drop the `??` defaults and assign directly: `paletteState.pitchSystem = state.palette.pitchSystem;` etc.

## Change 2 — ConfirmDialog component

Create `src/lib/components/ConfirmDialog.svelte`:

- Props: `{ open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void; onCancel: () => void; }`
- Defaults: `confirmLabel = 'OK'`, `cancelLabel = 'Cancel'`, `destructive = false`.
- Layout: same overlay/dialog CSS pattern as `SaveLoadDialog.svelte` — copy that styling shape (overlay + dialog + h2 + buttons) so the visual language is consistent. Two buttons in the footer. Confirm button gets a red tint when `destructive === true` (use `#e74c3c` like the existing Del button).
- Clicking outside (overlay) is treated as cancel — same pattern as SaveLoadDialog.
- Keyboard: Escape calls `onCancel`, Enter calls `onConfirm`. Use a `<svelte:window onkeydown={...}>` guarded on `open`.

## Change 3 — Wire trashcan to confirmation

In `src/routes/+page.svelte`:
- Add `let showClearConfirm = $state(false);`
- Pass `onClearGrid={() => (showClearConfirm = true)}` to `<Toolbar>` (replacing the direct `gridState.clear()`).
- Mount `<ConfirmDialog open={showClearConfirm} title="Clear grid?" message="This will remove all notes from the grid. This cannot be undone." confirmLabel="Clear" destructive={true} onConfirm={() => { gridState.clear(); showClearConfirm = false; }} onCancel={() => (showClearConfirm = false)} />` as a sibling of the other dialogs.

No changes needed in `Toolbar.svelte` — it already calls `onClearGrid` on trashcan click.

## Constraints

- Deno tasks only: `dev` / `build` / `check` / `test`. No npm.
- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`). No `$:`.
- No new dependencies.
- Do not touch audio code (`audioState`, `engine.ts`, `pitch.ts`) — load-bearing iOS gesture invariant, see solfa-src/CLAUDE.md "Notes / Gotchas".

## Verification gate

1. `deno task check` clean.
2. `deno task test` clean (the migration tests you deleted should be gone; the new wrong-version test should pass).
3. `deno task build` clean.
4. `deno task preview`, manual check:
   - Save a composition with the existing dialog (still localStorage). Reload page (no autosave, expected). Open Save/Load, Load by name. Composition restores.
   - Click trashcan. Confirm dialog appears. Click Cancel — grid unchanged. Click trashcan again. Click Clear — grid clears.
   - Press Escape on the open ConfirmDialog — closes without clearing.

## Out of scope

Anything OPFS, anything file-browser-tree, anything import/export, anything dirty-indicator. If you find yourself tempted, stop and re-read the scope.
```

---

## Stage 2 — OPFS storage backend

**Model: Sonnet, with the error-handling contract spec written by Opus and
embedded in the prompt below.** The contract is non-negotiable; Sonnet must
implement to it exactly. The UI is unchanged at this stage — the existing
`SaveLoadDialog` keeps working but now reads/writes OPFS instead of
`localStorage`.

### OPFS contract (this is the spec — Sonnet implements verbatim)

```ts
// src/lib/storage/opfs.ts

export type OpfsErrorCode =
  | 'NOT_FOUND'         // path doesn't exist
  | 'ALREADY_EXISTS'    // path exists when caller expected it not to
  | 'TYPE_MISMATCH'     // tried to read a dir as a file, or vice versa
  | 'LOCKED'            // concurrent access blocked (NoModificationAllowedError)
  | 'QUOTA'             // storage quota exceeded
  | 'INVALID_PATH'      // malformed path string (empty segments, no leading slash, etc.)
  | 'UNAVAILABLE'       // OPFS not supported in this environment
  | 'UNKNOWN';          // wrap unrecognised DOMException

export class OpfsError extends Error {
  constructor(public readonly code: OpfsErrorCode, message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'OpfsError';
  }
}

export interface FileNode {
  type: 'file' | 'dir';
  name: string;          // basename — exactly as stored, including extension
  path: string;          // canonical "/a/b/c", leading slash, no trailing slash (root = "/")
  children?: FileNode[]; // only set for dirs; sorted dirs-first then alphabetical
}

// Pure path helpers (export and test these separately — easy unit-test surface)
export function parsePath(path: string): string[];
//   "/a/b/c.json" -> ["a", "b", "c.json"]
//   "/" -> []
//   "" or "a/b" or "/a//b" -> throws INVALID_PATH

export function joinPath(...segments: string[]): string;
//   ("a", "b.json") -> "/a/b.json"
//   no leading-slash on inputs

export function dirname(path: string): string;
//   "/a/b/c.json" -> "/a/b"
//   "/a" -> "/"
//   "/" -> "/"

export function basename(path: string): string;
//   "/a/b/c.json" -> "c.json"
//   "/" -> ""

// API
export async function scanTree(): Promise<FileNode>;
//   Returns the root node with recursive children, sorted (dirs-first, alpha).
//   Throws UNAVAILABLE if OPFS not supported.

export async function readFile(path: string): Promise<string>;
//   Throws NOT_FOUND, TYPE_MISMATCH, INVALID_PATH.

export async function writeFile(path: string, contents: string): Promise<void>;
//   Creates intermediate dirs as needed. Overwrites existing file.
//   Throws TYPE_MISMATCH (if path resolves to a dir), QUOTA, LOCKED, INVALID_PATH.

export async function deleteEntry(path: string, opts?: { recursive?: boolean }): Promise<void>;
//   Throws NOT_FOUND if path missing, TYPE_MISMATCH never (works on both),
//   and a generic DOMException-wrapped UNKNOWN if a dir is non-empty and recursive!==true.
//   Cannot delete root "/" — throws INVALID_PATH.

export async function move(srcPath: string, destPath: string): Promise<void>;
//   Prefer FileSystemFileHandle.move(parent, newName) when available.
//   Fallback: read+write+delete (NOT atomic — document this).
//   Throws NOT_FOUND, ALREADY_EXISTS (caller checks first — see below), TYPE_MISMATCH on cross-type.

export async function copy(srcPath: string, destPath: string): Promise<void>;
//   Read source, write to dest. For dirs: recursive walk.
//   Throws NOT_FOUND, ALREADY_EXISTS (caller checks first), QUOTA.

export async function ensureDir(path: string): Promise<void>;
//   Idempotent. Creates intermediate dirs. Throws TYPE_MISMATCH if path resolves to a file.

export async function exists(path: string): Promise<boolean>;
//   Never throws — returns false on any not-found / type-mismatch / invalid-path case.
//   Does throw UNAVAILABLE if OPFS itself isn't there.
```

**DOMException → OpfsErrorCode mapping:**

| Browser exception | OpfsErrorCode |
|---|---|
| `NotFoundError` | `NOT_FOUND` |
| `TypeMismatchError` | `TYPE_MISMATCH` |
| `NoModificationAllowedError` | `LOCKED` |
| `QuotaExceededError` | `QUOTA` |
| `InvalidStateError` (in writer flows) | `LOCKED` |
| anything else | `UNKNOWN` (preserve original via `cause`) |

**Overwrite semantics:** `writeFile` silently overwrites; `move` and `copy` do
NOT — they throw `ALREADY_EXISTS` if the destination exists. The caller (file-
browser store, stage 3) is responsible for prompting the user via ConfirmDialog
and re-issuing the call after deletion if confirmed.

### Sonnet handoff prompt for stage 2

```
You're implementing stage 2 of the Solfa file-handling rework. Read solfa-src/CLAUDE.md and solfa-src/requirements/file-handling-handoff.md before starting. Stage 1 (cleanup + ConfirmDialog) has already landed.

## Scope

Two changes:

1. Create `src/lib/storage/opfs.ts` exactly to the contract spelled out in stage 2 of the handoff doc.
2. Migrate `saveNamed` / `loadNamed` / `listSaves` / `deleteNamed` in `src/lib/utils/serialization.ts` to use OPFS instead of localStorage.

UI behaviour does NOT change. The existing `SaveLoadDialog` keeps working — it just talks to OPFS now.

Do NOT touch dirty-indicator state, toolbar icon split, file-browser UI, or import/export. Those are later stages.

## Implementation rules

- Implement every function in the contract. Do not add functions outside the contract.
- The pure path helpers (`parsePath`, `joinPath`, `dirname`, `basename`) are the priority for unit tests — create `src/tests/lib/storage/opfs.test.ts` testing those exhaustively. Do NOT try to unit-test the async OPFS calls — they need a browser, and jsdom doesn't have OPFS. Manual verification covers those.
- Every `try { ... } catch (e)` MUST map the caught exception through a `mapDomException(e: unknown): OpfsError` helper. Do not swallow errors. Do not `console.error` and return; throw `OpfsError`.
- For move(): feature-detect `FileSystemFileHandle.prototype.move` and use it when present. Fallback path must read source contents, write to dest, then delete source. Document the non-atomicity in a code comment (one line).
- For copy() of a directory: recursive walk. For copy() of a file: single read+write.
- Encoding: files are UTF-8 JSON strings. Use `new TextEncoder()` / `new TextDecoder()` explicitly — don't rely on Blob defaults.

## saveNamed / loadNamed / listSaves / deleteNamed migration

In `src/lib/utils/serialization.ts`:

- `saveNamed(name, ...stateArgs)` → builds JSON via `serializeAppState`, calls `await writeFile(\`/\${name}.solfa.json\`, json)`. Function must become `async`.
- `loadNamed(name)` → `await readFile`. If readFile throws NOT_FOUND, return `null`. Any other OpfsError propagates. Returns `SerializedAppState | null`. Function becomes `async`.
- `listSaves()` → `await scanTree()`, returns names of files at root with `.solfa.json` extension stripped, sorted. Function becomes `async`.
- `deleteNamed(name)` → `await deleteEntry(\`/\${name}.solfa.json\`)`. Function becomes `async`. Swallow NOT_FOUND; rethrow other OpfsErrors.

Update `SaveLoadDialog.svelte` for the async signatures:
- `$effect(() => { if (open) { listSaves().then(s => saves = s); } })` — listSaves is now async.
- `handleSave`, `handleLoad`, `handleDelete` all become async and `await` accordingly.
- Show no special UI for OpfsErrors at this stage — let them throw to console. Stage 3's file-browser will add proper error surfacing.

## Tests

- `src/tests/lib/storage/opfs.test.ts` — pure path helpers only:
  - parsePath: valid forms, root, empty input throws, double-slash throws, no-leading-slash throws.
  - joinPath: simple, multi-segment, empty list → "/".
  - dirname/basename: root, single-segment, deep.
- Do NOT add new tests for `saveNamed` / `loadNamed` — they're now async OPFS-backed and can't run under vitest+jsdom without a polyfill we're not adding.
- The existing serialization tests (round-trip, wrong-version reject) MUST still pass.

## Verification gate

1. `deno task check` clean.
2. `deno task test` clean.
3. `deno task build` clean.
4. `deno task preview`. Open in Chrome:
   - Save a composition under name "foo" via the existing Save/Load dialog. Open DevTools → Application → Storage → IndexedDB → check NOT used; Application → Storage → Origin Private File System (or `Local Storage` quota panel). Confirm `foo.solfa.json` exists in OPFS root.
   - Reload page. Open Save/Load. "foo" is listed. Load it. Composition restores.
   - Delete "foo" via the dialog. Confirm it's gone from OPFS root.
5. iOS Safari spot-check (optional but recommended): same flow on a real iPhone. OPFS is supported on Safari 15.2+. If it fails, surface the error rather than silently fall back.

## Failure modes to surface (manual test)

- Quota exceeded: hard to simulate; skip.
- Concurrent write (open two tabs of the preview, both save to "foo" simultaneously): one should succeed, the other should throw LOCKED. We don't yet show a UI message — observe the console.

## Out of scope

Dirty indicator. Toolbar split. File browser tree UI. Import/export. New/Rename/Copy/Paste. Any UX polish on the existing dialog. Stop at "the existing dialog still works, but it's OPFS-backed".
```

---

## Stage 3 — File-browser dialog

**Model: Sonnet.** Largest visible change but spec is explicit. Replaces
`SaveLoadDialog` with `FileBrowserDialog`. Adds the full file-system state
store.

### Sonnet handoff prompt for stage 3

```
You're implementing stage 3 of the Solfa file-handling rework. Read solfa-src/CLAUDE.md and solfa-src/requirements/file-handling-handoff.md before starting. Stages 1 and 2 have landed: ConfirmDialog exists, `src/lib/storage/opfs.ts` exists with the documented contract, and `saveNamed`/`loadNamed`/`listSaves`/`deleteNamed` are OPFS-backed.

## Scope

1. New singleton store `src/lib/stores/file-system-state.svelte.ts`.
2. New component `src/lib/components/FileBrowserDialog.svelte`.
3. Update `src/routes/+page.svelte` to mount the new dialog instead of `SaveLoadDialog`. Delete `SaveLoadDialog.svelte` after the swap.

Do NOT yet implement the dirty indicator or the Save vs Save-As toolbar split — those are stage 4. The toolbar's existing "Save/Load" icon button continues to open this new dialog with the same `onSaveLoad` prop wiring (rename the prop to `onOpenFiles` for clarity).

## file-system-state store

```ts
// src/lib/stores/file-system-state.svelte.ts
import * as opfs from '$lib/storage/opfs';
import type { FileNode } from '$lib/storage/opfs';

class FileSystemState {
  tree: FileNode = $state({ type: 'dir', name: '', path: '/', children: [] });
  selectedPath: string | null = $state(null);
  clipboard: { kind: 'copy'; path: string } | null = $state(null);
  // currentPath is added in stage 4. Do NOT add it here yet.

  async refresh(): Promise<void> {
    this.tree = await opfs.scanTree();
  }
}

export const fileSystemState = new FileSystemState();
```

Singleton, module-level constant — matches the existing palette-state / app-state pattern.

## FileBrowserDialog component

Props: `{ open: boolean; onClose: () => void; onLoad: (state: SerializedAppState, path: string) => void; onSaveAs: (path: string) => Promise<void>; onNew: () => void; }`.

(`onSaveAs` returns a Promise so the caller can await the save before closing the dialog.)

Layout (vertical, mobile-friendly):

```
+-----------------------------------+
|  Files                       [X]  |
+-----------------------------------+
|  Save as: [______________] [Save] |
+-----------------------------------+
|  [/]                              |    <- breadcrumb / current folder
|  ├─ 📁 sketches/                  |
|  │   ├─ 🎵 ballad                  |    <- extension hidden in display
|  │   └─ 🎵 etude                   |
|  └─ 🎵 untitled                    |
+-----------------------------------+
|  [Open] [Rename] [Delete]         |    <- action bar, acts on selectedPath
|  [Copy] [Paste] [New Folder]      |
+-----------------------------------+
|  [New]  [Import]  [Export]        |
+-----------------------------------+
```

### Interaction rules

- Tree is rendered as a flat indented list, not a nested tree component (simpler; the dataset is tiny).
- Each file/folder row is clickable to select (sets `fileSystemState.selectedPath`). The selected row highlights.
- Clicking a folder TOGGLES expand/collapse — implement via a `$state` `Set<string>` of expanded paths inside the component.
- Action-bar buttons are disabled when no selection exists, except "Paste" (enabled when `clipboard !== null` and a folder is selected or no selection means root), and "New Folder" (always enabled — creates inside selected folder, or at root).
- "Save as": input + Save button. Validates: non-empty after trim, no `/` characters allowed, must not be exactly `.solfa.json` after trim. On submit, builds path = `<currentFolder>/<name>.solfa.json` where `<currentFolder>` is `dirname(selectedPath)` or `/` if nothing selected. If file exists → ConfirmDialog "Overwrite \"<name>\"?". On confirm: call `onSaveAs(path)`, refresh tree, clear input. On cancel: do nothing.
- "Open": calls `loadNamed`-equivalent (use opfs.readFile directly + `deserializeAppState`) on selected file. On success, call `onLoad(state, path)` and close dialog. On error: show a non-modal error message at the bottom of the dialog. Do NOT close on error.
- "Rename": prompts via an inline text input replacing the selected row name. Submit on Enter / blur. If new path exists → ConfirmDialog. Otherwise `opfs.move(oldPath, newPath)`, refresh.
- "Delete": ConfirmDialog "Delete \"<name>\"?" (destructive=true). For folders include " and all its contents" in the message. On confirm: `opfs.deleteEntry(path, { recursive: true })`, clear selection, refresh.
- "Copy": sets `clipboard = { kind: 'copy', path: selectedPath }`. Visual: clipboard indicator at the top of the action bar showing "📋 \"<name>\" copied — Paste to duplicate".
- "Paste": determines destination folder (= `selectedPath` if it's a folder, else `dirname(selectedPath)`, else `/`). Constructs destination path keeping the source basename. If exists → ConfirmDialog. Otherwise `opfs.copy`. Then refresh. Clipboard is NOT cleared on paste (allows multiple pastes).
- "New Folder": inline text input under the selected folder (or at root). Submit on Enter. Validates same as Save-As name. Calls `opfs.ensureDir(path)`. Refresh.
- "New": prompts via ConfirmDialog if there's anything in the grid: "Start a new composition? Unsaved changes will be lost." On confirm: calls `onNew()` (which clears grid + currentPath in the route) and closes the dialog. If grid is empty, no confirm — just `onNew()` + close. NOTE: at this stage we don't have a dirty indicator, so use "if the grid has any non-null cells" as the proxy for "has unsaved changes". This becomes more accurate in stage 4.
- "Import": `<input type="file" accept=".json,.solfa.json">` hidden, button triggers click. On file selected: read as text, `JSON.parse`, validate `version === 1` (deserializeAppState handles this — it throws if wrong). Prompt for a target name via the Save-As input area (pre-fill with the imported file's stem), then save via `onSaveAs`. On import error: show error at bottom of dialog.
- "Export": only enabled when a file is selected. Reads the file via opfs, builds a Blob, then:
  - If `navigator.canShare && navigator.canShare({ files: [...] })`: call `navigator.share({ files: [new File([blob], name, { type: 'application/json' })] })`. Mobile path.
  - Else if `window.showSaveFilePicker`: call it, suggest the basename, write the blob. Desktop path.
  - Else: trigger an anchor-tag download with `URL.createObjectURL(blob)`. Fallback.
- All async ops show NO global spinner — they're fast on local OPFS. Buttons can be momentarily disabled to prevent double-fires.

### Styling

Match the existing dialog visual language (background, border, button styles). Use existing CSS vars. The dialog must work down to a 360px viewport — make the action bar buttons icon+label rather than icon-only, and let them wrap to two rows on narrow screens.

## +page.svelte changes

```svelte
<script lang="ts">
  // ... existing imports ...
  import FileBrowserDialog from '$lib/components/FileBrowserDialog.svelte';
  // remove SaveLoadDialog import

  let showFiles = $state(false);
  let showClearConfirm = $state(false);  // from stage 1
  let showEdit = $state(false);

  async function handleSaveAs(path: string) {
    // for now, path is the full "/foo.solfa.json". Strip leading slash + .solfa.json for the legacy saveNamed-style API.
    // Or simpler: import writeFile and serializeAppState directly here.
    const json = serializeAppState(...allArgs);
    await writeFile(path, json);
  }

  function handleLoad(state, path) {
    // existing handleLoad body — restore palette/grid fields directly (no ?? defaults, since stage 1 made them required).
  }

  function handleNew() {
    gridState.clear();
    // currentPath clearing comes in stage 4
  }
</script>

<Toolbar
  onOpenFiles={() => (showFiles = true)}
  onClearGrid={() => (showClearConfirm = true)}
  onEditPalette={() => (showEdit = true)}
/>
<!-- main-area unchanged -->
<FileBrowserDialog
  open={showFiles}
  onClose={() => (showFiles = false)}
  onLoad={handleLoad}
  onSaveAs={handleSaveAs}
  onNew={handleNew}
/>
<!-- ConfirmDialog for clear, PaletteEditDialog as before -->
```

Then delete `src/lib/components/SaveLoadDialog.svelte`. Rename Toolbar's `onSaveLoad` prop to `onOpenFiles` and update the `aria-label` to "Open files".

## Tests

- Add `src/tests/lib/stores/file-system-state.test.ts` — minimal, mostly verifying the clipboard state transitions (set on copy, preserved on paste).
- Manual UI verification is the main bar here.

## Verification gate

1. `deno task check` and `deno task test` both clean.
2. `deno task preview`. Manual sweep:
   - Create folder "sketches" via New Folder.
   - Save current composition as "ballad" inside sketches via Save-As.
   - Save another as "etude" inside sketches.
   - Save one as "untitled" at root.
   - Verify tree shows: sketches/ (collapsible) → ballad, etude; untitled at root.
   - Rename "ballad" → "ballad-v2". Tree updates.
   - Copy "ballad-v2", paste at root. Tree shows ballad-v2 at root.
   - Delete sketches/etude — confirm dialog, then gone.
   - Delete sketches/ folder — confirm dialog with "and all its contents", then gone.
   - Open "untitled" — loads, dialog closes.
   - Click New on a populated grid — confirm dialog. Confirm — grid clears. Dialog closes.
   - Click Import, pick the previously-exported file (or any solfa JSON) — saves into current folder. Tree updates.
   - Click Export with "untitled" selected — depending on platform, save picker / share sheet / download fires.
3. 360px viewport: tree is scrollable, action bar wraps cleanly, dialog doesn't overflow.

## Out of scope

Dirty state plumbing, the Save (overwrite-current-file) toolbar icon, currentPath tracking. All stage 4.
```

---

## Stage 4 — Dirty state + Save vs Save-As icon split

**Model: Opus.** This is the only stage with non-trivial reactive-graph
reasoning. The other stages are spec-followers; this one has design judgement
to make about how the dirty derivation is structured.

### Why not Sonnet

Two failure modes Sonnet tends to fall into here:

1. **`$derived` capturing the wrong state.** Going through two singleton stores
   (`gridState`, `paletteState`) plus the local `fileSystemState.lastSavedJson`,
   plus calling a non-trivial serializer, is the kind of reactive boundary
   where Sonnet has shipped quietly-stale derivations before. Needs Opus to
   pick the shape and verify one concrete derivation reads correctly under
   Svelte 5 semantics.
2. **Mutation paths.** Every place state changes — drop handler, palette edit
   dialog destructive change, OctaveControl, BasePitchControl, mode toggle —
   must contribute to the dirty fingerprint. A `$derived` that recomputes
   `serializeAppState(...)` reads every reactive field once and so naturally
   covers them all. A manual `setDirty(true)` approach is a list of "did we
   remember to call this everywhere" — error-prone and Sonnet drops calls.

### Design

Add to `file-system-state.svelte.ts`:

```ts
class FileSystemState {
  // ... stage 3 fields ...
  currentPath: string | null = $state(null);
  lastSavedJson: string = $state('');

  markSaved(json: string, path: string | null): void {
    this.lastSavedJson = json;
    this.currentPath = path;
  }

  clearCurrent(): void {
    this.currentPath = null;
    this.lastSavedJson = '';
  }
}
```

The dirty derivation lives in `+page.svelte` because that's where it has access
to both stores and the serializer:

```svelte
<script lang="ts">
  // ... existing imports ...
  import { fileSystemState } from '$lib/stores/file-system-state.svelte';
  import { serializeAppState } from '$lib/utils/serialization';

  const currentJson = $derived(serializeAppState(
    gridState.cells,
    gridState.columns,
    paletteState.entries,
    paletteState.mode,
    paletteState.refMidi,
    paletteState.pitchSystem,
    paletteState.paletteOctave,
    paletteState.diatonicKey
  ));

  const isDirty = $derived(
    fileSystemState.currentPath !== null &&
    currentJson !== fileSystemState.lastSavedJson
  );

  const canSave = $derived(isDirty);  // alias for clarity in Toolbar prop

  // ... rest
</script>
```

**Save behaviour:**

- `handleSave` (new): `await writeFile(fileSystemState.currentPath!, currentJson); fileSystemState.markSaved(currentJson, fileSystemState.currentPath);`
- `handleSaveAs` (existing from stage 3): after write success, call
  `fileSystemState.markSaved(json, path)`.
- `handleLoad`: after restore, call `fileSystemState.markSaved(loadedJson, path)`.
- `handleNew`: `gridState.clear(); fileSystemState.clearCurrent();`
- `handleClearGrid` (from the trashcan): same as `handleNew` per decision 6.

**Toolbar icon split:**

Toolbar gains a new `Save` icon button (disk) before the existing folder icon:

```svelte
{#if onSave}
  <button class="toolbar-btn icon-btn" class:dim={!canSave} onclick={onSave} aria-label="Save" disabled={!canSave}>
    <!-- inline SVG disk icon -->
  </button>
{/if}
```

The "Files" icon (the renamed Save/Load button from stage 3) stays. The Save
icon's `.dim` class is purely visual (50% opacity) — `disabled` is the
authoritative state.

`+page.svelte` passes `onSave={handleSave}` and `canSave={canSave}` down to
Toolbar.

### Risk: serialize-on-every-keystroke

Calling `serializeAppState` from a `$derived` means we re-serialize whenever
any reactive input changes. For Solfa's composition state, that's:

- A small grid (8×4 default → 32 cells).
- A palette (≤ 13 entries).
- A handful of scalar settings.

Serialized size is on the order of a few KB. `JSON.stringify` of a few KB
runs in microseconds. There is no meaningful perf concern. Confirm this with
a quick `performance.now()` measurement during stage 4 verification — if it
ever exceeds 1ms even on the slowest mobile target, fall back to the manual-
fingerprint approach. I don't expect this.

### Verification gate (manual, Opus session)

1. Load a saved file. Save icon is dim.
2. Drop a note. Save icon lights up.
3. Click Save. Icon goes dim again. Reopen file from elsewhere — change is
   persisted.
4. Change palette key. Save icon lights up.
5. Save-As to a new name. Save icon dims. `currentPath` updated (verify via
   "Save" overwriting the new file).
6. Clear grid. Save icon goes dim AND `currentPath` is cleared (Save button
   is disabled because no `currentPath`, not just because clean).
7. Click "New" inside file browser. Same as clear from Save-icon perspective.
8. Performance probe: in DevTools console, paste:
   ```js
   const t = performance.now();
   for (let i = 0; i < 1000; i++) { /* trigger a state change */ }
   console.log((performance.now() - t) / 1000, 'ms/edit avg');
   ```
   Should be well under 1ms. (Manual UI churn is fine if console approach is fiddly.)

### Out of scope

Anything not in the above. No export, no import — those are stage 5. No new
file ops in the browser — stage 3 covers them.

---

## Stage 5 — Export / Import (single file)

**Model: Sonnet.** This was partly built in stage 3 inside FileBrowserDialog
(Import + Export buttons). Stage 5 is where you fully test the feature-
detection chain on real devices.

If stage 3 was thorough, stage 5 may be just a verification pass + a couple of
polish fixes (e.g. correct MIME, correct `accept` attribute, error message
when share fails).

### Sonnet handoff prompt for stage 5

```
Stage 5 of the Solfa file-handling rework: real-device verification and polish of the Import/Export buttons inside FileBrowserDialog. Read solfa-src/CLAUDE.md and solfa-src/requirements/file-handling-handoff.md.

Stages 1-4 have landed. Import and Export are wired in FileBrowserDialog already.

## Tasks

1. Verify the feature-detection chain in `FileBrowserDialog.svelte`'s `handleExport` is correct:
   - `navigator.canShare && navigator.canShare({ files: [file] })` → Web Share path
   - else `'showSaveFilePicker' in window` → File System Access Picker path
   - else → anchor-tag `download` fallback
   
   On desktop Chrome, both share and showSaveFilePicker may be available; we prefer File System Access because it doesn't go through the OS share sheet. Adjust ordering accordingly: try FSA first on desktop, share-API first on mobile. Detect via `navigator.userAgentData.mobile` (or fallback `/Mobi|Android|iPhone/.test(navigator.userAgent)`).

2. Verify the Import flow correctly rejects malformed files: a random JSON throws inside `deserializeAppState` (we added `version === 1` validation in stage 1). Surface this as a friendly error inline in the dialog, not a console-only message.

3. Manual real-device testing:
   - macOS Chrome: Export "untitled" → FSA save picker → save to ~/Downloads. Verify file is valid JSON, version 1.
   - macOS Safari: Export "untitled" → falls back to anchor download (Safari doesn't have FSA).
   - iPhone Safari: Export "untitled" → iOS share sheet appears with the file. Save to Files / send to a chat. Re-import works.
   - Android Chrome: Export "untitled" → share sheet. Re-import works.
   - All platforms: Import a `.solfa.json` from disk → save to OPFS → load → composition restores.
   - All platforms: Import a malformed file (any non-Solfa JSON) → inline error.

4. Update the `accept` attribute on the import input: `.solfa.json,application/json` — some platforms ignore double extensions; both should be listed.

## Verification gate

Stop reporting done until every row of section 3 is green. Document any platform-specific quirks you find (especially around iOS share sheet behaviour) inline in the dialog component with a one-line comment.

## Out of scope

Workspace export (zip), Web Share Target receiver (PWA-side inbound share). Both deliberately deferred.
```

---

## Wrap-up

| Stage | Model | Risk | What it ships |
|---|---|---|---|
| 1 | Sonnet | Low | Migration code stripped, ConfirmDialog, trashcan confirm | ✅ complete 2026-05-11 |
| 2 | Sonnet (with Opus contract) | Medium | OPFS wrapper, existing UI on OPFS | ✅ complete 2026-05-11 |
| 3 | Sonnet | Medium | FileBrowserDialog replaces SaveLoadDialog | ✅ complete 2026-05-11 |
| 4 | Opus | High | Dirty indicator, Save/Save-As split | ✅ complete 2026-05-11
| 5 | Sonnet | Low | Real-device verification of import/export |

Sonnet handoff workflow per stage: `/clear`, `/model claude-sonnet-4-6`, then
"Read `solfa-src/requirements/file-handling-handoff.md` stage N and implement
it." For stage 4: `/clear`, `/model claude-opus-4-7`, same prompt with N=4.
