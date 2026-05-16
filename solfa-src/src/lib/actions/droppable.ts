import type { DropTarget, GridPosition } from '$lib/types/grid.js';
import { DROP_ZONE_EDGE } from '$lib/constants.js';

export interface DroppableOptions {
	position: GridPosition;
	enabled?: boolean;
}

/**
 * Determine the drop target based on where within a cell element the pointer is.
 * Left 20% = insert-before, middle 60% = cell (replace), right 20% = insert-after.
 */
export function hitTestCell(
	element: HTMLElement,
	clientX: number,
	position: GridPosition
): DropTarget {
	const rect = element.getBoundingClientRect();
	const relativeX = (clientX - rect.left) / rect.width;

	if (relativeX < DROP_ZONE_EDGE) {
		return { kind: 'between', position, side: 'before' };
	} else if (relativeX > 1 - DROP_ZONE_EDGE) {
		return { kind: 'between', position, side: 'after' };
	} else {
		return { kind: 'cell', position };
	}
}

/**
 * Find the grid cell element under a point using document.elementsFromPoint.
 * Returns the element and its row/col data attributes if found.
 */
export function findCellAtPoint(
	x: number,
	y: number
): { element: HTMLElement; row: number; col: number } | null {
	const elements = document.elementsFromPoint(x, y);
	for (const el of elements) {
		if (el instanceof HTMLElement && el.dataset.row !== undefined && el.dataset.col !== undefined) {
			return {
				element: el,
				row: parseInt(el.dataset.row, 10),
				col: parseInt(el.dataset.col, 10)
			};
		}
	}
	return null;
}

function findEndOfRowAtPoint(x: number, y: number): { row: number } | null {
	for (const el of document.elementsFromPoint(x, y)) {
		if (el instanceof HTMLElement && el.dataset.endOfRow !== undefined) {
			return { row: parseInt(el.dataset.endOfRow, 10) };
		}
	}
	return null;
}

/**
 * Determine the full drop target at a given pointer position.
 */
export function resolveDropTarget(x: number, y: number): DropTarget {
	const cell = findCellAtPoint(x, y);
	if (cell) return hitTestCell(cell.element, x, { row: cell.row, col: cell.col });
	const eor = findEndOfRowAtPoint(x, y);
	if (eor) return { kind: 'end-of-row', row: eor.row };
	return { kind: 'outside' };
}
