<script lang="ts">
	import type { GridCell } from '$lib/types/grid';
	import GridCellComponent from './GridCell.svelte';
	import { dragState } from '$lib/stores/drag-state.svelte';

	interface Props {
		cells: GridCell[];
		row: number;
	}

	let { cells, row }: Props = $props();

	const isEorTarget = $derived(
		dragState.current?.dropTarget?.kind === 'end-of-row' &&
			dragState.current.dropTarget.row === row
	);
</script>

<div class="grid-row">
	{#each cells as cell, col}
		<GridCellComponent {cell} {row} {col} />
	{/each}
	<div class="eor-zone" class:drop-target={isEorTarget} data-end-of-row={row}></div>
</div>

<style>
	.grid-row {
		display: flex;
		gap: var(--cell-gap);
	}

	.eor-zone {
		width: calc(var(--cell-size) / 2);
		height: var(--cell-size);
		border-left: 3px solid transparent;
		transition: border-color 0.1s;
		flex-shrink: 0;
	}

	.eor-zone.drop-target {
		border-left-color: var(--accent);
	}
</style>
