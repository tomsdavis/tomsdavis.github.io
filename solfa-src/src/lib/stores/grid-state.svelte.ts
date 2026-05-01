import type { Note } from '$lib/types/note.js';
import type { GridCell } from '$lib/types/grid.js';

export class GridState {
	columns: number;
	cells: GridCell[] = $state([]);

	constructor(columns: number, rows: number) {
		this.columns = columns;
		this.cells = new Array(columns * rows).fill(null);
	}

	get rows(): number {
		return Math.ceil(this.cells.length / this.columns);
	}

	toIndex(row: number, col: number): number {
		return row * this.columns + col;
	}

	fromIndex(index: number): { row: number; col: number } {
		return {
			row: Math.floor(index / this.columns),
			col: index % this.columns
		};
	}

	getCell(row: number, col: number): GridCell {
		return this.cells[this.toIndex(row, col)];
	}

	setCell(row: number, col: number, value: GridCell): void {
		this.cells[this.toIndex(row, col)] = value;
	}

	placeNote(row: number, col: number, note: Note): void {
		this.setCell(row, col, note);
	}

	removeNote(row: number, col: number): void {
		this.setCell(row, col, null);
	}

	addRow(): void {
		for (let i = 0; i < this.columns; i++) {
			this.cells.push(null);
		}
	}

	clear(): void {
		for (let i = 0; i < this.cells.length; i++) {
			this.cells[i] = null;
		}
	}
}
