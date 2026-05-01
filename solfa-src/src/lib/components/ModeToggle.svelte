<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
</script>

<button
	class="mode-toggle"
	class:playback={appState.mode === 'playback'}
	onclick={() => appState.toggleMode()}
>
	{appState.mode === 'composition' ? 'Compose' : 'Play'}
</button>

<style>
	.mode-toggle {
		padding: 8px 16px;
		border: 2px solid var(--accent);
		border-radius: 20px;
		background: transparent;
		color: var(--text);
		font-size: 14px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}

	.mode-toggle:hover {
		background: var(--accent);
		color: white;
	}

	.mode-toggle.playback {
		background: var(--accent);
		color: white;
	}
</style>
