<script lang="ts">
	import { GridState } from '$lib/stores/grid-state.svelte';
	import GridRow from './GridRow.svelte';
	import { DEFAULT_COLUMNS, DEFAULT_ROWS } from '$lib/constants';

	interface Props {
		gridState: GridState;
	}

	let { gridState }: Props = $props();

	function getRowCells(row: number) {
		const start = row * gridState.columns;
		return gridState.cells.slice(start, start + gridState.columns);
	}
</script>

<div class="grid-container">
	<div class="grid-scroll">
		{#each Array(gridState.rows) as _, row}
			<GridRow cells={getRowCells(row)} {row} />
		{/each}
	</div>
</div>

<style>
	.grid-container {
		flex: 1;
		overflow: auto;
		padding: 16px;
		-webkit-overflow-scrolling: touch;
	}

	.grid-scroll {
		display: flex;
		flex-direction: column;
		gap: var(--cell-gap);
		min-width: min-content;
	}
</style>
