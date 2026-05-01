import type { GridCell } from '$lib/types/grid.js';
import type { Note } from '$lib/types/note.js';
import type { PaletteEntry, PaletteMode, PitchSystem } from '$lib/types/palette.js';
import type { SerializedGrid, SerializedPalette, SerializedAppState } from '$lib/types/serialization.js';
import { C0_MIDI } from '$lib/constants.js';
import { pitchToMidi } from '$lib/audio/pitch.js';

const CURRENT_VERSION = 4;

// --- Grid ---

export function serializeGrid(cells: GridCell[], columns: number): string {
	const data: SerializedGrid = {
		version: CURRENT_VERSION,
		columns,
		cells
	};
	return JSON.stringify(data);
}

export function deserializeGrid(json: string): SerializedGrid {
	const data: SerializedGrid = JSON.parse(json);
	return data;
}

// --- Palette ---

export function serializePalette(
	entries: PaletteEntry[],
	mode: PaletteMode,
	refMidi: number,
	pitchSystem: PitchSystem = 'relative',
	paletteOctave: number = 0,
	diatonicKey: string = 'C'
): string {
	const data: SerializedPalette = {
		version: CURRENT_VERSION,
		mode,
		entries,
		refMidi,
		pitchSystem,
		paletteOctave,
		diatonicKey
	};
	return JSON.stringify(data);
}

export function deserializePalette(json: string): SerializedPalette {
	const raw = JSON.parse(json);
	return migratePalette(raw);
}

function migratePalette(data: SerializedPalette & { octave?: number }): SerializedPalette {
	let result = data;
	if (result.version < 2) {
		// v1 used octave (integer), refMidi didn't exist; root was always C
		const octave = result.octave ?? 4;
		result = { ...result, version: 2, refMidi: C0_MIDI + octave * 12 };
	}
	// Default pitchSystem for pre-v3 data
	if (!result.pitchSystem) {
		result = { ...result, pitchSystem: 'relative' };
	}
	// Default paletteOctave for pre-v4 data
	if (result.paletteOctave === undefined) {
		result = {
			...result,
			paletteOctave: result.pitchSystem === 'absolute' ? 4 : 0
		};
	}
	// Default diatonicKey
	if (!result.diatonicKey) {
		result = { ...result, diatonicKey: 'C' };
	}
	return result;
}

/** Migrate grid cells from v2 (no midiNote) to v3 (with midiNote), and v3 to v4 (with baseMidiOffset) */
function migrateGrid(grid: SerializedGrid, refMidi: number, pitchSystem: PitchSystem = 'relative'): SerializedGrid {
	let cells = grid.cells;

	// v2 → v3: compute midiNote from pitch + refMidi
	if (grid.version < 3) {
		cells = cells.map((cell) => {
			if (!cell) return null;
			if ((cell as Note).midiNote === undefined) {
				return { ...cell, midiNote: pitchToMidi(cell.pitch, refMidi) };
			}
			return cell;
		});
	}

	// v3 → v4: compute baseMidiOffset for relative-mode notes
	if (grid.version < 4) {
		cells = cells.map((cell) => {
			if (!cell) return null;
			if (pitchSystem === 'relative' && (cell as Note).baseMidiOffset === undefined) {
				return { ...cell, baseMidiOffset: cell.midiNote - refMidi };
			}
			return cell;
		});
	}

	return { ...grid, version: CURRENT_VERSION, cells };
}

// --- Full App State ---

export function serializeAppState(
	cells: GridCell[],
	columns: number,
	entries: PaletteEntry[],
	mode: PaletteMode,
	refMidi: number,
	pitchSystem: PitchSystem = 'relative',
	paletteOctave: number = 0,
	diatonicKey: string = 'C'
): string {
	const data: SerializedAppState = {
		version: CURRENT_VERSION,
		grid: {
			version: CURRENT_VERSION,
			columns,
			cells
		},
		palette: {
			version: CURRENT_VERSION,
			mode,
			entries,
			refMidi,
			pitchSystem,
			paletteOctave,
			diatonicKey
		}
	};
	return JSON.stringify(data);
}

export function deserializeAppState(json: string): SerializedAppState {
	const raw = JSON.parse(json);
	const palette = migratePalette(raw.palette);
	const grid = migrateGrid(raw.grid, palette.refMidi, palette.pitchSystem);
	return { ...raw, palette, grid };
}

// --- localStorage helpers ---

const APP_STATE_STORAGE_KEY = 'solfa2-state';

export function saveToLocalStorage(
	cells: GridCell[],
	columns: number,
	entries: PaletteEntry[],
	mode: PaletteMode,
	refMidi: number,
	pitchSystem: PitchSystem = 'relative',
	paletteOctave: number = 0,
	diatonicKey: string = 'C'
): void {
	const json = serializeAppState(cells, columns, entries, mode, refMidi, pitchSystem, paletteOctave, diatonicKey);
	localStorage.setItem(APP_STATE_STORAGE_KEY, json);
}

export function loadFromLocalStorage(): SerializedAppState | null {
	const json = localStorage.getItem(APP_STATE_STORAGE_KEY);
	if (!json) return null;
	try {
		return deserializeAppState(json);
	} catch {
		return null;
	}
}

export function listSaves(): string[] {
	const saves: string[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (key?.startsWith('solfa2-save-')) {
			saves.push(key.replace('solfa2-save-', ''));
		}
	}
	return saves.sort();
}

export function saveNamed(
	name: string,
	cells: GridCell[],
	columns: number,
	entries: PaletteEntry[],
	mode: PaletteMode,
	refMidi: number,
	pitchSystem: PitchSystem = 'relative',
	paletteOctave: number = 0,
	diatonicKey: string = 'C'
): void {
	const json = serializeAppState(cells, columns, entries, mode, refMidi, pitchSystem, paletteOctave, diatonicKey);
	localStorage.setItem(`solfa2-save-${name}`, json);
}

export function loadNamed(name: string): SerializedAppState | null {
	const json = localStorage.getItem(`solfa2-save-${name}`);
	if (!json) return null;
	try {
		return deserializeAppState(json);
	} catch {
		return null;
	}
}

export function deleteNamed(name: string): void {
	localStorage.removeItem(`solfa2-save-${name}`);
}
