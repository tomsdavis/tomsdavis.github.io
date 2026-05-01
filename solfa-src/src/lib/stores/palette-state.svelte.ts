import type { PaletteEntry, PaletteMode, PitchSystem } from '$lib/types/palette.js';
import type { PitchSpecification } from '$lib/types/note.js';
import { chromaticName, chromaticSolfegeName, majorScaleNoteNames, keyRootSemitone } from '$lib/utils/note-names.js';
import { noteColor, NOTE_COLORS } from '$lib/utils/colors.js';
import { pitchToMidi, hzToMidi } from '$lib/audio/pitch.js';
import { C0_MIDI, MIN_OCTAVE, MAX_OCTAVE, A4_MIDI, MIN_PALETTE_OCTAVE_RELATIVE, MAX_PALETTE_OCTAVE_RELATIVE } from '$lib/constants.js';

let _nextId = 0;
function nextEntryId(): string {
	return `entry-${++_nextId}`;
}

function createChromaticEntries(pitchSystem: PitchSystem = 'relative'): PaletteEntry[] {
	const nameFn = pitchSystem === 'relative' ? chromaticSolfegeName : chromaticName;
	const entries: PaletteEntry[] = [];
	for (let i = 0; i < 12; i++) {
		entries.push({
			entryId: `chromatic-${i}`,
			basePitch: { kind: 'semitone', semitones: i },
			name: nameFn(i),
			color: noteColor(i),
			order: i
		});
	}
	return entries;
}

function createDiatonicEntries(): PaletteEntry[] {
	// Extended diatonic: So₋₁ through Mi₁ (13 notes spanning ~2 octaves)
	const scale = [0, 2, 4, 5, 7, 9, 11]; // diatonic semitones within one octave
	const scaleNames = ['Do', 'Re', 'Mi', 'Fa', 'So', 'La', 'Ti'];
	// Start from So₋₁ (index 4 in scale, octave -1) through Mi₁ (index 2 in scale, octave 1)
	const entries: { semitones: number; name: string }[] = [];
	// Octave -1: So, La, Ti (scale indices 4,5,6)
	for (let i = 4; i < 7; i++) {
		entries.push({ semitones: scale[i] - 12, name: scaleNames[i] });
	}
	// Octave 0: Do, Re, Mi, Fa, So, La, Ti (all 7)
	for (let i = 0; i < 7; i++) {
		entries.push({ semitones: scale[i], name: scaleNames[i] });
	}
	// Octave 1: Do, Re, Mi (scale indices 0,1,2)
	for (let i = 0; i < 3; i++) {
		entries.push({ semitones: scale[i] + 12, name: scaleNames[i] });
	}
	return entries.map((e, i) => ({
		entryId: `diatonic-${i}`,
		basePitch: { kind: 'semitone' as const, semitones: e.semitones },
		name: e.name,
		color: noteColor(((e.semitones % 12) + 12) % 12),
		order: i
	}));
}

const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];

function createAbsoluteDiatonicEntries(keyName: string): PaletteEntry[] {
	const scaleNames = majorScaleNoteNames(keyName);
	const root = keyRootSemitone(keyName);
	// Ascending semitone values: root + interval (no wrapping at 12)
	const scaleSemitones = MAJOR_INTERVALS.map(interval => root + interval);

	// Extended range: 5th below through 3rd above (13 entries spanning ~2 octaves)
	const entries: { semitones: number; name: string }[] = [];
	// Octave -1: scale degrees 4,5,6 (5th, 6th, 7th)
	for (let i = 4; i < 7; i++) {
		entries.push({ semitones: scaleSemitones[i] - 12, name: scaleNames[i] });
	}
	// Octave 0: all 7
	for (let i = 0; i < 7; i++) {
		entries.push({ semitones: scaleSemitones[i], name: scaleNames[i] });
	}
	// Octave 1: scale degrees 0,1,2 (root, 2nd, 3rd)
	for (let i = 0; i < 3; i++) {
		entries.push({ semitones: scaleSemitones[i] + 12, name: scaleNames[i] });
	}

	return entries.map((e, i) => ({
		entryId: `abs-diatonic-${i}`,
		basePitch: { kind: 'semitone' as const, semitones: e.semitones },
		name: e.name,
		color: noteColor(((e.semitones % 12) + 12) % 12),
		order: i
	}));
}

function createMicrotonalDefault(): PaletteEntry[] {
	// Pure pentatonic in cents: unison, major 2nd, major 3rd, perfect 5th, major 6th
	const centValues = [0, 204, 386, 702, 884];
	const names = ['1', '2', '3', '5', '6'];
	return centValues.map((cents, i) => ({
		entryId: `microtonal-${i}`,
		basePitch: { kind: 'cents' as const, cents },
		name: names[i],
		color: NOTE_COLORS[i * 2 % 12],
		order: i
	}));
}

export class PaletteState {
	mode: PaletteMode = $state('chromatic');
	entries: PaletteEntry[] = $state([]);
	refMidi: number = $state(C0_MIDI + 4 * 12); // C4 = 60
	pitchSystem: PitchSystem = $state('relative');
	paletteOctave: number = $state(0);
	diatonicKey: string = $state('C');

	constructor() {
		this.entries = createChromaticEntries();
	}

	get octave(): number {
		return Math.floor((this.refMidi - C0_MIDI) / 12);
	}

	/** The effective refMidi for palette operations (drag preview, drop resolution) */
	get effectiveRefMidiForPalette(): number {
		if (this.pitchSystem === 'absolute') {
			return C0_MIDI + this.paletteOctave * 12;
		}
		return this.refMidi + this.paletteOctave * 12;
	}

	incrementPaletteOctave(): void {
		if (this.pitchSystem === 'absolute') {
			if (this.paletteOctave < MAX_OCTAVE) this.paletteOctave++;
		} else {
			if (this.paletteOctave < MAX_PALETTE_OCTAVE_RELATIVE) this.paletteOctave++;
		}
	}

	decrementPaletteOctave(): void {
		if (this.pitchSystem === 'absolute') {
			if (this.paletteOctave > MIN_OCTAVE) this.paletteOctave--;
		} else {
			if (this.paletteOctave > MIN_PALETTE_OCTAVE_RELATIVE) this.paletteOctave--;
		}
	}

	incrementOctave(): void {
		if (this.octave < MAX_OCTAVE) {
			if (this.pitchSystem === 'absolute') {
				this.setAbsoluteOctave(this.octave + 1);
			} else {
				this.refMidi += 12;
			}
		}
	}

	decrementOctave(): void {
		if (this.octave > MIN_OCTAVE) {
			if (this.pitchSystem === 'absolute') {
				this.setAbsoluteOctave(this.octave - 1);
			} else {
				this.refMidi -= 12;
			}
		}
	}

	setPitchSystem(system: PitchSystem): void {
		this.pitchSystem = system;
		this.diatonicKey = 'C';
		if (system === 'absolute') {
			this.refMidi = C0_MIDI;
			this.mode = 'chromatic';
			this.entries = createChromaticEntries('absolute');
			this.paletteOctave = 4;
		} else {
			this.refMidi = C0_MIDI + 4 * 12;
			this.mode = 'chromatic';
			this.entries = createChromaticEntries('relative');
			this.paletteOctave = 0;
		}
	}

	setAbsoluteOctave(octave: number): void {
		if (octave < MIN_OCTAVE || octave > MAX_OCTAVE) return;
		this.refMidi = C0_MIDI + octave * 12;
	}

	/** Get the absolute MIDI note number for a palette entry at current refMidi */
	getAbsoluteMidi(entry: PaletteEntry): number {
		return pitchToMidi(entry.basePitch, this.refMidi);
	}

	setMode(mode: PaletteMode): void {
		this.mode = mode;
		switch (mode) {
			case 'chromatic':
				this.entries = createChromaticEntries(this.pitchSystem);
				break;
			case 'diatonic':
				if (this.pitchSystem === 'absolute') {
					this.entries = createAbsoluteDiatonicEntries(this.diatonicKey);
				} else {
					this.entries = createDiatonicEntries();
				}
				break;
			case 'microtonal':
				this.entries = createMicrotonalDefault();
				this.refMidi = A4_MIDI; // A4 = 69
				break;
		}
	}

	setDiatonicKey(keyName: string): void {
		this.diatonicKey = keyName;
		if (this.mode === 'diatonic' && this.pitchSystem === 'absolute') {
			this.entries = createAbsoluteDiatonicEntries(keyName);
		}
	}

	addEntry(partial: Omit<PaletteEntry, 'entryId'>): void {
		const maxOrder = this.entries.reduce((m, e) => Math.max(m, e.order), -1);
		const newEntry: PaletteEntry = {
			...partial,
			entryId: nextEntryId(),
			order: maxOrder + 1
		};
		this.entries = [...this.entries, newEntry];
	}

	removeEntry(entryId: string): void {
		this.entries = this.entries.filter((e) => e.entryId !== entryId);
	}

	updateEntry(entryId: string, changes: Partial<Omit<PaletteEntry, 'entryId'>>): void {
		this.entries = this.entries.map((e) =>
			e.entryId === entryId ? { ...e, ...changes } : e
		);
	}

	moveEntryUp(entryId: string): void {
		const sorted = [...this.entries].sort((a, b) => a.order - b.order);
		const idx = sorted.findIndex((e) => e.entryId === entryId);
		if (idx <= 0) return;
		const prev = sorted[idx - 1];
		const curr = sorted[idx];
		// Swap orders
		this.entries = this.entries.map((e) => {
			if (e.entryId === curr.entryId) return { ...e, order: prev.order };
			if (e.entryId === prev.entryId) return { ...e, order: curr.order };
			return e;
		});
	}

	moveEntryDown(entryId: string): void {
		const sorted = [...this.entries].sort((a, b) => a.order - b.order);
		const idx = sorted.findIndex((e) => e.entryId === entryId);
		if (idx < 0 || idx >= sorted.length - 1) return;
		const next = sorted[idx + 1];
		const curr = sorted[idx];
		// Swap orders
		this.entries = this.entries.map((e) => {
			if (e.entryId === curr.entryId) return { ...e, order: next.order };
			if (e.entryId === next.entryId) return { ...e, order: curr.order };
			return e;
		});
	}
}

export const paletteState = new PaletteState();
