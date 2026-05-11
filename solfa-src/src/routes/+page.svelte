<script lang="ts">
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Grid from '$lib/components/Grid.svelte';
	import Palette from '$lib/components/Palette.svelte';
	import DragGhost from '$lib/components/DragGhost.svelte';
	import FileBrowserDialog from '$lib/components/FileBrowserDialog.svelte';
	import PaletteEditDialog from '$lib/components/PaletteEditDialog.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';
	import { GridState } from '$lib/stores/grid-state.svelte';
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { dropHandlerState } from '$lib/stores/drop-handler-state.js';
	import { handleDrop } from '$lib/utils/drop-handler';
	import { serializeAppState, deserializeAppState } from '$lib/utils/serialization';
	import { writeFile } from '$lib/storage/opfs';
	import { DEFAULT_COLUMNS, DEFAULT_ROWS } from '$lib/constants';
	import type { SerializedAppState } from '$lib/types/serialization';

	const gridState = new GridState(DEFAULT_COLUMNS, DEFAULT_ROWS);
	let showFiles = $state(false);
	let showClearConfirm = $state(false);
	let showEdit = $state(false);

	dropHandlerState.setHandler((op) => {
		handleDrop(op, gridState, paletteState.refMidi, paletteState.mode, paletteState.pitchSystem, paletteState.paletteOctave);
	});

	async function handleSaveAs(path: string): Promise<void> {
		const json = serializeAppState(
			gridState.cells,
			gridState.columns,
			paletteState.entries,
			paletteState.mode,
			paletteState.refMidi,
			paletteState.pitchSystem,
			paletteState.paletteOctave,
			paletteState.diatonicKey
		);
		await writeFile(path, json);
	}

	function handleLoad(state: SerializedAppState, _path: string): void {
		gridState.cells = state.grid.cells;
		paletteState.entries = state.palette.entries;
		paletteState.mode = state.palette.mode;
		paletteState.refMidi = state.palette.refMidi;
		paletteState.pitchSystem = state.palette.pitchSystem;
		paletteState.paletteOctave = state.palette.paletteOctave;
		paletteState.diatonicKey = state.palette.diatonicKey;
	}

	function handleNew(): void {
		gridState.clear();
	}
</script>

<Toolbar
	onOpenFiles={() => (showFiles = true)}
	onClearGrid={() => (showClearConfirm = true)}
	onEditPalette={() => (showEdit = true)}
/>
<div class="main-area">
	<Palette />
	<Grid {gridState} />
</div>
<DragGhost />
<FileBrowserDialog
	open={showFiles}
	onClose={() => (showFiles = false)}
	onLoad={handleLoad}
	onSaveAs={handleSaveAs}
	onNew={handleNew}
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
