<script lang="ts">
	import type { PaletteEntry } from '$lib/types/palette';
	import { appState } from '$lib/stores/app-state.svelte';
	import { audioState } from '$lib/stores/audio-state.svelte';
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { draggable } from '$lib/actions/draggable';
	import NoteDisplay from './NoteDisplay.svelte';

	interface Props {
		entry: PaletteEntry;
		displayLabel?: string;
	}

	let { entry, displayLabel }: Props = $props();

	let activeVoices = $state(new Map<number, string>());
	let playing = $derived(activeVoices.size > 0);

	function onPointerDown(e: PointerEvent) {
		if (appState.mode !== 'playback') return;

		// Synchronous chain so iOS Safari's user-gesture validation holds
		// from this event all the way to OscillatorNode.start().
		audioState.ensureReady();
		const voiceId = audioState.playNote(entry.basePitch, paletteState.effectiveRefMidiForPalette);
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
	class="palette-entry"
	class:playback-mode={appState.mode === 'playback'}
	data-entry-id={entry.entryId}
	role={appState.mode === 'playback' ? 'button' : undefined}
	onpointerdown={onPointerDown}
	onpointerup={onPointerUp}
	onpointercancel={onPointerCancel}
	onpointerleave={onPointerLeave}
	use:draggable={{
		enabled: appState.mode === 'composition',
		source: () => ({
			kind: 'palette',
			entryId: entry.entryId,
			pitch: entry.basePitch,
			label: entry.name,
			color: entry.color
		})
	}}
>
	<NoteDisplay label={displayLabel ?? entry.name} color={entry.color} small {playing} />
</div>

<style>
	.palette-entry {
		width: 56px;
		height: 56px;
		cursor: grab;
		touch-action: none;
	}

	.palette-entry:active {
		cursor: grabbing;
	}

	.palette-entry.playback-mode {
		cursor: pointer;
	}
</style>
