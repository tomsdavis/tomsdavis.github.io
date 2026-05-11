import type { GridCell } from './grid.js';
import type { PaletteEntry, PaletteMode, PitchSystem } from './palette.js';

/** Serialized grid format */
export interface SerializedGrid {
	version: number;
	columns: number;
	cells: GridCell[];
}

/** Serialized palette format (v1) */
export interface SerializedPalette {
	version: number;
	mode: PaletteMode;
	entries: PaletteEntry[];
	refMidi: number;
	pitchSystem: PitchSystem;
	paletteOctave: number;
	diatonicKey: string;
}

/** Complete serialized app state */
export interface SerializedAppState {
	version: number;
	grid: SerializedGrid;
	palette: SerializedPalette;
}
