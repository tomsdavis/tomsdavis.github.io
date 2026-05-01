import { dragState, type DragSource } from '$lib/stores/drag-state.svelte.js';
import { dropHandlerState } from '$lib/stores/drop-handler-state.js';
import { resolveDropTarget } from '$lib/actions/droppable.js';
import { audioState } from '$lib/stores/audio-state.svelte.js';
import { paletteState } from '$lib/stores/palette-state.svelte.js';
import { resolvePlaybackMidi } from '$lib/audio/pitch.js';
import { DRAG_THRESHOLD } from '$lib/constants.js';

export interface DraggableOptions {
	/** Factory function that returns the drag source when a drag starts */
	source: () => DragSource;
	/** Whether dragging is currently enabled */
	enabled?: boolean;
}

/**
 * Svelte action that makes an element a drag source via Pointer Events.
 * Uses document-level listeners (no pointer capture) so elementsFromPoint works for hit-testing.
 */
export function draggable(node: HTMLElement, options: DraggableOptions) {
	let opts = options;
	let startX = 0;
	let startY = 0;
	let dragging = false; // true once DRAG_THRESHOLD exceeded

	function onPointerDown(e: PointerEvent) {
		if (opts.enabled === false) return;
		if (e.button !== 0) return;
		if (dragState.isDragging) return;

		startX = e.clientX;
		startY = e.clientY;
		dragging = false;

		const source = opts.source();
		dragState.startDrag(source, e.clientX, e.clientY);

		// Start audio preview immediately
		audioState.ensureReady().then(() => {
			if (dragState.isDragging) {
				let voiceId: string | null;
				if (source.kind === 'grid') {
					voiceId = audioState.playNoteByMidi(resolvePlaybackMidi(source.note, paletteState.refMidi));
				} else {
					voiceId = audioState.playNote(source.pitch, paletteState.effectiveRefMidiForPalette);
				}
				dragState.setVoiceId(voiceId);
			}
		});

		document.addEventListener('pointermove', onDocumentPointerMove);
		document.addEventListener('pointerup', onDocumentPointerUp);

		e.preventDefault();
	}

	function onDocumentPointerMove(e: PointerEvent) {
		if (!dragState.isDragging) return;

		dragState.updatePosition(e.clientX, e.clientY);

		if (!dragging) {
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
			dragging = true;
		}

		// Hit-test for drop target
		const target = resolveDropTarget(e.clientX, e.clientY);
		dragState.updateDropTarget(target);

		e.preventDefault();
	}

	function onDocumentPointerUp(e: PointerEvent) {
		document.removeEventListener('pointermove', onDocumentPointerMove);
		document.removeEventListener('pointerup', onDocumentPointerUp);

		// Stop audio preview
		if (dragState.current?.voiceId) {
			audioState.stopNote(dragState.current.voiceId);
		}

		if (!dragging) {
			// Pointer didn't move enough — treat as a click, cancel the drag
			dragState.endDrag();
			dragging = false;
			return;
		}

		dragging = false;

		// Final hit-test at release position (pointermove may not have fired here)
		const target = resolveDropTarget(e.clientX, e.clientY);
		dragState.updateDropTarget(target);

		const op = dragState.endDrag();
		dropHandlerState.handle(op);
	}

	node.addEventListener('pointerdown', onPointerDown);
	node.addEventListener('contextmenu', (e) => e.preventDefault());

	return {
		update(newOptions: DraggableOptions) {
			opts = newOptions;
		},
		destroy() {
			node.removeEventListener('pointerdown', onPointerDown);
			document.removeEventListener('pointermove', onDocumentPointerMove);
			document.removeEventListener('pointerup', onDocumentPointerUp);
		}
	};
}
