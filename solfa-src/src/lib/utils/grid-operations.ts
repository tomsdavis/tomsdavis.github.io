import type { Note } from '$lib/types/note.js';
import type { GridCell } from '$lib/types/grid.js';

/**
 * Insert a note at a position in the flat cell array and shift subsequent
 * occupied cells rightward. Shifting stops at the first empty cell.
 * If all subsequent cells are occupied and the grid is full, a new row is added.
 *
 * Returns a new cells array (does not mutate the input).
 */
export function insertAndShift(
	cells: GridCell[],
	columns: number,
	row: number,
	col: number,
	note: Note
): GridCell[] {
	const result = [...cells];
	const insertIndex = row * columns + col;

	// If target is empty, just place the note
	if (result[insertIndex] === null) {
		result[insertIndex] = note;
		return result;
	}

	// Find the first empty cell at or after the insert index
	let emptyIndex = -1;
	for (let i = insertIndex; i < result.length; i++) {
		if (result[i] === null) {
			emptyIndex = i;
			break;
		}
	}

	if (emptyIndex === -1) {
		// No empty cell found — extend the grid with a new row
		for (let i = 0; i < columns; i++) {
			result.push(null);
		}
		emptyIndex = result.length - columns; // first cell of new row

		// Now find the actual first empty cell (which is the one we just added)
		for (let i = insertIndex; i < result.length; i++) {
			if (result[i] === null) {
				emptyIndex = i;
				break;
			}
		}
	}

	// Shift cells rightward from emptyIndex back to insertIndex
	for (let i = emptyIndex; i > insertIndex; i--) {
		result[i] = result[i - 1];
	}

	// Place the new note
	result[insertIndex] = note;

	return result;
}

/**
 * Move a note from one position to another (simple move, replaces target).
 * Returns a new cells array.
 */
export function moveNote(
	cells: GridCell[],
	columns: number,
	fromRow: number,
	fromCol: number,
	toRow: number,
	toCol: number
): GridCell[] {
	const fromIndex = fromRow * columns + fromCol;
	const toIndex = toRow * columns + toCol;

	if (cells[fromIndex] === null) return cells;

	const result = [...cells];
	result[toIndex] = result[fromIndex];
	result[fromIndex] = null;

	return result;
}

/**
 * Move a note from one position to another with insert-and-shift semantics.
 * The source cell is cleared first, then the note is inserted at the target.
 * Returns a new cells array.
 */
export function moveWithInsert(
	cells: GridCell[],
	columns: number,
	fromRow: number,
	fromCol: number,
	toRow: number,
	toCol: number
): GridCell[] {
	const fromIndex = fromRow * columns + fromCol;

	if (cells[fromIndex] === null) return cells;

	const note = cells[fromIndex]!;

	// Clear the source cell first
	const cleared = [...cells];
	cleared[fromIndex] = null;

	// Then insert at the target with shift
	return insertAndShift(cleared, columns, toRow, toCol, note);
}
