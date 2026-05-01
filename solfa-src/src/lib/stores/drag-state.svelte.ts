import type { Note, PitchSpecification } from '$lib/types/note.js';
import type { DropTarget, GridPosition } from '$lib/types/grid.js';

export type DragSource =
	| { kind: 'palette'; entryId: string; pitch: PitchSpecification; label: string; color: string }
	| { kind: 'grid'; position: GridPosition; note: Note };

export interface DragOperation {
	source: DragSource;
	/** Current pointer position (page coordinates) */
	x: number;
	y: number;
	/** Current drop target being hovered */
	dropTarget: DropTarget | null;
	/** Voice ID if audio is playing during drag */
	voiceId: string | null;
}

class DragState {
	current: DragOperation | null = $state(null);

	get isDragging(): boolean {
		return this.current !== null;
	}

	startDrag(source: DragSource, x: number, y: number): void {
		this.current = {
			source,
			x,
			y,
			dropTarget: null,
			voiceId: null
		};
	}

	updatePosition(x: number, y: number): void {
		if (this.current) {
			this.current.x = x;
			this.current.y = y;
		}
	}

	updateDropTarget(target: DropTarget | null): void {
		if (this.current) {
			this.current.dropTarget = target;
		}
	}

	setVoiceId(voiceId: string | null): void {
		if (this.current) {
			this.current.voiceId = voiceId;
		}
	}

	endDrag(): DragOperation | null {
		const op = this.current;
		this.current = null;
		return op;
	}
}

export const dragState = new DragState();
