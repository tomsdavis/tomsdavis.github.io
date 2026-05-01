import type { DragOperation } from '$lib/stores/drag-state.svelte.js';

type DropCallback = (op: DragOperation | null) => void;

class DropHandlerState {
	private _handler: DropCallback | null = null;

	setHandler(handler: DropCallback): void {
		this._handler = handler;
	}

	handle(op: DragOperation | null): void {
		this._handler?.(op);
	}
}

export const dropHandlerState = new DropHandlerState();
