import type { DragOperation } from '$lib/stores/drag-state.svelte.js';
import type { Note } from '$lib/types/note.js';
import type { PaletteMode, PitchSystem } from '$lib/types/palette.js';
import { GridState } from '$lib/stores/grid-state.svelte.js';
import { insertAndShift, moveNote, moveWithInsert } from '$lib/utils/grid-operations.js';
import { pitchToMidi } from '$lib/audio/pitch.js';
import { gridLabel } from '$lib/utils/note-names.js';
import { C0_MIDI } from '$lib/constants.js';

let noteCounter = 0;

function generateNoteId(): string {
	return `note-${++noteCounter}-${Date.now()}`;
}

/**
 * Handle a completed drag-and-drop operation.
 * This is the central drop logic that modifies the grid state.
 */
export function handleDrop(
	op: DragOperation | null,
	gridState: GridState,
	refMidi: number,
	paletteMode: PaletteMode,
	pitchSystem: PitchSystem = 'relative',
	paletteOctave: number = 0
): void {
	if (!op || !op.dropTarget) return;

	const target = op.dropTarget;

	if (target.kind === 'outside') {
		// If dragging from grid, delete the note
		if (op.source.kind === 'grid') {
			gridState.removeNote(op.source.position.row, op.source.position.col);
		}
		return;
	}

	// Create the note to place
	let note: Note;
	if (op.source.kind === 'palette') {
		if (pitchSystem === 'relative') {
			const baseMidiOffset = pitchToMidi(op.source.pitch, paletteOctave * 12);
			const midiNote = baseMidiOffset + refMidi;
			const label = gridLabel(op.source.pitch, midiNote, paletteMode, op.source.label, pitchSystem, baseMidiOffset);
			note = {
				id: generateNoteId(),
				pitch: op.source.pitch,
				midiNote,
				label,
				color: op.source.color,
				baseMidiOffset
			};
		} else {
			const midiNote = pitchToMidi(op.source.pitch, C0_MIDI + paletteOctave * 12);
			const label = gridLabel(op.source.pitch, midiNote, paletteMode, op.source.label, pitchSystem);
			note = {
				id: generateNoteId(),
				pitch: op.source.pitch,
				midiNote,
				label,
				color: op.source.color
			};
		}
	} else {
		note = { ...op.source.note };
	}

	if (target.kind === 'cell') {
		if (op.source.kind === 'grid') {
			// Grid-to-grid move (simple replace)
			gridState.cells = moveNote(
				gridState.cells,
				gridState.columns,
				op.source.position.row,
				op.source.position.col,
				target.position.row,
				target.position.col
			);
		} else {
			// Palette-to-grid place/replace
			gridState.placeNote(target.position.row, target.position.col, note);
		}
	} else if (target.kind === 'between') {
		// Calculate the actual insert position
		const insertCol = target.side === 'after' ? target.position.col + 1 : target.position.col;
		const insertRow = insertCol >= gridState.columns ? target.position.row + 1 : target.position.row;
		const finalCol = insertCol >= gridState.columns ? 0 : insertCol;

		if (op.source.kind === 'grid') {
			// Grid-to-grid insert-and-shift
			gridState.cells = moveWithInsert(
				gridState.cells,
				gridState.columns,
				op.source.position.row,
				op.source.position.col,
				insertRow,
				finalCol
			);
		} else {
			// Palette-to-grid insert-and-shift
			gridState.cells = insertAndShift(
				gridState.cells,
				gridState.columns,
				insertRow,
				finalCol,
				note
			);
		}
	} else if (target.kind === 'end-of-row') {
		// Insert at the beginning of the next row
		const insertRow = target.row + 1;
		if (op.source.kind === 'grid') {
			gridState.cells = moveWithInsert(
				gridState.cells,
				gridState.columns,
				op.source.position.row,
				op.source.position.col,
				insertRow,
				0
			);
		} else {
			gridState.cells = insertAndShift(
				gridState.cells,
				gridState.columns,
				insertRow,
				0,
				note
			);
		}
	}
}
