import type { PitchSpecification } from '$lib/types/note.js';
import type { PaletteMode, PitchSystem } from '$lib/types/palette.js';
import { C0_MIDI } from '$lib/constants.js';

const CHROMATIC_NAMES = [
	'C', 'C#', 'D', 'D#', 'E', 'F',
	'F#', 'G', 'G#', 'A', 'A#', 'B'
] as const;

const SOLFEGE_NAMES: Record<number, string> = {
	0: 'Do',
	2: 'Re',
	4: 'Mi',
	5: 'Fa',
	7: 'So',
	9: 'La',
	11: 'Ti'
};

/** Full chromatic solfege names — one for each of the 12 semitones */
const CHROMATIC_SOLFEGE = [
	'Do', 'Ku', 'Re', 'Na', 'Mi', 'Fa',
	'Ci', 'So', 'Pe', 'La', 'Vu', 'Ti'
] as const;

/** Major scale note names for each key, with correct enharmonic spelling */
const MAJOR_SCALES: Record<string, string[]> = {
	'C':  ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
	'G':  ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
	'D':  ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
	'A':  ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
	'E':  ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
	'B':  ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
	'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'],
	'C#': ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'],
	'F':  ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
	'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
	'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
	'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
	'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
	'Gb': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
	'Cb': ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'Bb'],
};

/** Enharmonic aliases for impractical double-sharp keys */
const KEY_ALIASES: Record<string, string> = {
	'D#': 'Eb',
	'G#': 'Ab',
	'A#': 'Bb',
};

/** Map note name (with accidentals) to semitone 0-11 */
const NOTE_NAME_TO_SEMITONE: Record<string, number> = {
	'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
	'E': 4, 'E#': 5, 'Fb': 4, 'F': 5, 'F#': 6, 'Gb': 6,
	'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10,
	'B': 11, 'B#': 0, 'Cb': 11,
};

/** Ordered list of all key names for the UI */
export const ALL_KEY_NAMES: string[] = [
	'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
];

/** Returns 7 diatonic note names for the given key, with correct enharmonic spelling */
export function majorScaleNoteNames(keyName: string): string[] {
	const resolved = KEY_ALIASES[keyName] ?? keyName;
	return MAJOR_SCALES[resolved];
}

/** Returns 7 absolute semitone values (0-11) for the major scale of the given key */
export function majorScaleSemitones(keyName: string): number[] {
	return majorScaleNoteNames(keyName).map(name => NOTE_NAME_TO_SEMITONE[name]);
}

/** Returns the semitone (0-11) for a key root name */
export function keyRootSemitone(keyName: string): number {
	const resolved = KEY_ALIASES[keyName] ?? keyName;
	return NOTE_NAME_TO_SEMITONE[resolved];
}

const SUBSCRIPT_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUBSCRIPT_MINUS = '₋';

/** Get the chromatic note name for a semitone index (0-11, wraps) */
export function chromaticName(semitone: number): string {
	return CHROMATIC_NAMES[((semitone % 12) + 12) % 12];
}

/** Get the solfege name for a semitone index, falling back to chromatic for accidentals */
export function solfegeName(semitone: number): string {
	const idx = ((semitone % 12) + 12) % 12;
	return SOLFEGE_NAMES[idx] ?? CHROMATIC_NAMES[idx];
}

/** Format a note name with octave number */
export function noteNameWithOctave(name: string, octave: number): string {
	return `${name}${octave}`;
}

/** Convert absolute semitones from C0 to a note name with octave */
export function semitoneToNoteName(semitones: number): string {
	const octave = Math.floor(semitones / 12);
	const name = chromaticName(semitones);
	return noteNameWithOctave(name, octave);
}

/** Get the chromatic solfege name for a semitone index (0-11, wraps) */
export function chromaticSolfegeName(semitone: number): string {
	return CHROMATIC_SOLFEGE[((semitone % 12) + 12) % 12];
}

/** Convert a number to subscript digits (e.g. 4 → "₄", -1 → "₋₁") */
export function subscriptDigit(n: number): string {
	if (n < 0) {
		return SUBSCRIPT_MINUS + subscriptDigit(-n);
	}
	return String(n)
		.split('')
		.map((d) => SUBSCRIPT_DIGITS[parseInt(d)])
		.join('');
}

/**
 * Generate a display label for a grid note.
 * - Diatonic semitone: "Do₄" (base name + subscript octave)
 * - Chromatic semitone: "C4" (note name + octave digit)
 * - Cents: "204¢₄" (value + cent sign + subscript octave)
 * - Mille: "585‰₄" (value + per-mille sign + subscript octave)
 */
export function gridLabel(
	pitch: PitchSpecification,
	midiNote: number,
	mode: PaletteMode,
	baseName: string,
	pitchSystem: PitchSystem = 'relative',
	baseMidiOffset?: number
): string {
	// For relative mode with baseMidiOffset, derive octave from the offset
	const octave = (pitchSystem === 'relative' && baseMidiOffset !== undefined)
		? Math.floor(baseMidiOffset / 12)
		: Math.floor((midiNote - C0_MIDI) / 12);

	// Absolute mode always uses note name + octave
	if (pitchSystem === 'absolute' && pitch.kind === 'semitone') {
		// For diatonic mode, use baseName to preserve enharmonic spelling (e.g. Bb not A#)
		if (mode === 'diatonic') {
			return `${baseName}${octave}`;
		}
		const name = chromaticName(Math.round(midiNote) - C0_MIDI);
		return `${name}${octave}`;
	}

	switch (pitch.kind) {
		case 'semitone':
			if (mode === 'diatonic' || pitchSystem === 'relative') {
				return `${baseName}${subscriptDigit(octave)}`;
			}
			// absolute chromatic: "C4", "C#4"
			return `${baseName}${octave}`;
		case 'cents':
			return `${pitch.cents}¢${subscriptDigit(octave)}`;
		case 'mille':
			return `${pitch.mille}‰${subscriptDigit(octave)}`;
	}
}
