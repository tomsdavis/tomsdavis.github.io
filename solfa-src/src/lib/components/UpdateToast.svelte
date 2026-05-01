<script lang="ts">
	import { swUpdateState } from '$lib/stores/sw-update-state.svelte';

	function reload() {
		swUpdateState.applyUpdate();
	}
</script>

{#if swUpdateState.updateAvailable}
	<div class="toast" role="status" aria-live="polite">
		<span class="message">A new version is available.</span>
		<button class="reload" onclick={reload}>Reload</button>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 8px 8px 16px;
		background: var(--bg-surface);
		color: var(--text);
		border: 1px solid var(--border);
		border-radius: 999px;
		font-size: 14px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
		max-width: calc(100vw - 32px);
	}

	.message {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.reload {
		padding: 6px 14px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: white;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
	}

	.reload:hover {
		filter: brightness(1.1);
	}
</style>
