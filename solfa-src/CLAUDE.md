# Solfa2 — CLAUDE.md

## What This Is

A browser-based music composition and playback app. Users drag notes from a palette onto a grid in **Composition mode**, then tap cells to play them in **Playback mode**. No inherent rhythm — user supplies timing by touch/click.

See `app_requirements.md` and `detailed_requirements.md` for full specs.

## Stack

- **Deno 2.6.10** as runtime (use `deno task`, not `npm`)
- **SvelteKit** + **Svelte 5 runes** (`$state`, `$derived`, `$effect`, `$props`)
- **TypeScript** throughout
- **Web Audio API** for sound; **Pointer Events API** for drag/touch
- **Vitest** for tests; **adapter-static** for SPA/PWA mode

### Key Deno tasks

```
deno task dev          # dev server
deno task build        # production build
deno task preview      # preview build
deno task check        # svelte-check + tsc
deno task test         # vitest run
deno task test:watch   # vitest watch
```

## Source Structure

```
src/
  app.css                          # CSS variables (colours, layout, theme)
  lib/
    actions/
      draggable.ts                 # Svelte action — drag source via Pointer Events
      droppable.ts                 # Hit-test helpers (findCellAtPoint, resolveDropTarget)
    audio/
      engine.ts                    # AudioEngine class (init, playNote, playNoteByMidi, stopNote, stopAll)
      pitch.ts                     # pitchToMidi, midiToHz, hzToMidi, resolvePlaybackMidi
      voice.ts                     # createVoice, stopVoice
    components/
      DragGhost.svelte             # Fixed-position ghost following pointer during drag
      Grid.svelte                  # Renders GridRow list; scrollable container
      GridCell.svelte              # Single cell; handles playback touch + drag source
      GridRow.svelte               # Row of GridCells
      ModeToggle.svelte            # Composition ↔ Playback button
      BasePitchControl.svelte      # Toolbar popover: octave/key/Hz (relative mode only)
      NoteDisplay.svelte           # Coloured pill with label; playing state = glow
      OctaveControl.svelte         # − / octave / + buttons (palette sidebar, both modes)
      Palette.svelte               # Sidebar; PaletteEntry list + OctaveControl (always shown)
      PaletteEntry.svelte          # Draggable palette note
      SaveLoadDialog.svelte        # Modal: named save/load/delete via localStorage
      Toolbar.svelte               # App bar: title, BasePitchControl, Save/Load, ModeToggle
      UpdateToast.svelte           # PWA "new version available" toast (bottom-centre)
    constants.ts                   # DEFAULT_COLUMNS=8, DEFAULT_ROWS=4, C0_MIDI, A4_MIDI, MIN/MAX_PALETTE_OCTAVE_RELATIVE, etc.
    stores/
      app-state.svelte.ts          # appState — mode: 'composition' | 'playback'
      audio-state.svelte.ts        # audioState — wraps AudioEngine, tracks playingVoices, playNoteByMidi
      drag-state.svelte.ts         # dragState — current DragOperation (source, x, y, dropTarget, voiceId)
      drop-handler-state.ts        # dropHandlerState — singleton callback set from +page.svelte
      grid-state.svelte.ts         # GridState class — flat GridCell[] array, row/col helpers
      palette-state.svelte.ts      # paletteState — pitchSystem, mode, refMidi, paletteOctave, diatonicKey, entries[], CRUD, setPitchSystem, setDiatonicKey
      sw-update-state.svelte.ts    # swUpdateState — tracks SW updateAvailable; init() registers listeners, applyUpdate() posts SKIP_WAITING
      index.ts                     # re-exports
    types/
      app.ts                       # AppMode
      audio.ts                     # SampleEntry, AudioVoice
      grid.ts                      # GridCell, GridPosition, DropTarget
      note.ts                      # Note (with midiNote, baseMidiOffset?), PitchSpecification
      palette.ts                   # PaletteEntry, PaletteMode, PitchSystem
      serialization.ts             # SerializedGrid, SerializedPalette, SerializedAppState
    utils/
      colors.ts                    # noteColor(semitone) → CSS var
      drop-handler.ts              # handleDrop(op, gridState, refMidi, mode, pitchSystem, paletteOctave) — central drop logic
      grid-operations.ts           # Pure functions: insertAndShift, moveNote, moveWithInsert
      note-names.ts                # chromaticName, chromaticSolfegeName, gridLabel, subscriptDigit, majorScaleNoteNames, majorScaleSemitones, keyRootSemitone, ALL_KEY_NAMES
      serialization.ts             # serialize/deserialize + localStorage helpers
  routes/
    +layout.svelte / +layout.ts    # SvelteKit layout (SPA); inits swUpdateState, renders UpdateToast
    +page.svelte                   # App root: wires GridState, dropHandler, save/load
  service-worker.ts                # PWA service worker — precaches build+files+prerendered, cache-first fetch, SKIP_WAITING handler
  tests/
    lib/audio/pitch.test.ts
    lib/stores/grid-state.test.ts
    lib/stores/palette-state.test.ts
    lib/utils/{colors,drop-handler,grid-operations,note-names,serialization}.test.ts
```

## Key Architecture Decisions

### Drag & Drop
- **No pointer capture** — breaks `elementsFromPoint`. Use document-level `pointermove`/`pointerup` listeners instead.
- `draggable.ts` action attaches to drag sources (palette entries, grid cells). On pointerdown it calls `dragState.startDrag`, adds document listeners, starts audio preview.
- `droppable.ts` provides hit-test functions only (no Svelte action). `resolveDropTarget(x, y)` uses `elementsFromPoint` + `data-row`/`data-col` attributes on `.grid-cell` divs.
- Drop zone: left 20% of cell = insert-before, right 20% = insert-after, middle 60% = replace. Threshold is `DROP_ZONE_EDGE = 0.2` in constants.
- `dropHandlerState` is a singleton callback registered directly in `+page.svelte`'s script block (not `onMount`); avoids prop-drilling the handler.

### Grid State
- Flat `GridCell[]` array, row-major order. `GridCell = Note | null`.
- `GridState` is a plain class with `cells: GridCell[] = $state([])`. Instantiated in `+page.svelte`, passed as prop to `Grid`.
- Grid operations (`insertAndShift`, `moveNote`, `moveWithInsert`) are pure functions in `grid-operations.ts` that return new arrays.

### Audio
- **All sound is synthesised** — no samples. `AudioEngine.init()` creates a `PeriodicWave` once; `createVoice` instantiates an `OscillatorNode` per note.
- Signal chain: `OscillatorNode → per-voice GainNode → master GainNode → destination`.
- Organ-like waveform: `real = [0, 1, 0.6, 0.3, 0.2, 0.15, 0.08]` (DC + 6 harmonics), `imag` all zeros. Adjust these in `engine.ts` `init()` to change timbre — more harmonics = brighter, fewer/quieter = flute-like.
- Pitch set via `oscillator.frequency.value = midiToHz(midiNote)` — exact, no pitch-shifting artefacts.
- Two play methods: `playNote(pitch, refMidi)` resolves pitch then delegates to `playNoteByMidi(midi)`. Grid cells use `resolvePlaybackMidi(note, refMidi)` then `playNoteByMidi` — this enables live transposition of relative-mode notes via the toolbar base pitch.
- Envelope: 10ms linear attack on start (`linearRampToValueAtTime`); 60ms exponential decay on stop (`setTargetAtTime` with τ=0.02), oscillator `stop()` scheduled 100ms out, nodes disconnected in `onended` callback.
- `AudioEngine.init()` must be called from a user gesture. `audioState.ensureReady()` handles lazy init + resume. Init is now near-instant (no sample loading).
- `AudioState` wraps `AudioEngine` and tracks `playingVoices` as reactive `$state`.

### Stores
All stores are singleton class instances exported as module-level constants (Svelte 5 pattern). State fields use `$state()` directly on class properties.

### Pitch System
- **Two pitch systems**: `absolute` (C4, D4 — fixed) and `relative` (Do, Re — transposable via refMidi). Stored as `PitchSystem` type in `palette.ts`.
- **Palette octave vs toolbar base pitch** (CR4): two independent controls:
  - `paletteOctave` (on `PaletteState`): which octave palette entries resolve to when dragged. Shown in palette sidebar always. Relative: offset -4..+4 (default 0). Absolute: octave 0..8 (default 4).
  - `refMidi` (toolbar base pitch, relative mode only): root for playback transposition. Changing it transposes all placed relative-mode notes in real time.
  - `effectiveRefMidiForPalette`: relative = `refMidi + paletteOctave * 12`, absolute = `C0_MIDI + paletteOctave * 12`. Used for palette audio preview and drop resolution.
- **Note placement**: Relative-mode notes store `baseMidiOffset = pitchToMidi(pitch, paletteOctave * 12)` — a ref-independent offset. Playback MIDI = `baseMidiOffset + refMidi`. Absolute-mode notes store only `midiNote` (fixed).
- `resolvePlaybackMidi(note, refMidi)`: if `baseMidiOffset` is set, returns `baseMidiOffset + refMidi`; otherwise returns `note.midiNote`. Used by GridCell playback and drag preview.
- `gridLabel(pitch, midiNote, mode, baseName, pitchSystem, baseMidiOffset?)` generates display labels with octave subscripts: `"Do₀"`, `"Do₁"`, `"C4"`, `"204¢₁"`, `"585‰₋₁"`. In relative mode, octave is derived from `baseMidiOffset` (not `midiNote`). In absolute diatonic mode, uses `baseName` to preserve enharmonic spelling (e.g. "Bb4" not "A#4").
- `chromaticSolfegeName()`: full 12-note chromatic solfege: Do/Ku/Re/Na/Mi/Fa/Ci/So/Pe/La/Vu/Ti.
- `handleDrop(op, gridState, refMidi, paletteMode, pitchSystem, paletteOctave)` — computes `baseMidiOffset` + `midiNote` + `gridLabel` when creating notes from palette drops.
- **Absolute mode**: `refMidi = C0_MIDI`, OctaveControl in palette sidebar browses absolute octaves, microtonal mode unavailable. Diatonic mode supports key selection via `diatonicKey` (default 'C').
- **Absolute diatonic mode** (CR8): `createAbsoluteDiatonicEntries(keyName)` generates 13 entries with correct enharmonic note names. Uses `keyRootSemitone + MAJOR_INTERVALS` for monotonically ascending semitone values (handles scale wrapping past C correctly). Key selector UI in `PaletteEditDialog` (piano-keyboard layout). Changing key is non-destructive (no grid clear).
- **Relative mode**: `refMidi` defaults to C4 (60), `BasePitchControl` popover in toolbar for octave/key/Hz. OctaveControl in palette sidebar browses relative octave offsets.

### PWA / Service Worker
- `src/service-worker.ts` is auto-registered by SvelteKit at build time. Cache key is `solfa2-cache-${version}` (version hash from `$service-worker` rotates per build, so old caches get purged on activate).
- Precaches `[...build, ...files, ...prerendered]` on install. Strategy is cache-first; navigation requests fall back to the cached `/` (SPA shell). Cross-origin and non-GET requests pass through.
- Skip-waiting + `clients.claim()` on activate so a new SW takes over immediately. Paired with `UpdateToast.svelte`: when a new SW reaches `installed` while a controller exists, `swUpdateState.updateAvailable` flips to true, the user sees a "Reload" pill, and clicking it posts `SKIP_WAITING` → `controllerchange` triggers `location.reload()`.
- `static/manifest.webmanifest` declares the PWA (name, icons, `display: standalone`, theme/bg colours pinned to `#1a1a2e`). **Keep manifest `theme_color` / `background_color` in sync with `--bg` in `app.css` if the theme changes** — the OS shell parses the manifest before any CSS loads.
- Icons in `static/`: `favicon.png` (32), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (keep glyph in 80% safe zone for adaptive crops), `apple-touch-icon.png` (180; iOS ignores manifest icons).
- **The SW does not run under `deno task dev`** — `$service-worker.build` is empty in dev. Use `deno task preview` after `deno task build` to test offline / installability / Lighthouse.
- **After significant changes** (new routes, new static assets, build-tooling changes, theme/colour updates, manifest changes): run `deno task build && deno task preview`, then in Chrome DevTools verify (a) Application → Manifest parses with no warnings, (b) Application → Service Workers shows the new version activated, (c) Network → Offline → reload still loads the app, (d) Lighthouse PWA audit still passes. Also re-check the manifest colour-sync against `--bg` if the theme moved.

### Serialization
- `SerializedAppState` (version 4): `{ version, grid: SerializedGrid, palette: SerializedPalette }`.
- Grid notes include `midiNote` field (v3+) and `baseMidiOffset` field for relative-mode notes (v4+).
- Palette includes `pitchSystem` field (v3+, defaults to `'relative'`), `paletteOctave` field (v4+), and `diatonicKey` field (optional, defaults to `'C'`).
- **v1→v2 migration**: `refMidi = C0_MIDI + (octave ?? 4) * 12`.
- **v2→v3 migration**: `migrateGrid` computes `midiNote` from `pitch + palette.refMidi`; adds `pitchSystem: 'relative'`.
- **v3→v4 migration**: `migrateGrid` computes `baseMidiOffset = midiNote - refMidi` for relative-mode notes; `migratePalette` defaults `paletteOctave` (0 for relative, 4 for absolute).
- Named saves stored in localStorage as `solfa2-save-{name}`.

## What Is NOT Yet Built

From `detailed_requirements.md`:
- **Grid column/row count configuration** (constants exist, no UI)
- **Auto-expand grid** (no automatic row addition when insert overflows)
- **Capacitor** mobile packaging
- **Child-friendly visual theme** (monster characters etc.)
- `end-of-row` drop target type exists in `drop-handler.ts` but `resolveDropTarget` never emits it — the `between/after` on the last cell implicitly covers it via the `insertCol >= columns` check.

## Notes / Gotchas

- where appropriate, use red-green test-driven development

- `svelte-kit sync` must be run via `deno task dev` (not npm). The `.svelte-kit/` dir is generated at dev time.
- Peer dep warning (vite-plugin-svelte wants vite@^5, project uses vite@6) — works fine, ignore.
- Tests live in `src/tests/` mirroring `src/lib/`. Import via `$lib/` alias (resolved by SvelteKit vite plugin in vitest config).
- `GridState` is not a singleton — it's instantiated in `+page.svelte` and passed as a prop, keeping it easily replaceable for save/load.
- **Vite module identity gotcha**: `.svelte.ts` files without runes can load as two separate instances when imported via mismatched specifiers (e.g. `foo.svelte` vs `foo.svelte.js`). Store files that don't use runes should use plain `.ts` extension to avoid this. All singleton store imports must use the same specifier across `.ts` and `.svelte` files.
- **iOS Safari silently kills async audio init.** Any `await` or `.then()` between a pointer/touch event and an `AudioContext` call invalidates the user-gesture, leaving the context permanently suspended. Desktop Chrome/Firefox don't enforce this so the bug is iOS-only and easy to miss. The audio path (`audioState.ensureReady()` → `playNote*()`) is therefore deliberately synchronous: `engine.init()` is sync, `resumeIfNeeded()` calls `ctx.resume()` without awaiting, and `engine.warmup()` plays a 1-sample silent buffer on first init as the canonical iOS unlock kick. Don't reintroduce `async` on this path. (Fix landed 2026-05-02 in commit `47e6ef4`.)
