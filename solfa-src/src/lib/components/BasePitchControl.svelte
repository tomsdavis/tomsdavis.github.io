<script lang="ts">
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { midiToHz, hzToMidi } from '$lib/audio/pitch';
	import { chromaticName } from '$lib/utils/note-names';
	import { noteColor } from '$lib/utils/colors';
	import { C0_MIDI, MIN_OCTAVE, MAX_OCTAVE } from '$lib/constants';

	let popoverOpen = $state(false);
	let refHzInput = $state('');

	const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

	let keyNote = $derived((paletteState.refMidi - C0_MIDI) % 12);

	let displayLabel = $derived.by(() => {
		if (paletteState.mode === 'microtonal') {
			return `${midiToHz(paletteState.refMidi).toFixed(1)} Hz`;
		}
		return `${chromaticName(paletteState.refMidi - C0_MIDI)}${paletteState.octave}`;
	});

	function toggle() {
		popoverOpen = !popoverOpen;
		if (popoverOpen && paletteState.mode === 'microtonal') {
			refHzInput = midiToHz(paletteState.refMidi).toFixed(2);
		}
	}

	function close() {
		popoverOpen = false;
	}

	function setKeyNote(semitone: number) {
		paletteState.refMidi = C0_MIDI + paletteState.octave * 12 + semitone;
	}

	function applyRefHz(value: string) {
		const hz = parseFloat(value);
		if (hz > 0) paletteState.refMidi = hzToMidi(hz);
	}

	function onOverlayClick() {
		close();
	}
</script>

<div class="base-pitch-wrap">
	<button class="base-pitch-btn" onclick={toggle}>
		{displayLabel}
	</button>

	{#if popoverOpen}
		<div class="popover-overlay" onclick={onOverlayClick} role="presentation"></div>
		<div class="popover">
			{#if paletteState.mode !== 'microtonal'}
				<!-- Octave control -->
				<div class="pop-row">
					<span class="pop-label">Oct</span>
					<button
						class="pop-oct-btn"
						disabled={paletteState.octave <= MIN_OCTAVE}
						onclick={() => paletteState.decrementOctave()}
					>−</button>
					<span class="pop-oct-val">{paletteState.octave}</span>
					<button
						class="pop-oct-btn"
						disabled={paletteState.octave >= MAX_OCTAVE}
						onclick={() => paletteState.incrementOctave()}
					>+</button>
				</div>

				<!-- Key picker -->
				<div class="pop-row key-row">
					<span class="pop-label">Key</span>
					<div class="key-grid">
						{#each CHROMATIC_NOTES as note, i (i)}
							<button
								class="key-btn"
								class:active={keyNote === i}
								onclick={() => setKeyNote(i)}
								style="background: {keyNote === i ? noteColor(i) : 'var(--bg-surface)'}"
							>
								{note}
							</button>
						{/each}
					</div>
				</div>
			{:else}
				<!-- Microtonal: Hz input -->
				<div class="pop-row">
					<span class="pop-label">Ref</span>
					<input
						class="hz-input"
						type="number"
						min="1"
						step="0.01"
						value={refHzInput}
						oninput={(e) => {
							refHzInput = (e.target as HTMLInputElement).value;
							applyRefHz(refHzInput);
						}}
					/>
					<span class="hz-unit">Hz</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.base-pitch-wrap {
		position: relative;
	}

	.base-pitch-btn {
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		white-space: nowrap;
	}

	.base-pitch-btn:hover {
		border-color: var(--accent);
	}

	.popover-overlay {
		position: fixed;
		inset: 0;
		z-index: 800;
	}

	.popover {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 4px;
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 12px;
		z-index: 801;
		min-width: 220px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
	}

	.pop-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.pop-label {
		font-size: 12px;
		color: var(--text-muted);
		width: 28px;
		flex-shrink: 0;
	}

	.pop-oct-btn {
		width: 28px;
		height: 28px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg);
		color: var(--text);
		font-size: 16px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.pop-oct-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.pop-oct-val {
		font-size: 14px;
		font-weight: 600;
		width: 20px;
		text-align: center;
	}

	.key-row {
		align-items: flex-start;
	}

	.key-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 3px;
	}

	.key-btn {
		padding: 3px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text);
		cursor: pointer;
		font-size: 11px;
		min-width: 28px;
		text-align: center;
	}

	.key-btn.active {
		border-color: white;
		font-weight: 700;
	}

	.hz-input {
		width: 90px;
		padding: 4px 6px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg);
		color: var(--text);
		font-size: 13px;
	}

	.hz-unit {
		font-size: 12px;
		color: var(--text-muted);
	}
</style>
