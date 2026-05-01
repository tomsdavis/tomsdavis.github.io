<script lang="ts">
	import type { GridCell } from '$lib/types/grid';
	import GridCellComponent from './GridCell.svelte';

	interface Props {
		cells: GridCell[];
		row: number;
	}

	let { cells, row }: Props = $props();
</script>

<div class="grid-row">
	{#each cells as cell, col}
		<GridCellComponent {cell} {row} {col} />
	{/each}
</div>

<style>
	.grid-row {
		display: flex;
		gap: var(--cell-gap);
	}
</style>
