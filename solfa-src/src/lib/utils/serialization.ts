import type { GridCell } from '$lib/types/grid.js';
import type { PaletteEntry, PaletteMode, PitchSystem } from '$lib/types/palette.js';
import type { SerializedGrid, SerializedPalette, SerializedAppState } from '$lib/types/serialization.js';
import { readFile, writeFile, deleteEntry, scanTree, OpfsError } from '$lib/storage/opfs.js';

const CURRENT_VERSION = 1;

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
	if (data.version !== 1) throw new Error('Unsupported file version');
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
	const data: SerializedPalette = JSON.parse(json);
	if (data.version !== 1) throw new Error('Unsupported file version');
	return data;
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
	if (raw.version !== 1) throw new Error('Unsupported file version');
	if (raw.palette?.version !== 1) throw new Error('Unsupported file version');
	if (raw.grid?.version !== 1) throw new Error('Unsupported file version');
	return raw as SerializedAppState;
}

// --- OPFS-backed named save helpers ---

export async function listSaves(): Promise<string[]> {
	const tree = await scanTree();
	const saves: string[] = [];
	for (const node of tree.children ?? []) {
		if (node.type === 'file' && node.name.endsWith('.solfa.json')) {
			saves.push(node.name.slice(0, -'.solfa.json'.length));
		}
	}
	return saves.sort();
}

export async function saveNamed(
	name: string,
	cells: GridCell[],
	columns: number,
	entries: PaletteEntry[],
	mode: PaletteMode,
	refMidi: number,
	pitchSystem: PitchSystem = 'relative',
	paletteOctave: number = 0,
	diatonicKey: string = 'C'
): Promise<void> {
	const json = serializeAppState(cells, columns, entries, mode, refMidi, pitchSystem, paletteOctave, diatonicKey);
	await writeFile(`/${name}.solfa.json`, json);
}

export async function loadNamed(name: string): Promise<SerializedAppState | null> {
	try {
		const json = await readFile(`/${name}.solfa.json`);
		return deserializeAppState(json);
	} catch (e) {
		if (e instanceof OpfsError && e.code === 'NOT_FOUND') return null;
		throw e;
	}
}

export async function deleteNamed(name: string): Promise<void> {
	try {
		await deleteEntry(`/${name}.solfa.json`);
	} catch (e) {
		if (e instanceof OpfsError && e.code === 'NOT_FOUND') return;
		throw e;
	}
}
