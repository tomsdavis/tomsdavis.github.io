import { describe, it, expect } from 'vitest';
import {
	serializeGrid,
	deserializeGrid,
	serializePalette,
	deserializePalette,
	serializeAppState,
	deserializeAppState
} from '$lib/utils/serialization';
import { C0_MIDI } from '$lib/constants';
import type { Note } from '$lib/types/note';
import type { GridCell } from '$lib/types/grid';
import type { PaletteEntry } from '$lib/types/palette';

function makeNote(id: string, semitones = 0, label = 'C', midiNote = 60, baseMidiOffset?: number): Note {
	return {
		id,
		pitch: { kind: 'semitone', semitones },
		midiNote,
		label,
		color: '#e74c3c',
		baseMidiOffset
	};
}

describe('serialization', () => {
	describe('grid round-trip', () => {
		it('preserves grid with notes', () => {
			const cells: GridCell[] = [makeNote('n1', 0, 'C'), null, makeNote('n2', 4, 'E'), null];
			const columns = 2;

			const json = serializeGrid(cells, columns);
			const result = deserializeGrid(json);

			expect(result.columns).toBe(2);
			expect(result.cells.length).toBe(4);
			expect(result.cells[0]?.id).toBe('n1');
			expect(result.cells[0]?.label).toBe('C');
			expect(result.cells[0]?.pitch).toEqual({ kind: 'semitone', semitones: 0 });
			expect(result.cells[1]).toBeNull();
			expect(result.cells[2]?.id).toBe('n2');
			expect(result.cells[3]).toBeNull();
		});

		it('preserves empty grid', () => {
			const cells: GridCell[] = [null, null, null, null, null, null];
			const columns = 3;

			const json = serializeGrid(cells, columns);
			const result = deserializeGrid(json);

			expect(result.columns).toBe(3);
			expect(result.cells.length).toBe(6);
			for (const cell of result.cells) {
				expect(cell).toBeNull();
			}
		});

		it('includes version field', () => {
			const json = serializeGrid([], 4);
			const parsed = JSON.parse(json);
			expect(parsed.version).toBe(4);
		});

		it('preserves baseMidiOffset on notes', () => {
			const cells: GridCell[] = [makeNote('n1', 0, 'Do₀', 60, 0), makeNote('n2', 0, 'Do₁', 72, 12)];
			const json = serializeGrid(cells, 2);
			const result = deserializeGrid(json);
			expect(result.cells[0]?.baseMidiOffset).toBe(0);
			expect(result.cells[1]?.baseMidiOffset).toBe(12);
		});
	});

	describe('palette round-trip', () => {
		it('preserves palette entries and refMidi', () => {
			const entries: PaletteEntry[] = [
				{
					entryId: 'chromatic-0',
					basePitch: { kind: 'semitone', semitones: 0 },
					name: 'C',
					color: '#e74c3c',
					order: 0
				},
				{
					entryId: 'chromatic-4',
					basePitch: { kind: 'semitone', semitones: 4 },
					name: 'E',
					color: '#1abc9c',
					order: 4
				}
			];

			const json = serializePalette(entries, 'chromatic', 60);
			const result = deserializePalette(json);

			expect(result.mode).toBe('chromatic');
			expect(result.refMidi).toBe(60);
			expect(result.entries.length).toBe(2);
			expect(result.entries[0].entryId).toBe('chromatic-0');
			expect(result.entries[0].basePitch).toEqual({ kind: 'semitone', semitones: 0 });
			expect(result.entries[1].name).toBe('E');
		});

		it('includes version 4 field', () => {
			const json = serializePalette([], 'chromatic', 60);
			const parsed = JSON.parse(json);
			expect(parsed.version).toBe(4);
		});

		it('preserves paletteOctave', () => {
			const json = serializePalette([], 'chromatic', 60, 'relative', 2);
			const result = deserializePalette(json);
			expect(result.paletteOctave).toBe(2);
		});

		it('migrates v1 payload (octave) to refMidi', () => {
			const v1Payload = JSON.stringify({
				version: 1,
				mode: 'chromatic',
				entries: [],
				octave: 4
			});
			const result = deserializePalette(v1Payload);
			expect(result.refMidi).toBe(C0_MIDI + 4 * 12); // 60
		});

		it('migrates v1 payload with octave=3', () => {
			const v1Payload = JSON.stringify({
				version: 1,
				mode: 'chromatic',
				entries: [],
				octave: 3
			});
			const result = deserializePalette(v1Payload);
			expect(result.refMidi).toBe(C0_MIDI + 3 * 12); // 48
		});

		it('defaults paletteOctave for pre-v4 relative palette', () => {
			const v3Payload = JSON.stringify({
				version: 3,
				mode: 'chromatic',
				entries: [],
				refMidi: 60,
				pitchSystem: 'relative'
			});
			const result = deserializePalette(v3Payload);
			expect(result.paletteOctave).toBe(0);
		});

		it('defaults paletteOctave for pre-v4 absolute palette', () => {
			const v3Payload = JSON.stringify({
				version: 3,
				mode: 'chromatic',
				entries: [],
				refMidi: C0_MIDI,
				pitchSystem: 'absolute'
			});
			const result = deserializePalette(v3Payload);
			expect(result.paletteOctave).toBe(4);
		});
	});

	describe('full app state round-trip', () => {
		it('preserves grid and palette together', () => {
			const cells: GridCell[] = [makeNote('n1'), null, null, null];
			const columns = 2;
			const entries: PaletteEntry[] = [
				{
					entryId: 'test-0',
					basePitch: { kind: 'semitone', semitones: 0 },
					name: 'C',
					color: '#e74c3c',
					order: 0
				}
			];

			const json = serializeAppState(cells, columns, entries, 'chromatic', 60);
			const result = deserializeAppState(json);

			expect(result.grid.columns).toBe(2);
			expect(result.grid.cells[0]?.id).toBe('n1');
			expect(result.palette.entries[0].name).toBe('C');
			expect(result.palette.refMidi).toBe(60);
		});

		it('preserves paletteOctave in full round-trip', () => {
			const cells: GridCell[] = [makeNote('n1', 0, 'Do₁', 72, 12), null];
			const json = serializeAppState(cells, 2, [], 'diatonic', 60, 'relative', 1);
			const result = deserializeAppState(json);
			expect(result.palette.paletteOctave).toBe(1);
			expect(result.grid.cells[0]?.baseMidiOffset).toBe(12);
		});

		it('handles notes with cents pitch spec', () => {
			const note: Note = {
				id: 'cents-1',
				pitch: { kind: 'cents', cents: 50 },
				midiNote: 60.5,
				label: '50¢₄',
				color: '#e84393'
			};
			const cells: GridCell[] = [note, null];

			const json = serializeGrid(cells, 2);
			const result = deserializeGrid(json);

			expect(result.cells[0]?.pitch).toEqual({ kind: 'cents', cents: 50 });
			expect(result.cells[0]?.midiNote).toBe(60.5);
		});

		it('handles notes with mille pitch spec', () => {
			const note: Note = {
				id: 'mille-1',
				pitch: { kind: 'mille', mille: 500 },
				midiNote: 66,
				label: '500‰₄',
				color: '#e84393'
			};
			const cells: GridCell[] = [note, null];

			const json = serializeGrid(cells, 2);
			const result = deserializeGrid(json);

			expect(result.cells[0]?.pitch).toEqual({ kind: 'mille', mille: 500 });
			expect(result.cells[0]?.midiNote).toBe(66);
		});

		it('migrates v2 grid notes to include midiNote', () => {
			const v2Payload = JSON.stringify({
				version: 2,
				grid: {
					version: 2,
					columns: 2,
					cells: [
						{
							id: 'n1',
							pitch: { kind: 'semitone', semitones: 4 },
							label: 'E',
							color: '#e74c3c'
						},
						null
					]
				},
				palette: {
					version: 2,
					mode: 'chromatic',
					entries: [],
					refMidi: 60
				}
			});
			const result = deserializeAppState(v2Payload);
			// midiNote should be computed as refMidi + semitones = 60 + 4 = 64
			expect(result.grid.cells[0]?.midiNote).toBe(64);
			// v2→v4 also adds baseMidiOffset for relative mode
			expect(result.grid.cells[0]?.baseMidiOffset).toBe(4);
		});

		it('migrates v3 relative notes to include baseMidiOffset', () => {
			const v3Payload = JSON.stringify({
				version: 3,
				grid: {
					version: 3,
					columns: 2,
					cells: [
						{
							id: 'n1',
							pitch: { kind: 'semitone', semitones: 7 },
							midiNote: 67,
							label: 'So₄',
							color: '#e74c3c'
						},
						null
					]
				},
				palette: {
					version: 3,
					mode: 'diatonic',
					entries: [],
					refMidi: 60,
					pitchSystem: 'relative'
				}
			});
			const result = deserializeAppState(v3Payload);
			// baseMidiOffset = midiNote - refMidi = 67 - 60 = 7
			expect(result.grid.cells[0]?.baseMidiOffset).toBe(7);
			expect(result.grid.cells[0]?.midiNote).toBe(67);
		});

		it('migrates v3 absolute notes without baseMidiOffset', () => {
			const v3Payload = JSON.stringify({
				version: 3,
				grid: {
					version: 3,
					columns: 2,
					cells: [
						{
							id: 'n1',
							pitch: { kind: 'semitone', semitones: 0 },
							midiNote: 60,
							label: 'C4',
							color: '#e74c3c'
						},
						null
					]
				},
				palette: {
					version: 3,
					mode: 'chromatic',
					entries: [],
					refMidi: C0_MIDI,
					pitchSystem: 'absolute'
				}
			});
			const result = deserializeAppState(v3Payload);
			// Absolute mode: no baseMidiOffset added
			expect(result.grid.cells[0]?.baseMidiOffset).toBeUndefined();
		});

		it('round-trip preserves diatonicKey', () => {
			const cells: GridCell[] = [null, null];
			const json = serializeAppState(cells, 2, [], 'diatonic', C0_MIDI, 'absolute', 4, 'G');
			const result = deserializeAppState(json);
			expect(result.palette.diatonicKey).toBe('G');
		});

		it('defaults diatonicKey to C when missing', () => {
			const v4Payload = JSON.stringify({
				version: 4,
				grid: { version: 4, columns: 2, cells: [null, null] },
				palette: {
					version: 4,
					mode: 'diatonic',
					entries: [],
					refMidi: C0_MIDI,
					pitchSystem: 'absolute',
					paletteOctave: 4
				}
			});
			const result = deserializeAppState(v4Payload);
			expect(result.palette.diatonicKey).toBe('C');
		});

		it('v4 round-trip preserves all fields', () => {
			const note = makeNote('n1', 7, 'So₁', 79, 19);
			const cells: GridCell[] = [note, null];
			const json = serializeAppState(cells, 2, [], 'diatonic', 60, 'relative', 1);
			const result = deserializeAppState(json);
			const cell = result.grid.cells[0]!;
			expect(cell.baseMidiOffset).toBe(19);
			expect(cell.midiNote).toBe(79);
			expect(result.palette.paletteOctave).toBe(1);
			expect(result.palette.pitchSystem).toBe('relative');
		});
	});
});
