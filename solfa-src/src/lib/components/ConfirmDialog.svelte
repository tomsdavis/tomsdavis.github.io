<script lang="ts">
	interface Props {
		open: boolean;
		title?: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		open,
		title = 'Are you sure?',
		message,
		confirmLabel = 'Yes',
		cancelLabel = 'Cancel',
		onConfirm,
		onCancel
	}: Props = $props();
</script>

{#if open}
	<div class="overlay" onclick={onCancel} role="presentation">
		<!-- svelte-ignore a11y_interactive_supports_focus a11y_click_events_have_key_events -->
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="alertdialog">
			<h2>{title}</h2>
			<p class="message">{message}</p>
			<div class="actions">
				<button class="btn cancel-btn" onclick={onCancel}>{cancelLabel}</button>
				<button class="btn confirm-btn" onclick={onConfirm}>{confirmLabel}</button>
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
		z-index: 950;
	}

	.dialog {
		background: var(--bg-surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 20px;
		width: 300px;
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

	.actions {
		display: flex;
		gap: 8px;
		justify-content: flex-end;
	}

	.btn {
		padding: 8px 16px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;
	}

	.cancel-btn {
		background: var(--bg-surface);
		color: var(--text);
	}

	.cancel-btn:hover {
		background: var(--bg-cell);
	}

	.confirm-btn {
		background: #e74c3c;
		color: white;
		border-color: #e74c3c;
	}

	.confirm-btn:hover {
		background: #c0392b;
		border-color: #c0392b;
	}
</style>
