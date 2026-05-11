<script lang="ts">
	interface Props {
		open: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		destructive?: boolean;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title,
		message,
		confirmLabel = 'OK',
		cancelLabel = 'Cancel',
		destructive = false,
		onConfirm,
		onCancel
	}: Props = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') onCancel();
		if (e.key === 'Enter') onConfirm();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div class="overlay" onclick={onCancel} role="presentation">
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
			<h2>{title}</h2>
			<p class="message">{message}</p>
			<div class="footer">
				<button class="cancel-btn" onclick={onCancel}>{cancelLabel}</button>
				<button class="confirm-btn" class:destructive onclick={onConfirm}>{confirmLabel}</button>
			</div>
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
		max-width: calc(100vw - 32px);
	}

	h2 {
		margin: 0 0 12px;
		font-size: 18px;
	}

	.message {
		margin: 0 0 20px;
		font-size: 14px;
		color: var(--text-muted);
		line-height: 1.4;
	}

	.footer {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	button {
		padding: 8px 16px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg-surface);
		color: var(--text);
		cursor: pointer;
		font-size: 13px;
	}

	.cancel-btn:hover {
		background: var(--bg-cell);
	}

	.confirm-btn.destructive {
		color: #e74c3c;
		border-color: #e74c3c;
	}

	.confirm-btn.destructive:hover {
		background: rgba(231, 76, 60, 0.1);
	}

	.confirm-btn:not(.destructive):hover {
		background: var(--bg-cell);
	}
</style>
