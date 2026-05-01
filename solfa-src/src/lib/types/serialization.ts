import type { GridCell } from './grid.js';
import type { PaletteEntry, PaletteMode, PitchSystem } from './palette.js';

/** Serialized grid format */
export interface SerializedGrid {
	version: number;
	columns: number;
	cells: GridCell[];
}

/** Serialized palette format (v2+) */
export interface SerializedPalette {
	version: number;
	mode: PaletteMode;
	entries: PaletteEntry[];
	refMidi: number;
	/** Top-level pitch system (v3+, defaults to 'relative' for migration) */
	pitchSystem?: PitchSystem;
	/** Palette octave (v4+, defaults to 0 for relative, 4 for absolute) */
	paletteOctave?: number;
	/** Diatonic key for absolute diatonic mode (defaults to 'C') */
	diatonicKey?: string;
	/** @deprecated v1 only — use refMidi */
	octave?: number;
}

/** Complete serialized app state */
export interface SerializedAppState {
	version: number;
	grid: SerializedGrid;
	palette: SerializedPalette;
}
