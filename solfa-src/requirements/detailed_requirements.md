# Solfa2 — Detailed Requirements

## Overview

A music composition and playback app. The user composes by dragging notes from a palette onto a grid, then plays them back by touching/clicking grid cells. The grid provides spatial ordering but no inherent rhythm — the user supplies rhythm through their touch timing.

Target audience: a 5-year-old child (simpler modes) and an adult (microtonal mode). The initial build is for personal use.

## Target Platforms (in priority order)

1. Web (primary development target)
2. Android
3. iPadOS / iOS

Offline support is desired (PWA / service worker).

## Technology Stack

- **Language:** TypeScript
- **UI framework:** SvelteKit
- **Audio:** Web Audio API
- **Mobile deployment:** Capacitor (later)
- **Interaction model:** Pointer Events API (unified mouse + touch)

## Grid

The grid is a rectangular arrangement of cells. Each cell is either empty or contains a single note.

- **Columns:** configurable by the user, up to a defined maximum.
- **Rows:** start at a default number. Additional rows can be added as needed. Scrollbars allow scrolling when the grid exceeds the visible area; touch interfaces support natural swipe-to-scroll.
- **Cell semantics:** cells are purely containers. They impose a linear ordering on placed notes (row 1 col 1, row 1 col 2, ..., row 1 col N, row 2 col 1, ...) but carry no inherent pitch or rhythmic meaning.
- **Empty cells:** remain empty. Removing a note from a cell does not cause surrounding notes to shift.

## Palette

The palette is displayed at the screen edges. It is a set of available notes that the user can drag onto the grid. The palette itself is never consumed — dragging from it creates a copy.

### Palette modes (to be built in this order)

1. **Chromatic (initial):** 12 semitone pitches (C, C#, D, ..., B). Each note can be shifted up or down by one or more octaves via an octave modifier (see below).
2. **Diatonic:** 7 notes of the major scale, with octave shifting via the same mechanism.
3. **Microtonal:** arbitrary number of palette entries, each specified as either:
   - **Cents** offset from a reference frequency (1 cent = 1/1200 octave, logarithmic), or
   - **Mille** offset from a reference frequency (1 mille = 1/1000 octave, logarithmic).

The palette is editable — users can add, remove, and reorder palette entries.

Chromatic and diatonic can be specified either as absolute pitch names (C, C#...) or as a key note plus a named offset (e.g. do = 0, re = 2 semitones, mi = 4 semitones etc.). Names should be customizable.

Notes in the palette should have a distinct (customizable) colour and/or icon; with a visual difference when a note in the grid is playing. (In the microtonal mode the icon might include the cents/mille for clarity)

The architecture should accommodate all three modes from the start, even though only chromatic is built first.

### Octave shifting

The palette must provide an intuitive way to shift a note up or down by octave(s) without duplicating palette entries for every octave. For example, an octave modifier control (e.g. +/- buttons or a small stepper adjacent to each palette note, or a global octave selector) lets the user set the octave before or during a drag. The exact UI mechanism should be simple enough for a child to use.

## Modes

The app has two explicit modes that the user switches between:

- **Composition mode:** for placing, moving, and arranging notes on the grid via drag-and-drop.
- **Playback mode:** for playing notes by touching/clicking grid cells.

A clear UI control (e.g. toggle button) switches between modes.

## Composition Mode — Interactions

All drag operations use the Pointer Events API for unified mouse and touch support.

### Dragging from palette to grid

- Touch/click a palette note and drag it toward the grid.
- A visual copy of the note follows the pointer. The palette entry itself is unaffected.
- The note should sound while the note is being dragged, and stop on release.

- **Drop on an empty cell:** the note is placed in that cell.
- **Drop on an occupied cell:** the existing note is replaced.
- **Drop between two adjacent cells (horizontally), or at the end of a row:** the note is inserted at that position. Existing notes from that position onward shift rightward. A note pushed past the last column of its row wraps to column 1 of the next row, cascading further shifts as needed until an empty cell absorbs the displacement.
- **Release outside the grid:** the operation is cancelled; nothing changes.

### Dragging within the grid

- Touch/click an existing note in the grid and drag it.
- The note should sound while being dragged, and stop on release.
- **Drop on an empty cell:** the note moves to that cell. The original cell becomes empty.
- **Drop on an occupied cell:** the note replaces the occupant. The original cell becomes empty.
- **Drop between two adjacent cells (horizontally), or at the end of a row:** the note is inserted at that position (same insert-and-shift behaviour as palette-to-grid drops). The original cell becomes empty.
- **Drop outside the grid:** the note is deleted. The original cell becomes empty.

### Deletion

- Dragging a note out of the grid deletes it (as above).
- No other delete mechanism is required initially.

## Playback Mode

### Triggering

- Touch/click a grid cell containing a note to begin playing its sound.
- The sound plays continuously for as long as the pointer/finger is held down.
- Releasing the pointer/finger stops the sound.

### Polyphony

- In multitouch environments, multiple notes can be played simultaneously.
- Each playing note is an independent audio voice.

### Visual feedback

- A cell whose note is currently sounding should have a clear visual indication (e.g. highlight, glow, colour change).

## Audio Architecture

- **Sound source:** sampled audio (public-domain instrument samples). One sample per base pitch.
- **Pitch shifting:** performed via `AudioBufferSourceNode.detune` (in cents). This naturally supports microtonal intervals.
- **Signal chain per voice:**
  ```
  AudioBufferSourceNode (with .detune for pitch)
    → GainNode (per-voice, for envelope/muting)
      → master GainNode
        → AudioContext.destination
  ```
- **Lifecycle:** a new `AudioBufferSourceNode` is created on each touch-start and stopped/discarded on touch-end.
- Samples are loaded into `AudioBuffer` objects at app startup.

## Save / Load

- Both palettes and grids can be saved and loaded independently.
- File format: text-based (JSON), to allow manual editing and easy sharing.
- Storage mechanism: initially browser localStorage or File System Access API; later, Capacitor filesystem for mobile.

## Future Considerations (not in initial build)

These are noted for architectural awareness, not for implementation now:

- **Child-friendly visual theme:** colourful characters (e.g. monsters that open their mouths and sing) as visual representations of notes.
- **Diatonic and microtonal palette modes.**
- **App store distribution** via Capacitor.
