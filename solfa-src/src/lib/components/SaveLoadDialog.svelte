<script lang="ts">
	import { listSaves, saveNamed, loadNamed, deleteNamed } from '$lib/utils/serialization';
	import type { SerializedAppState } from '$lib/types/serialization';

	interface Props {
		open: boolean;
		onClose: () => void;
		onSave: (name: string) => void;
		onLoad: (state: SerializedAppState) => void;
	}

	let { open, onClose, onSave, onLoad }: Props = $props();
	let saveName = $state('');
	let saves = $state<string[]>([]);

	$effect(() => {
		if (open) {
			saves = listSaves();
		}
	});

	function handleSave() {
		const name = saveName.trim();
		if (!name) return;
		onSave(name);
		saves = listSaves();
		saveName = '';
	}

	function handleLoad(name: string) {
		const state = loadNamed(name);
		if (state) {
			onLoad(state);
			onClose();
		}
	}

	function handleDelete(name: string) {
		deleteNamed(name);
		saves = listSaves();
	}
</script>

{#if open}
	<div class="overlay" onclick={onClose} role="presentation">
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog">
			<h2>Save / Load</h2>

			<div class="save-section">
				<input
					type="text"
					placeholder="Composition name..."
					bind:value={saveName}
					onkeydown={(e) => e.key === 'Enter' && handleSave()}
				/>
				<button onclick={handleSave} disabled={!saveName.trim()}>Save</button>
			</div>

			<div class="saves-list">
				{#if saves.length === 0}
					<p class="empty">No saved compositions</p>
				{:else}
					{#each saves as name}
						<div class="save-item">
							<span class="save-name">{name}</span>
							<div class="save-actions">
								<button class="load-btn" onclick={() => handleLoad(name)}>Load</button>
								<button class="delete-btn" onclick={() => handleDelete(name)}>Del</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<button class="close-btn" onclick={onClose}>Close</button>
		</div>
	</div>
{/if}

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 900;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 20px;
		width: 320px;
		max-height: 80vh;
		overflow-y: auto;
	}

	h2 {
		margin: 0 0 16px;
		font-size: 18px;
	}

	.save-section {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
	}

	input {
		flex: 1;
		padding: 8px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		font-size: 14px;
	}

	button {
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-surface);
		color: var(--text);
		cursor: pointer;
		font-size: 13px;
	}

	button:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.saves-list {
		margin-bottom: 16px;
	}

	.empty {
		color: var(--text-muted);
		font-size: 13px;
	}

	.save-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}

	.save-name {
		font-size: 14px;
	}

	.save-actions {
		display: flex;
		gap: 4px;
	}

	.load-btn {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.delete-btn {
		color: #e74c3c;
		border-color: #e74c3c;
	}

	.close-btn {
		width: 100%;
	}
</style>
