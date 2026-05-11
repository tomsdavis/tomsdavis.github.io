<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Grid from '$lib/components/Grid.svelte';
	import Palette from '$lib/components/Palette.svelte';
	import DragGhost from '$lib/components/DragGhost.svelte';
	import SaveLoadDialog from '$lib/components/SaveLoadDialog.svelte';
	import PaletteEditDialog from '$lib/components/PaletteEditDialog.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { GridState } from '$lib/stores/grid-state.svelte';
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { dropHandlerState } from '$lib/stores/drop-handler-state.js';
	import { handleDrop } from '$lib/utils/drop-handler';
	import { saveNamed } from '$lib/utils/serialization';
	import { DEFAULT_COLUMNS, DEFAULT_ROWS } from '$lib/constants';
	import type { SerializedAppState } from '$lib/types/serialization';

	const gridState = new GridState(DEFAULT_COLUMNS, DEFAULT_ROWS);
	let showSaveLoad = $state(false);
	let showClearConfirm = $state(false);
	let showEdit = $state(false);

	dropHandlerState.setHandler((op) => {
		handleDrop(op, gridState, paletteState.refMidi, paletteState.mode, paletteState.pitchSystem, paletteState.paletteOctave);
	});

	async function handleSave(name: string) {
		await saveNamed(
			name,
			gridState.cells,
			gridState.columns,
			paletteState.entries,
			paletteState.mode,
			paletteState.refMidi,
			paletteState.pitchSystem,
			paletteState.paletteOctave,
			paletteState.diatonicKey
		);
	}

	function handleLoad(state: SerializedAppState) {
		// Restore grid
		gridState.cells = state.grid.cells;

		// Restore palette
		paletteState.entries = state.palette.entries;
		paletteState.mode = state.palette.mode;
		paletteState.refMidi = state.palette.refMidi;
		paletteState.pitchSystem = state.palette.pitchSystem;
		paletteState.paletteOctave = state.palette.paletteOctave;
		paletteState.diatonicKey = state.palette.diatonicKey;
	}
</script>

<Toolbar
	onSaveLoad={() => (showSaveLoad = true)}
	onClearGrid={() => (showClearConfirm = true)}
	onEditPalette={() => (showEdit = true)}
/>
<div class="main-area">
	<Palette />
	<Grid {gridState} />
</div>
<DragGhost />
<SaveLoadDialog
	open={showSaveLoad}
	onClose={() => (showSaveLoad = false)}
	onSave={handleSave}
	onLoad={handleLoad}
/>
<PaletteEditDialog
	open={showEdit}
	onClose={() => (showEdit = false)}
	onDestructiveChange={() => gridState.clear()}
/>
<ConfirmDialog
	open={showClearConfirm}
	title="Clear grid?"
	message="This will remove all notes from the grid. This cannot be undone."
	confirmLabel="Clear"
	destructive={true}
	onConfirm={() => { gridState.clear(); showClearConfirm = false; }}
	onCancel={() => (showClearConfirm = false)}
/>

<style>
	.main-area {
		display: flex;
		flex: 1;
		overflow: hidden;
	}
</style>
