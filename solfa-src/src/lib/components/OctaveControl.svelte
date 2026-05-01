<script lang="ts">
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { MIN_OCTAVE, MAX_OCTAVE, MIN_PALETTE_OCTAVE_RELATIVE, MAX_PALETTE_OCTAVE_RELATIVE } from '$lib/constants';

	let minOctave = $derived(paletteState.pitchSystem === 'absolute' ? MIN_OCTAVE : MIN_PALETTE_OCTAVE_RELATIVE);
	let maxOctave = $derived(paletteState.pitchSystem === 'absolute' ? MAX_OCTAVE : MAX_PALETTE_OCTAVE_RELATIVE);
</script>

<div class="octave-control">
	<button
		class="octave-btn"
		disabled={paletteState.paletteOctave <= minOctave}
		onclick={() => paletteState.decrementPaletteOctave()}
	>
		−
	</button>
	<span class="octave-label">{paletteState.paletteOctave}</span>
	<button
		class="octave-btn"
		disabled={paletteState.paletteOctave >= maxOctave}
		onclick={() => paletteState.incrementPaletteOctave()}
	>
		+
	</button>
</div>

<style>
	.octave-control {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px;
	}

	.octave-btn {
		width: 32px;
		height: 32px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-surface);
		color: var(--text);
		font-size: 18px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.octave-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.octave-label {
		font-size: 14px;
		font-weight: 600;
		width: 20px;
		text-align: center;
		color: var(--text);
	}
</style>
