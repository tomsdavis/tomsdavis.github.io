<script lang="ts">
	import { dragState } from '$lib/stores/drag-state.svelte';
	import NoteDisplay from './NoteDisplay.svelte';
</script>

{#if dragState.current}
	{@const op = dragState.current}
	{@const label = op.source.kind === 'palette' ? op.source.label : op.source.note.label}
	{@const color = op.source.kind === 'palette' ? op.source.color : op.source.note.color}
	<div
		class="drag-ghost"
		style:left="{op.x - 28}px"
		style:top="{op.y - 28}px"
	>
		<NoteDisplay {label} {color} small />
	</div>
{/if}

<style>
	.drag-ghost {
		position: fixed;
		width: 56px;
		height: 56px;
		pointer-events: none;
		z-index: 1000;
		opacity: 0.85;
		transform: scale(1.1);
	}
</style>
