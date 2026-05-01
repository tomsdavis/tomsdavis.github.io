import { describe, it, expect, beforeEach } from 'vitest';
import { GridState } from '$lib/stores/grid-state.svelte';
import type { Note } from '$lib/types/note';

function makeNote(id: string, label = 'C4'): Note {
	return {
		id,
		pitch: { kind: 'semitone', semitones: 48 },
		midiNote: 60,
		label,
		color: '#e74c3c'
	};
}

describe('GridState', () => {
	let grid: GridState;

	beforeEach(() => {
		grid = new GridState(8, 4);
	});

	describe('initialization', () => {
		it('creates a grid with the correct number of cells', () => {
			expect(grid.cells.length).toBe(32); // 8 cols * 4 rows
		});

		it('all cells start as null', () => {
			for (const cell of grid.cells) {
				expect(cell).toBeNull();
			}
		});

		it('stores columns and rows', () => {
			expect(grid.columns).toBe(8);
			expect(grid.rows).toBe(4);
		});
	});

	describe('getCell / setCell', () => {
		it('getCell returns null for empty cell', () => {
			expect(grid.getCell(0, 0)).toBeNull();
		});

		it('setCell places a note and getCell retrieves it', () => {
			const note = makeNote('n1');
			grid.setCell(1, 2, note);
			expect(grid.getCell(1, 2)).toEqual(note);
		});

		it('setCell with null clears a cell', () => {
			const note = makeNote('n1');
			grid.setCell(0, 0, note);
			grid.setCell(0, 0, null);
			expect(grid.getCell(0, 0)).toBeNull();
		});
	});

	describe('placeNote', () => {
		it('places note on empty cell', () => {
			const note = makeNote('n1');
			grid.placeNote(0, 0, note);
			expect(grid.getCell(0, 0)).toEqual(note);
		});

		it('replaces existing note on occupied cell', () => {
			const note1 = makeNote('n1', 'C4');
			const note2 = makeNote('n2', 'D4');
			grid.placeNote(0, 0, note1);
			grid.placeNote(0, 0, note2);
			expect(grid.getCell(0, 0)?.id).toBe('n2');
		});
	});

	describe('removeNote', () => {
		it('removes note and leaves cell empty', () => {
			const note = makeNote('n1');
			grid.placeNote(0, 0, note);
			grid.removeNote(0, 0);
			expect(grid.getCell(0, 0)).toBeNull();
		});

		it('removing from empty cell is a no-op', () => {
			grid.removeNote(0, 0); // should not throw
			expect(grid.getCell(0, 0)).toBeNull();
		});
	});

	describe('toIndex / fromIndex', () => {
		it('converts row,col to flat index', () => {
			expect(grid.toIndex(0, 0)).toBe(0);
			expect(grid.toIndex(0, 7)).toBe(7);
			expect(grid.toIndex(1, 0)).toBe(8);
			expect(grid.toIndex(2, 3)).toBe(19);
		});

		it('converts flat index to row,col', () => {
			expect(grid.fromIndex(0)).toEqual({ row: 0, col: 0 });
			expect(grid.fromIndex(7)).toEqual({ row: 0, col: 7 });
			expect(grid.fromIndex(8)).toEqual({ row: 1, col: 0 });
			expect(grid.fromIndex(19)).toEqual({ row: 2, col: 3 });
		});
	});

	describe('addRow', () => {
		it('adds a new empty row', () => {
			grid.addRow();
			expect(grid.rows).toBe(5);
			expect(grid.cells.length).toBe(40);
			// New cells should be null
			for (let col = 0; col < 8; col++) {
				expect(grid.getCell(4, col)).toBeNull();
			}
		});

		it('preserves existing notes when adding row', () => {
			const note = makeNote('n1');
			grid.placeNote(0, 0, note);
			grid.addRow();
			expect(grid.getCell(0, 0)).toEqual(note);
		});
	});

	describe('clear', () => {
		it('clears all cells', () => {
			grid.placeNote(0, 0, makeNote('n1'));
			grid.placeNote(1, 3, makeNote('n2'));
			grid.clear();
			for (const cell of grid.cells) {
				expect(cell).toBeNull();
			}
		});
	});
});
