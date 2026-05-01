import type { PitchSpecification } from './note.js';

/** A template note in the palette */
export interface PaletteEntry {
	/** Unique entry identifier */
	entryId: string;
	/** Base pitch (before octave modifier) */
	basePitch: PitchSpecification;
	/** Display name (e.g. "C", "Do") */
	name: string;
	/** CSS colour string */
	color: string;
	/** Sort order within the palette */
	order: number;
}

/** Palette mode determines which set of notes is available */
export type PaletteMode = 'chromatic' | 'diatonic' | 'microtonal';

/** Top-level pitch system: absolute (C4, D4) or relative (Do, Re with transposable ref) */
export type PitchSystem = 'absolute' | 'relative';
