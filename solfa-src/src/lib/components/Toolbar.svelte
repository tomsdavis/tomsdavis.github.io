<script lang="ts">
	import ModeToggle from './ModeToggle.svelte';
	import BasePitchControl from './BasePitchControl.svelte';
	import { paletteState } from '$lib/stores/palette-state.svelte';

	interface Props {
		onSaveLoad?: () => void;
		onClearGrid?: () => void;
	}

	let { onSaveLoad, onClearGrid }: Props = $props();
</script>

<header class="toolbar">
	<div class="toolbar-left">
		<span class="title">Solfa</span>
		{#if onClearGrid}
			<button class="toolbar-btn clear-btn" onclick={onClearGrid}>Clear</button>
		{/if}
	</div>
	<div class="toolbar-actions">
		{#if paletteState.pitchSystem === 'relative'}
			<BasePitchControl />
		{/if}
		{#if onSaveLoad}
			<button class="toolbar-btn" onclick={onSaveLoad}>Save/Load</button>
		{/if}
		<ModeToggle />
	</div>
</header>

<style>
	.toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: var(--toolbar-height);
		padding: 0 16px;
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.title {
		font-size: 20px;
		font-weight: 700;
		color: var(--text);
	}

	.clear-btn {
		font-size: 12px;
		padding: 4px 10px;
	}

	.toolbar-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toolbar-btn {
		padding: 6px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: transparent;
		color: var(--text);
		font-size: 13px;
		cursor: pointer;
	}

	.toolbar-btn:hover {
		background: var(--bg-cell);
	}
</style>
