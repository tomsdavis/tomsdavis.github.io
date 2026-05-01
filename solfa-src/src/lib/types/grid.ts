import type { Note } from './note.js';

/** A single cell in the grid — either contains a note or is empty */
export type GridCell = Note | null;

/** Position within the grid */
export interface GridPosition {
	row: number;
	col: number;
}

/** The grid data structure */
export interface Grid {
	/** Number of columns per row */
	columns: number;
	/** Flat array of cells in row-major order */
	cells: GridCell[];
}

/** Where a drag operation lands */
export type DropTarget =
	| { kind: 'cell'; position: GridPosition }
	| { kind: 'between'; position: GridPosition; side: 'before' | 'after' }
	| { kind: 'end-of-row'; row: number }
	| { kind: 'outside' };
