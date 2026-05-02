<script lang="ts">
	import type { GridCell } from '$lib/types/grid';
	import { appState } from '$lib/stores/app-state.svelte';
	import { audioState } from '$lib/stores/audio-state.svelte';
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { resolvePlaybackMidi } from '$lib/audio/pitch';
	import { draggable } from '$lib/actions/draggable';
	import { dragState } from '$lib/stores/drag-state.svelte';
	import NoteDisplay from './NoteDisplay.svelte';

	interface Props {
		cell: GridCell;
		row: number;
		col: number;
	}

	let { cell, row, col }: Props = $props();

	// Track active voice IDs for this cell (supports multitouch)
	let activeVoices = $state(new Map<number, string>());

	let playing = $derived(activeVoices.size > 0);

	let dropHighlight = $derived.by(() => {
		if (!dragState.current?.dropTarget) return 'none';
		const dt = dragState.current.dropTarget;
		if (dt.kind === 'cell' && dt.position.row === row && dt.position.col === col) {
			return 'replace';
		}
		if (dt.kind === 'between' && dt.position.row === row && dt.position.col === col) {
			return dt.side;
		}
		return 'none';
	});

	function onPointerDown(e: PointerEvent) {
		if (appState.mode !== 'playback') return;
		if (!cell) return;

		// Synchronous chain so iOS Safari's user-gesture validation holds
		// from this event all the way to OscillatorNode.start().
		audioState.ensureReady();
		const voiceId = audioState.playNoteByMidi(resolvePlaybackMidi(cell, paletteState.refMidi));
		if (voiceId) {
			activeVoices = new Map([...activeVoices, [e.pointerId, voiceId]]);
		}

		e.preventDefault();
	}

	function stopVoice(pointerId: number): boolean {
		const voiceId = activeVoices.get(pointerId);
		if (voiceId) {
			audioState.stopNote(voiceId);
			const next = new Map(activeVoices);
			next.delete(pointerId);
			activeVoices = next;
			return true;
		}
		return false;
	}

	function onPointerUp(e: PointerEvent) {
		stopVoice(e.pointerId);
	}

	function onPointerCancel(e: PointerEvent) {
		onPointerUp(e);
	}

	function onPointerLeave(e: PointerEvent) {
		// Only stop already-playing voices; don't mark as released-before-start.
		// pointerleave fires on slight movement (especially touch without capture),
		// and pointerup will follow to handle the actual release.
		stopVoice(e.pointerId);
	}
</script>

<div
	class="grid-cell"
	class:occupied={cell !== null}
	class:playback-mode={appState.mode === 'playback' && cell !== null}
	class:drop-replace={dropHighlight === 'replace'}
	class:drop-before={dropHighlight === 'before'}
	class:drop-after={dropHighlight === 'after'}
	data-row={row}
	data-col={col}
	role={appState.mode === 'playback' && cell ? 'button' : undefined}
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
	onpointerleave={onPointerLeave}
	use:draggable={{
		enabled: appState.mode === 'composition' && cell !== null,
		source: () => ({
			kind: 'grid',
			position: { row, col },
			note: cell!
		})
	}}
>
	{#if cell}
		<NoteDisplay label={cell.label} color={cell.color} {playing} />
	{/if}
</div>

<style>
	.grid-cell {
		width: var(--cell-size);
		height: var(--cell-size);
		border-radius: var(--cell-radius);
		background: var(--bg-cell-empty);
		border: 2px solid transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.1s;
		touch-action: none;
	}

	.grid-cell.occupied {
		background: transparent;
	}

	.grid-cell.playback-mode {
		cursor: pointer;
	}

	.grid-cell.drop-replace {
		border-color: var(--accent);
	}

	.grid-cell.drop-before {
		border-left: 3px solid var(--accent);
	}

	.grid-cell.drop-after {
		border-right: 3px solid var(--accent);
	}
</style>
