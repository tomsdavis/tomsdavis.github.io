# CR1: pitch organisation
There was an ambiguity in how the pitch structure was described which I think is related to both CR2 and CR3 following. Let me restate:

## Absolute vs Relative Pitch
At its heart, the app should allow the user to switch between absolute pitch (note names C2, D2, G#5 etc. where C4 is middle C) and relative pitch (hence the 'solfa' project name).

### Absolute Pitch
The user can select either a diatonic palette (in any key), or a chromatic palette (full 12 note scale)


### Relative Pitch
The user can select
- a diatonic palette Do Re Mi Fa So La Ti relative to a specified key
- a chromatic palette Do Ku Re Na Mi Fa Ci So Pe La Vu Ti (Note the slightly unusual chromatic solfeggio names)
- a microtonal palette, with specified cents or milles above a base reference pitch (which can be expressed as either Hz or a note in scientific notation, e.g. C4=middle C)

In all of these the user needs to be able to switch the octave of the notes available for selection from the palette
Where solfeggio is used, the names of the notes should be user-editable

# CR1: octave note placement
There is a current bug where the octave indicator on the palette affects playback of all notes on the grid, rather than of the note being placed onto the grid. E.g. if a 'C' is placed onto the grid, it should be specified as C2, C3 etc.; or where a relative 'So' is placed in the grid it should be So_0 or So_1 or So_-1 depending on where it is relative to the base pitch currently in force. Thus you can have the same pitch class in the grid (multiple Cs, or multiple 'So' in solfeggio) but consistently playing different octaves.

In the case of microtonal pitches, this could be shown by always displaying the cents/milles on the note - so e.g. 585 mille, 1585 mille, -415 mille would all refer to the same note reference to a base pitch at different octaves.

# CR2: base pitch
Where a base pitch is used (for relative pitches as opposed to absolute) then this should be a property always editable in the top of the screen (where the Solfa title and Compose/Play buttons sit) as opposed to being hidden within the palette - i.e. changing the base pitch essentially just transposes the song. Where a base pitch is specified as a note name, this can be as e.g. C2, Eb3 etc. It may be specified as Hz in the microtonal case.

# CR4: separate palette octave from toolbar base pitch [IMPLEMENTED]

## Problem
The palette octave and the toolbar base pitch are currently conflated into a single `refMidi` value on `PaletteState`. Changing the palette octave (to select which octave to draw notes from) also changes the base pitch used for playback, and vice versa. These are two independent concepts.

## Design

### Two separate controls
1. **Toolbar base pitch** (relative mode only): sets the root note for playback transposition. Offers octave + key picker for chromatic/diatonic modes, and both Hz input and note-name picker for microtonal mode. Changing this transposes all placed notes in real time.
2. **Palette octave** (both modes): sets which octave palette entries are drawn from. Shown in the palette sidebar always (not just absolute mode).
   - In relative mode: displayed as relative octave numbers (..., -1, 0, 1, ...) where 0 is the default. Octave 0 subscript may be visually suppressed on grid labels.
   - In absolute mode: displayed as absolute octave numbers (3, 4, 5) as currently.

### Data model changes
- `PaletteState` gets a new `paletteOctave` field, separate from `refMidi`.
  - In absolute mode: `paletteOctave` is an absolute octave number (default 4).
  - In relative mode: `paletteOctave` is a relative offset (default 0).
- `Note` stores a base-pitch offset (`baseMidiOffset`) instead of an absolute `midiNote` for relative-mode notes.
  - For relative-mode notes: `baseMidiOffset` = `pitchToMidi(pitch, paletteOctave * 12)`. Actual playback MIDI = `baseMidiOffset + toolbarRefMidi`.
  - For absolute-mode notes: `midiNote` remains absolute as today.
- Grid labels in relative mode use the offset (e.g. Do₀, Do₁, Do₋₁) and do not change when the toolbar base pitch changes.

### Microtonal specifics
- Microtonal is relative-mode only. Base pitch is set in the toolbar as Hz or via a note-name picker.
- Palette octave shifts by ±1200 cents or ±1000 milles per octave step (±12 MIDI units internally).
- Labels show total cents/milles including octave offset: e.g. a 585‰ entry at palette octave 1 → `1585‰`, at octave -1 → `-415‰`. Labels do not change when the toolbar Hz changes.

### Playback
- `GridCell` playback computes actual MIDI at play time: in relative mode, `note.baseMidiOffset + currentToolbarRefMidi`; in absolute mode, `note.midiNote` directly.
- Changing the toolbar base pitch transposes all existing relative-mode notes without re-placing them.

### Drop-time resolution
- When dragging from palette in relative mode: `baseMidiOffset = pitchToMidi(pitch, paletteOctave * 12)`.
- When dragging from palette in absolute mode: `midiNote = pitchToMidi(pitch, C0_MIDI + paletteOctave * 12)`.

### Pitch system switching
- Switching pitch system (absolute ↔ relative) is a destructive reset: clears the grid, resets palette entries, resets both `refMidi` and `paletteOctave` to defaults.

### Serialization
- Bumps serialization to v4. `SerializedPalette` gains `paletteOctave`. `SerializedGrid` notes in relative mode store `baseMidiOffset` instead of `midiNote`.
- v3→v4 migration: compute `baseMidiOffset = midiNote - refMidi` for relative-mode notes; set `paletteOctave = 0`.

# CR5: extended diatonic palette [IMPLEMENTED]
Please extend the notes shown in the palette in relative diatonic mode. It currently includes Do_0 to Ti_0. Please extend this to be from So_{-1} to Mi_1 (13 notes). When the octave of the palette setting is changed, all notes should shift accordingly (so e.g. one octave up runs from So_0 to Mi_2)

# CR6: relative chromatic pitches [IMPLEMENTED]
For some reason these are showing as C C# D etc... rather than Do Ku Re Na Mi... Please investigate and fix.

# CR7: clear-grid behaviour [IMPLEMENTED]
Please add a button to the titlebar to clear the grid. Also, please enforce a tighter transition from relative to absolute pitch references, or to/from microtonal relative pitch in the palette. When any of these transitions occur, please pop up an 'Are you sure?' dialog, and if the answer is Yes then clear the grid before transitioning. For clarity - switches between diatonic absolute and chromatic absolute, or diatonic relative and chromatic relative are fine and should be allowed without prompting or clearing the grid.

# CR8: absolute diatonic mode [IMPLEMENTED]
This input mode currently uses solfeggio names (Do Re Mi etc...) rather than absolute note names. For this mode, the key should be selected inside the palette (as it sets the input notes possible to a major scale). The avaliable notes should remain as they are: from the fifth of the scale in the lower octave, through the middle octave, to the third of the major scale in the upper octave - but the note names should be absolute pitch names C4 D4 etc. If the palette pitch centre is changed, notes on the grid will remain, so the grid can contain a mix of absolute notes derived from multiple pitch centres - this is fine as it will just ultimately tend to a full range of 12 chromatic pitches.
