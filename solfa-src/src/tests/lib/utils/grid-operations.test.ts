import { describe, it, expect, beforeEach } from 'vitest';
import {
	insertAndShift,
	moveNote,
	moveWithInsert
} from '$lib/utils/grid-operations';
import type { Note } from '$lib/types/note';
import type { GridCell } from '$lib/types/grid';

function makeNote(id: string, label = 'C4'): Note {
	return {
		id,
		pitch: { kind: 'semitone', semitones: 48 },
		midiNote: 60,
		label,
		color: '#e74c3c'
	};
}

function makeCells(columns: number, rows: number): GridCell[] {
	return new Array(columns * rows).fill(null);
}

function placeAt(cells: GridCell[], columns: number, row: number, col: number, note: Note) {
	cells[row * columns + col] = note;
}

function getAt(cells: GridCell[], columns: number, row: number, col: number): GridCell {
	return cells[row * columns + col];
}

describe('grid-operations', () => {
	describe('insertAndShift', () => {
		it('inserts note at position and shifts subsequent notes right', () => {
			const columns = 4;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 1, makeNote('n1', 'D4'));
			placeAt(cells, columns, 0, 2, makeNote('n2', 'E4'));

			const result = insertAndShift(cells, columns, 0, 1, makeNote('new', 'C4'));

			expect(getAt(result, columns, 0, 1)?.id).toBe('new');
			expect(getAt(result, columns, 0, 2)?.id).toBe('n1');
			expect(getAt(result, columns, 0, 3)?.id).toBe('n2');
		});

		it('stops shifting at first empty cell', () => {
			const columns = 4;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 0, makeNote('n1'));
			// cells[1] is empty, so shift should stop after one move
			placeAt(cells, columns, 0, 2, makeNote('n2'));

			const result = insertAndShift(cells, columns, 0, 0, makeNote('new'));

			expect(getAt(result, columns, 0, 0)?.id).toBe('new');
			expect(getAt(result, columns, 0, 1)?.id).toBe('n1');
			// n2 should be unchanged since the shift stopped at the empty cell
			expect(getAt(result, columns, 0, 2)?.id).toBe('n2');
		});

		it('wraps notes across row boundaries', () => {
			const columns = 3;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 1, makeNote('n1'));
			placeAt(cells, columns, 0, 2, makeNote('n2'));

			const result = insertAndShift(cells, columns, 0, 1, makeNote('new'));

			expect(getAt(result, columns, 0, 1)?.id).toBe('new');
			expect(getAt(result, columns, 0, 2)?.id).toBe('n1');
			expect(getAt(result, columns, 1, 0)?.id).toBe('n2');
		});

		it('adds a new row when grid is full and all cells are occupied', () => {
			const columns = 2;
			const cells = makeCells(columns, 1);
			placeAt(cells, columns, 0, 0, makeNote('n1'));
			placeAt(cells, columns, 0, 1, makeNote('n2'));

			const result = insertAndShift(cells, columns, 0, 0, makeNote('new'));

			// Grid should now have 4 cells (2 rows)
			expect(result.length).toBe(4);
			expect(getAt(result, columns, 0, 0)?.id).toBe('new');
			expect(getAt(result, columns, 0, 1)?.id).toBe('n1');
			expect(getAt(result, columns, 1, 0)?.id).toBe('n2');
		});

		it('inserts at the end of a row', () => {
			const columns = 3;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 0, makeNote('n1'));

			const result = insertAndShift(cells, columns, 0, 2, makeNote('new'));

			expect(getAt(result, columns, 0, 0)?.id).toBe('n1');
			expect(getAt(result, columns, 0, 2)?.id).toBe('new');
		});

		it('inserts into completely empty grid', () => {
			const columns = 3;
			const cells = makeCells(columns, 2);

			const result = insertAndShift(cells, columns, 0, 0, makeNote('new'));

			expect(getAt(result, columns, 0, 0)?.id).toBe('new');
		});

		it('handles consecutive occupied cells across multiple rows', () => {
			const columns = 2;
			const cells = makeCells(columns, 3);
			placeAt(cells, columns, 0, 0, makeNote('n1'));
			placeAt(cells, columns, 0, 1, makeNote('n2'));
			placeAt(cells, columns, 1, 0, makeNote('n3'));
			placeAt(cells, columns, 1, 1, makeNote('n4'));

			const result = insertAndShift(cells, columns, 0, 0, makeNote('new'));

			expect(getAt(result, columns, 0, 0)?.id).toBe('new');
			expect(getAt(result, columns, 0, 1)?.id).toBe('n1');
			expect(getAt(result, columns, 1, 0)?.id).toBe('n2');
			expect(getAt(result, columns, 1, 1)?.id).toBe('n3');
			expect(getAt(result, columns, 2, 0)?.id).toBe('n4');
		});
	});

	describe('moveNote', () => {
		it('moves note from source to empty target', () => {
			const columns = 4;
			const cells = makeCells(columns, 2);
			const note = makeNote('n1');
			placeAt(cells, columns, 0, 0, note);

			const result = moveNote(cells, columns, 0, 0, 1, 2);

			expect(getAt(result, columns, 0, 0)).toBeNull();
			expect(getAt(result, columns, 1, 2)?.id).toBe('n1');
		});

		it('replaces existing note at target', () => {
			const columns = 4;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 0, makeNote('n1'));
			placeAt(cells, columns, 0, 1, makeNote('n2'));

			const result = moveNote(cells, columns, 0, 0, 0, 1);

			expect(getAt(result, columns, 0, 0)).toBeNull();
			expect(getAt(result, columns, 0, 1)?.id).toBe('n1');
		});

		it('returns same cells if source is empty', () => {
			const columns = 4;
			const cells = makeCells(columns, 2);

			const result = moveNote(cells, columns, 0, 0, 1, 1);

			expect(result).toEqual(cells);
		});
	});

	describe('moveWithInsert', () => {
		it('removes source note and inserts at target position', () => {
			const columns = 4;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 0, makeNote('n1'));
			placeAt(cells, columns, 0, 2, makeNote('n2'));
			placeAt(cells, columns, 0, 3, makeNote('n3'));

			const result = moveWithInsert(cells, columns, 0, 0, 0, 2);

			expect(getAt(result, columns, 0, 0)).toBeNull();
			expect(getAt(result, columns, 0, 2)?.id).toBe('n1');
			expect(getAt(result, columns, 0, 3)?.id).toBe('n2');
			// n3 shifted to next position
			expect(getAt(result, columns, 1, 0)?.id).toBe('n3');
		});

		it('clears source and inserts correctly when moving forward', () => {
			const columns = 3;
			const cells = makeCells(columns, 2);
			placeAt(cells, columns, 0, 0, makeNote('n1'));
			placeAt(cells, columns, 0, 1, makeNote('n2'));

			const result = moveWithInsert(cells, columns, 0, 0, 0, 1);

			expect(getAt(result, columns, 0, 0)).toBeNull();
			expect(getAt(result, columns, 0, 1)?.id).toBe('n1');
			expect(getAt(result, columns, 0, 2)?.id).toBe('n2');
		});
	});
});
