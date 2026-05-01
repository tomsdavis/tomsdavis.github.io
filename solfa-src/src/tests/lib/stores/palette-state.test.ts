import { describe, it, expect, beforeEach } from 'vitest';
import { PaletteState } from '$lib/stores/palette-state.svelte';
import { C0_MIDI, MIN_OCTAVE, MAX_OCTAVE, MIN_PALETTE_OCTAVE_RELATIVE, MAX_PALETTE_OCTAVE_RELATIVE } from '$lib/constants';

describe('PaletteState', () => {
	let ps: PaletteState;

	beforeEach(() => {
		ps = new PaletteState();
	});

	describe('refMidi and octave', () => {
		it('defaults to refMidi=60 (C4)', () => {
			expect(ps.refMidi).toBe(60);
		});

		it('octave getter returns 4 when refMidi=60', () => {
			expect(ps.octave).toBe(4);
		});

		it('incrementOctave bumps refMidi by 12', () => {
			ps.incrementOctave();
			expect(ps.refMidi).toBe(72);
			expect(ps.octave).toBe(5);
		});

		it('decrementOctave reduces refMidi by 12', () => {
			ps.decrementOctave();
			expect(ps.refMidi).toBe(48);
			expect(ps.octave).toBe(3);
		});

		it('incrementOctave clamps at MAX_OCTAVE', () => {
			ps.refMidi = C0_MIDI + MAX_OCTAVE * 12;
			ps.incrementOctave();
			expect(ps.octave).toBe(MAX_OCTAVE);
		});

		it('decrementOctave clamps at MIN_OCTAVE', () => {
			ps.refMidi = C0_MIDI + MIN_OCTAVE * 12;
			ps.decrementOctave();
			expect(ps.octave).toBe(MIN_OCTAVE);
		});
	});

	describe('getAbsoluteMidi', () => {
		it('semitone: refMidi + semitones', () => {
			ps.refMidi = 60;
			const entry = ps.entries[0]; // semitones: 0
			expect(ps.getAbsoluteMidi(entry)).toBe(60);
		});

		it('semitone: correctly offsets', () => {
			ps.refMidi = 60;
			const entry = ps.entries[7]; // semitones: 7 (G)
			expect(ps.getAbsoluteMidi(entry)).toBeCloseTo(67);
		});

		it('cents: refMidi + cents/100', () => {
			ps.setMode('microtonal');
			ps.refMidi = 69; // A4
			const entry = ps.entries[0]; // cents: 0
			expect(ps.getAbsoluteMidi(entry)).toBeCloseTo(69);
		});
	});

	describe('chromatic entries', () => {
		it('has 12 entries', () => {
			expect(ps.entries.length).toBe(12);
		});

		it('entries are semitone intervals 0–11', () => {
			for (let i = 0; i < 12; i++) {
				const entry = ps.entries.find((e) => e.order === i)!;
				expect(entry.basePitch).toEqual({ kind: 'semitone', semitones: i });
			}
		});
	});

	describe('setMode', () => {
		it('setMode("diatonic") replaces with 13 entries (So₋₁ through Mi₁)', () => {
			ps.setMode('diatonic');
			expect(ps.mode).toBe('diatonic');
			expect(ps.entries.length).toBe(13);
		});

		it('diatonic entries have correct semitones from So₋₁ to Mi₁', () => {
			ps.setMode('diatonic');
			const semitones = ps.entries.map((e) => (e.basePitch as { kind: 'semitone'; semitones: number }).semitones);
			expect(semitones).toEqual([-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16]);
		});

		it('diatonic entries have solfege names', () => {
			ps.setMode('diatonic');
			const names = ps.entries.map((e) => e.name);
			expect(names).toEqual(['So', 'La', 'Ti', 'Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti', 'Do', 'Re', 'Mi']);
		});

		it('setMode("microtonal") replaces with microtonal entries', () => {
			ps.setMode('microtonal');
			expect(ps.mode).toBe('microtonal');
			expect(ps.entries.length).toBeGreaterThan(0);
			// All entries should have cents pitch
			expect(ps.entries[0].basePitch.kind).toBe('cents');
		});

		it('setMode("microtonal") resets refMidi to ~69 (A4)', () => {
			ps.setMode('microtonal');
			expect(ps.refMidi).toBeCloseTo(69, 0);
		});

		it('setMode("chromatic") restores 12 chromatic entries', () => {
			ps.setMode('diatonic');
			ps.setMode('chromatic');
			expect(ps.mode).toBe('chromatic');
			expect(ps.entries.length).toBe(12);
		});

		it('chromatic entries use solfege names in relative mode', () => {
			ps.setPitchSystem('relative');
			ps.setMode('chromatic');
			const names = ps.entries.sort((a, b) => a.order - b.order).map((e) => e.name);
			expect(names).toEqual(['Do', 'Ku', 'Re', 'Na', 'Mi', 'Fa', 'Ci', 'So', 'Pe', 'La', 'Vu', 'Ti']);
		});

		it('chromatic entries use note names in absolute mode', () => {
			ps.setPitchSystem('absolute');
			ps.setMode('chromatic');
			const names = ps.entries.sort((a, b) => a.order - b.order).map((e) => e.name);
			expect(names).toEqual(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);
		});

		it('default chromatic entries use solfege names (default is relative)', () => {
			// Constructor creates chromatic entries — since default is relative, should be solfege
			const names = ps.entries.sort((a, b) => a.order - b.order).map((e) => e.name);
			expect(names).toEqual(['Do', 'Ku', 'Re', 'Na', 'Mi', 'Fa', 'Ci', 'So', 'Pe', 'La', 'Vu', 'Ti']);
		});
	});

	describe('CRUD', () => {
		it('addEntry appends a new entry with unique entryId', () => {
			const before = ps.entries.length;
			ps.addEntry({ basePitch: { kind: 'semitone', semitones: 5 }, name: 'Test', color: '#fff', order: 99 });
			expect(ps.entries.length).toBe(before + 1);
			const added = ps.entries[ps.entries.length - 1];
			expect(added.name).toBe('Test');
			expect(added.entryId).toBeTruthy();
		});

		it('addEntry generates unique entryIds', () => {
			ps.addEntry({ basePitch: { kind: 'semitone', semitones: 0 }, name: 'A', color: '#fff', order: 99 });
			ps.addEntry({ basePitch: { kind: 'semitone', semitones: 0 }, name: 'B', color: '#fff', order: 100 });
			const ids = ps.entries.map((e) => e.entryId);
			const unique = new Set(ids);
			expect(unique.size).toBe(ids.length);
		});

		it('removeEntry removes the correct entry', () => {
			const targetId = ps.entries[3].entryId;
			ps.removeEntry(targetId);
			expect(ps.entries.find((e) => e.entryId === targetId)).toBeUndefined();
			expect(ps.entries.length).toBe(11);
		});

		it('updateEntry merges changes', () => {
			const targetId = ps.entries[0].entryId;
			ps.updateEntry(targetId, { name: 'Updated' });
			expect(ps.entries.find((e) => e.entryId === targetId)?.name).toBe('Updated');
		});

		it('moveEntryUp swaps order with predecessor', () => {
			ps.setMode('diatonic'); // 7 entries for easier testing
			const sorted = [...ps.entries].sort((a, b) => a.order - b.order);
			const secondId = sorted[1].entryId;
			ps.moveEntryUp(secondId);
			const newSorted = [...ps.entries].sort((a, b) => a.order - b.order);
			expect(newSorted[0].entryId).toBe(secondId);
		});

		it('moveEntryDown swaps order with successor', () => {
			ps.setMode('diatonic');
			const sorted = [...ps.entries].sort((a, b) => a.order - b.order);
			const firstId = sorted[0].entryId;
			ps.moveEntryDown(firstId);
			const newSorted = [...ps.entries].sort((a, b) => a.order - b.order);
			expect(newSorted[1].entryId).toBe(firstId);
		});

		it('moveEntryUp does not move first entry', () => {
			const sorted = [...ps.entries].sort((a, b) => a.order - b.order);
			const firstId = sorted[0].entryId;
			const firstOrder = sorted[0].order;
			ps.moveEntryUp(firstId);
			expect(ps.entries.find((e) => e.entryId === firstId)?.order).toBe(firstOrder);
		});

		it('moveEntryDown does not move last entry', () => {
			const sorted = [...ps.entries].sort((a, b) => a.order - b.order);
			const last = sorted[sorted.length - 1];
			ps.moveEntryDown(last.entryId);
			expect(ps.entries.find((e) => e.entryId === last.entryId)?.order).toBe(last.order);
		});
	});

	describe('paletteOctave', () => {
		it('defaults to 0', () => {
			expect(ps.paletteOctave).toBe(0);
		});

		it('incrementPaletteOctave increases by 1', () => {
			ps.incrementPaletteOctave();
			expect(ps.paletteOctave).toBe(1);
		});

		it('decrementPaletteOctave decreases by 1', () => {
			ps.decrementPaletteOctave();
			expect(ps.paletteOctave).toBe(-1);
		});

		it('clamps at MAX_PALETTE_OCTAVE_RELATIVE in relative mode', () => {
			ps.paletteOctave = MAX_PALETTE_OCTAVE_RELATIVE;
			ps.incrementPaletteOctave();
			expect(ps.paletteOctave).toBe(MAX_PALETTE_OCTAVE_RELATIVE);
		});

		it('clamps at MIN_PALETTE_OCTAVE_RELATIVE in relative mode', () => {
			ps.paletteOctave = MIN_PALETTE_OCTAVE_RELATIVE;
			ps.decrementPaletteOctave();
			expect(ps.paletteOctave).toBe(MIN_PALETTE_OCTAVE_RELATIVE);
		});

		it('clamps at MAX_OCTAVE in absolute mode', () => {
			ps.setPitchSystem('absolute');
			ps.paletteOctave = MAX_OCTAVE;
			ps.incrementPaletteOctave();
			expect(ps.paletteOctave).toBe(MAX_OCTAVE);
		});

		it('clamps at MIN_OCTAVE in absolute mode', () => {
			ps.setPitchSystem('absolute');
			ps.paletteOctave = MIN_OCTAVE;
			ps.decrementPaletteOctave();
			expect(ps.paletteOctave).toBe(MIN_OCTAVE);
		});

		it('effectiveRefMidiForPalette in relative mode', () => {
			// refMidi=60 + paletteOctave=0 * 12 = 60
			expect(ps.effectiveRefMidiForPalette).toBe(60);
			ps.paletteOctave = 1;
			expect(ps.effectiveRefMidiForPalette).toBe(72);
			ps.paletteOctave = -1;
			expect(ps.effectiveRefMidiForPalette).toBe(48);
		});

		it('effectiveRefMidiForPalette in absolute mode', () => {
			ps.setPitchSystem('absolute');
			// default paletteOctave=4 → C0_MIDI + 4*12 = 60
			expect(ps.effectiveRefMidiForPalette).toBe(C0_MIDI + 4 * 12);
			ps.paletteOctave = 5;
			expect(ps.effectiveRefMidiForPalette).toBe(C0_MIDI + 5 * 12);
		});

		it('is independent from refMidi', () => {
			ps.paletteOctave = 2;
			ps.refMidi = 62; // D4
			// effectiveRefMidiForPalette = 62 + 2*12 = 86
			expect(ps.effectiveRefMidiForPalette).toBe(86);
			// refMidi unchanged
			expect(ps.refMidi).toBe(62);
		});

		it('setPitchSystem resets paletteOctave', () => {
			ps.paletteOctave = 3;
			ps.setPitchSystem('absolute');
			expect(ps.paletteOctave).toBe(4);
			ps.setPitchSystem('relative');
			expect(ps.paletteOctave).toBe(0);
		});
	});

	describe('absolute diatonic mode', () => {
		beforeEach(() => {
			ps.setPitchSystem('absolute');
		});

		it('setMode("diatonic") creates 13 entries in absolute mode', () => {
			ps.setMode('diatonic');
			expect(ps.entries.length).toBe(13);
		});

		it('absolute diatonic key C has note names C D E F G A B', () => {
			ps.setMode('diatonic');
			const names = ps.entries.map(e => e.name);
			// Extended range: 5th below (G) through 3rd above (E)
			expect(names).toEqual(['G', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E']);
		});

		it('absolute diatonic key G has F# not Gb', () => {
			ps.setDiatonicKey('G');
			ps.setMode('diatonic');
			const names = ps.entries.map(e => e.name);
			expect(names).toContain('F#');
			expect(names).not.toContain('Gb');
		});

		it('absolute diatonic key F has Bb not A#', () => {
			ps.setDiatonicKey('F');
			ps.setMode('diatonic');
			const names = ps.entries.map(e => e.name);
			expect(names).toContain('Bb');
			expect(names).not.toContain('A#');
		});

		it('absolute diatonic key Db has correct flats', () => {
			ps.setDiatonicKey('Db');
			ps.setMode('diatonic');
			const names = ps.entries.map(e => e.name);
			expect(names).toContain('Db');
			expect(names).toContain('Eb');
			expect(names).toContain('Gb');
			expect(names).toContain('Ab');
			expect(names).toContain('Bb');
		});

		it('diatonic entries have semitone pitches', () => {
			ps.setMode('diatonic');
			for (const entry of ps.entries) {
				expect(entry.basePitch.kind).toBe('semitone');
			}
		});

		it('setDiatonicKey regenerates entries when in diatonic mode', () => {
			ps.setMode('diatonic');
			const namesBefore = ps.entries.map(e => e.name);
			ps.setDiatonicKey('G');
			const namesAfter = ps.entries.map(e => e.name);
			expect(namesBefore).not.toEqual(namesAfter);
			expect(namesAfter).toContain('F#');
		});

		it('setDiatonicKey does not regenerate entries when in chromatic mode', () => {
			ps.setMode('chromatic');
			const entriesBefore = [...ps.entries];
			ps.setDiatonicKey('G');
			expect(ps.entries).toEqual(entriesBefore);
			expect(ps.diatonicKey).toBe('G');
		});

		it('diatonicKey defaults to C', () => {
			expect(ps.diatonicKey).toBe('C');
		});

		it('setPitchSystem to absolute resets diatonicKey to C', () => {
			ps.setDiatonicKey('G');
			ps.setPitchSystem('absolute');
			expect(ps.diatonicKey).toBe('C');
		});

		it('absolute diatonic semitones are monotonically ascending', () => {
			ps.setDiatonicKey('Eb');
			ps.setMode('diatonic');
			const semitones = ps.entries.map(e =>
				(e.basePitch as { kind: 'semitone'; semitones: number }).semitones
			);
			for (let i = 1; i < semitones.length; i++) {
				expect(semitones[i]).toBeGreaterThan(semitones[i - 1]);
			}
		});

		it('Eb major palette with paletteOctave=4 labels C above Bb correctly', () => {
			ps.setDiatonicKey('Eb');
			ps.setMode('diatonic');
			// The entries should produce ascending semitones:
			// Bb(-2), C(0), D(2), Eb(3), F(5), G(7), Ab(8), Bb(10), C(12), D(14), Eb(15), F(17), G(19)
			const semitones = ps.entries.map(e =>
				(e.basePitch as { kind: 'semitone'; semitones: number }).semitones
			);
			expect(semitones).toEqual([-2, 0, 2, 3, 5, 7, 8, 10, 12, 14, 15, 17, 19]);
		});

		it('C major semitones are correct (no wrapping issue)', () => {
			ps.setMode('diatonic');
			const semitones = ps.entries.map(e =>
				(e.basePitch as { kind: 'semitone'; semitones: number }).semitones
			);
			// G(-5), A(-3), B(-1), C(0), D(2), E(4), F(5), G(7), A(9), B(11), C(12), D(14), E(16)
			expect(semitones).toEqual([-5, -3, -1, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16]);
		});

		it('relative diatonic still uses solfege names', () => {
			ps.setPitchSystem('relative');
			ps.setMode('diatonic');
			const names = ps.entries.map(e => e.name);
			expect(names).toEqual(['So', 'La', 'Ti', 'Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti', 'Do', 'Re', 'Mi']);
		});
	});

	describe('pitchSystem', () => {
		it('defaults to relative', () => {
			expect(ps.pitchSystem).toBe('relative');
		});

		it('setPitchSystem to absolute sets refMidi to C0_MIDI', () => {
			ps.setPitchSystem('absolute');
			expect(ps.pitchSystem).toBe('absolute');
			expect(ps.refMidi).toBe(C0_MIDI);
		});

		it('setPitchSystem to absolute generates chromatic entries', () => {
			ps.setPitchSystem('absolute');
			expect(ps.entries.length).toBe(12);
			// Entries should be semitone 0-11
			const sorted = [...ps.entries].sort((a, b) => a.order - b.order);
			for (let i = 0; i < 12; i++) {
				expect(sorted[i].basePitch).toEqual({ kind: 'semitone', semitones: i });
			}
		});

		it('setPitchSystem back to relative restores refMidi to C4', () => {
			ps.setPitchSystem('absolute');
			ps.setPitchSystem('relative');
			expect(ps.pitchSystem).toBe('relative');
			expect(ps.refMidi).toBe(C0_MIDI + 4 * 12);
		});

		it('absolute mode: setAbsoluteOctave regenerates entries for that octave', () => {
			ps.setPitchSystem('absolute');
			ps.setAbsoluteOctave(5);
			expect(ps.octave).toBe(5);
			// refMidi should be C5
			expect(ps.refMidi).toBe(C0_MIDI + 5 * 12);
		});

		it('setPitchSystem to absolute hides microtonal mode', () => {
			ps.setPitchSystem('absolute');
			// Mode should be chromatic (not microtonal)
			expect(ps.mode).toBe('chromatic');
		});
	});
});
