<script lang="ts">
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import PaletteEntryComponent from './PaletteEntry.svelte';
	import OctaveControl from './OctaveControl.svelte';
	import PaletteEditDialog from './PaletteEditDialog.svelte';
	import { subscriptDigit } from '$lib/utils/note-names.js';

	interface Props {
		onDestructiveChange?: () => void;
	}

	let { onDestructiveChange }: Props = $props();
	let showEdit = $state(false);

	let sortedEntries = $derived([...paletteState.entries].sort((a, b) => a.order - b.order));

	/** Compute display label with octave indicator */
	function displayLabel(entry: typeof sortedEntries[0]): string {
		if (entry.basePitch.kind === 'semitone') {
			if (paletteState.pitchSystem === 'absolute') {
				// Absolute: "C4", "D#5"
				const octave = paletteState.paletteOctave + Math.floor(entry.basePitch.semitones / 12);
				return `${entry.name}${octave}`;
			}
			// Relative: "Do₀", "So₋₁"
			const octave = Math.floor((entry.basePitch.semitones + paletteState.paletteOctave * 12) / 12);
			return `${entry.name}${subscriptDigit(octave)}`;
		}
		// Microtonal: cents/mille entries — show with octave subscript
		if (entry.basePitch.kind === 'cents') {
			const totalCents = entry.basePitch.cents + paletteState.paletteOctave * 1200;
			return `${totalCents}¢`;
		}
		if (entry.basePitch.kind === 'mille') {
			const totalMille = entry.basePitch.mille + paletteState.paletteOctave * 1000;
			return `${totalMille}‰`;
		}
		return entry.name;
	}

	/** Indices in sortedEntries where an octave boundary separator should appear (before that entry) */
	/** Diatonic entries are always 3 (lower) + 7 (home octave) + 3 (upper) */
	let octaveBoundaries = $derived.by(() => {
		if (paletteState.mode !== 'diatonic') return new Set<number>();
		if (sortedEntries.length === 13) return new Set([3, 10]);
		return new Set<number>();
	});
</script>

<aside class="palette">
	<OctaveControl />
	<div class="palette-entries">
		{#each sortedEntries as entry, i (entry.entryId)}
			{#if octaveBoundaries.has(i)}
				<div class="octave-separator"></div>
			{/if}
			<PaletteEntryComponent {entry} displayLabel={displayLabel(entry)} />
		{/each}
	</div>
	<button class="edit-btn" onclick={() => (showEdit = true)}>Edit</button>
</aside>

<PaletteEditDialog open={showEdit} onClose={() => (showEdit = false)} {onDestructiveChange} />

<style>
	.palette {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px 4px;
		background: var(--bg-surface);
		border-right: 1px solid var(--border);
		overflow-y: auto;
		flex-shrink: 0;
		-webkit-overflow-scrolling: touch;
	}

	.palette-entries {
		display: flex;
		flex-direction: column;
		gap: 4px;
		flex: 1;
	}

	.octave-separator {
		width: 80%;
		height: 1px;
		background: var(--border);
		margin: 4px 0;
	}

	.edit-btn {
		padding: 5px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text-muted);
		cursor: pointer;
		font-size: 11px;
		margin-top: 4px;
	}

	.edit-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
