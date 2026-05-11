<script lang="ts">
	import ModeToggle from './ModeToggle.svelte';
	import BasePitchControl from './BasePitchControl.svelte';
	import { paletteState } from '$lib/stores/palette-state.svelte';

	interface Props {
		onOpenFiles?: () => void;
		onClearGrid?: () => void;
		onEditPalette?: () => void;
	}

	let { onOpenFiles, onClearGrid, onEditPalette }: Props = $props();
</script>

<header class="toolbar">
	<div class="toolbar-left">
		<span class="title">Solfa</span>
	</div>
	<div class="toolbar-actions">
		{#if paletteState.pitchSystem === 'relative'}
			<BasePitchControl />
		{/if}
		{#if onEditPalette}
			<button class="toolbar-btn icon-btn" onclick={onEditPalette} aria-label="Edit palette">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3"/>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
				</svg>
			</button>
		{/if}
		{#if onOpenFiles}
			<button class="toolbar-btn icon-btn" onclick={onOpenFiles} aria-label="Open files">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
					<polyline points="17 21 17 13 7 13 7 21"/>
					<polyline points="7 3 7 8 15 8"/>
				</svg>
			</button>
		{/if}
		{#if onClearGrid}
			<button class="toolbar-btn icon-btn" onclick={onClearGrid} aria-label="Clear grid">
				<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6"/>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
				</svg>
			</button>
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
		padding: 0 12px;
		background: var(--bg-surface);
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.toolbar-left {
		display: flex;
		align-items: center;
	}

	.title {
		font-size: 18px;
		font-weight: 700;
		color: var(--text);
	}

	@media (max-width: 400px) {
		.title {
			display: none;
		}
	}

	.toolbar-actions {
		display: flex;
		align-items: center;
		gap: 6px;
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

	.icon-btn {
		padding: 5px;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
