import { describe, it, expect } from 'vitest';
import { handleDrop } from '$lib/utils/drop-handler';
import { GridState } from '$lib/stores/grid-state.svelte';
import type { DragOperation } from '$lib/stores/drag-state.svelte';
import type { Note } from '$lib/types/note';
import { C0_MIDI } from '$lib/constants';

function makeGridState(cols = 4, rows = 2): GridState {
	return new GridState(cols, rows);
}

function makePaletteDrop(row: number, col: number, semitones = 0, label = 'Do'): DragOperation {
	return {
		source: {
			kind: 'palette',
			entryId: 'test-entry',
			pitch: { kind: 'semitone', semitones },
			label,
			color: '#e74c3c'
		},
		x: 0,
		y: 0,
		dropTarget: { kind: 'cell', position: { row, col } },
		voiceId: null
	};
}

function makeGridNote(midiNote: number, semitones = 0, baseMidiOffset?: number): Note {
	return {
		id: `note-${midiNote}`,
		pitch: { kind: 'semitone', semitones },
		midiNote,
		label: 'X',
		color: '#000',
		baseMidiOffset
	};
}

describe('handleDrop', () => {
	describe('relative mode palette drops', () => {
		it('computes baseMidiOffset from pitch + paletteOctave', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 0, 'Do');
			// refMidi=60, paletteOctave=0 → baseMidiOffset = pitchToMidi({semitone:0}, 0*12) = 0
			// midiNote = 0 + 60 = 60
			handleDrop(op, gs, 60, 'diatonic', 'relative', 0);
			const cell = gs.cells[0]!;
			expect(cell.baseMidiOffset).toBe(0);
			expect(cell.midiNote).toBe(60);
		});

		it('paletteOctave=1 shifts baseMidiOffset by 12', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 0, 'Do');
			handleDrop(op, gs, 60, 'diatonic', 'relative', 1);
			const cell = gs.cells[0]!;
			expect(cell.baseMidiOffset).toBe(12);
			expect(cell.midiNote).toBe(72);
		});

		it('paletteOctave=-1 shifts baseMidiOffset by -12', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 7, 'So');
			// baseMidiOffset = pitchToMidi({semitone:7}, -12) = -12 + 7 = -5
			// midiNote = -5 + 60 = 55
			handleDrop(op, gs, 60, 'diatonic', 'relative', -1);
			const cell = gs.cells[0]!;
			expect(cell.baseMidiOffset).toBe(-5);
			expect(cell.midiNote).toBe(55);
		});

		it('sets label using baseMidiOffset-derived octave', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 0, 'Do');
			handleDrop(op, gs, 60, 'diatonic', 'relative', 1);
			// baseMidiOffset=12, octave = floor(12/12) = 1
			expect(gs.cells[0]!.label).toBe('Do₁');
		});
	});

	describe('absolute mode palette drops', () => {
		it('computes midiNote from C0_MIDI + paletteOctave * 12', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 0, 'C');
			// absolute: midiNote = pitchToMidi({semitone:0}, C0_MIDI + 4*12) = 12 + 48 = 60
			handleDrop(op, gs, C0_MIDI, 'chromatic', 'absolute', 4);
			const cell = gs.cells[0]!;
			expect(cell.midiNote).toBe(60);
			expect(cell.baseMidiOffset).toBeUndefined();
		});

		it('paletteOctave=5 in absolute mode', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 0, 'C');
			handleDrop(op, gs, C0_MIDI, 'chromatic', 'absolute', 5);
			expect(gs.cells[0]!.midiNote).toBe(C0_MIDI + 5 * 12);
		});
	});

	describe('absolute diatonic palette drops', () => {
		it('preserves enharmonic label from palette (Bb not A#)', () => {
			const gs = makeGridState();
			// Bb in key of F: semitones=10 (Bb), label='Bb'
			const op = makePaletteDrop(0, 0, 10, 'Bb');
			// absolute mode, paletteOctave=4
			handleDrop(op, gs, C0_MIDI, 'diatonic', 'absolute', 4);
			const cell = gs.cells[0]!;
			expect(cell.label).toBe('Bb4');
			expect(cell.midiNote).toBe(C0_MIDI + 4 * 12 + 10); // 70
		});

		it('preserves F# label in key of G', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 6, 'F#');
			handleDrop(op, gs, C0_MIDI, 'diatonic', 'absolute', 4);
			const cell = gs.cells[0]!;
			expect(cell.label).toBe('F#4');
		});

		it('preserves Gb label in key of Db', () => {
			const gs = makeGridState();
			const op = makePaletteDrop(0, 0, 6, 'Gb');
			handleDrop(op, gs, C0_MIDI, 'diatonic', 'absolute', 4);
			const cell = gs.cells[0]!;
			expect(cell.label).toBe('Gb4');
		});
	});

	describe('grid-to-grid moves preserve baseMidiOffset', () => {
		it('preserves baseMidiOffset on move', () => {
			const gs = makeGridState();
			const note = makeGridNote(72, 0, 12);
			gs.placeNote(0, 0, note);

			const op: DragOperation = {
				source: { kind: 'grid', position: { row: 0, col: 0 }, note },
				x: 0,
				y: 0,
				dropTarget: { kind: 'cell', position: { row: 0, col: 1 } },
				voiceId: null
			};

			handleDrop(op, gs, 60, 'diatonic', 'relative', 0);
			// Note moved from (0,0) to (0,1)
			expect(gs.cells[0]).toBeNull();
			expect(gs.cells[1]!.baseMidiOffset).toBe(12);
		});
	});
});
