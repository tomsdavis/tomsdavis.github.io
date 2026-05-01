<script lang="ts">
	interface Props {
		label: string;
		color: string;
		playing?: boolean;
		small?: boolean;
	}

	let { label, color, playing = false, small = false }: Props = $props();
</script>

<div
	class="note-display"
	class:playing
	class:small
	style:--note-color={color}
>
	<span class="label">{label}</span>
</div>

<style>
	.note-display {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		border-radius: var(--cell-radius);
		background: var(--note-color);
		color: white;
		font-weight: 700;
		font-size: 14px;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
		transition: box-shadow 0.1s, transform 0.1s;
	}

	.note-display.small {
		font-size: 11px;
	}

	.note-display.playing {
		box-shadow: var(--playing-glow);
		transform: scale(1.05);
	}

	.label {
		pointer-events: none;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 90%;
	}
</style>
