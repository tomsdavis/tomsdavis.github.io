<script lang="ts">
	import { paletteState } from '$lib/stores/palette-state.svelte';
	import { NOTE_COLORS } from '$lib/utils/colors';
	import { isDestructiveTransition } from '$lib/utils/palette-transitions';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import type { PaletteEntry, PaletteMode, PitchSystem } from '$lib/types/palette';

	interface Props {
		open: boolean;
		onClose: () => void;
		onDestructiveChange?: () => void;
	}

	let { open, onClose, onDestructiveChange }: Props = $props();

	let expandedId = $state<string | null>(null);
	let confirmOpen = $state(false);
	let pendingAction: (() => void) | null = $state(null);

	// Sorted entries by order
	let sortedEntries = $derived([...paletteState.entries].sort((a, b) => a.order - b.order));

	function requestTransition(newSystem: PitchSystem, newMode: PaletteMode) {
		if (isDestructiveTransition(paletteState.pitchSystem, paletteState.mode, newSystem, newMode)) {
			pendingAction = () => {
				if (newSystem !== paletteState.pitchSystem) {
					paletteState.setPitchSystem(newSystem);
				} else {
					paletteState.setMode(newMode);
				}
				onDestructiveChange?.();
				expandedId = null;
			};
			confirmOpen = true;
		} else if (newSystem !== paletteState.pitchSystem) {
			paletteState.setPitchSystem(newSystem);
			expandedId = null;
		} else {
			paletteState.setMode(newMode);
			expandedId = null;
		}
	}

	function handleConfirm() {
		pendingAction?.();
		pendingAction = null;
		confirmOpen = false;
	}

	function handleCancelConfirm() {
		pendingAction = null;
		confirmOpen = false;
	}

	function setMode(mode: PaletteMode) {
		requestTransition(paletteState.pitchSystem, mode);
	}

	function toggleExpand(entryId: string) {
		expandedId = expandedId === entryId ? null : entryId;
	}

	function addEntry() {
		const defaultColor = NOTE_COLORS.find(
			(c) => !paletteState.entries.some((e) => e.color === c)
		) ?? NOTE_COLORS[0];

		const basePitch =
			paletteState.mode === 'microtonal'
				? { kind: 'cents' as const, cents: 0 }
				: { kind: 'semitone' as const, semitones: 0 };

		paletteState.addEntry({
			basePitch,
			name: 'New',
			color: defaultColor,
			order: 999
		});

		// Auto-expand the new entry
		const newest = [...paletteState.entries].sort((a, b) => b.order - a.order)[0];
		expandedId = newest?.entryId ?? null;
	}

	function updateName(entry: PaletteEntry, value: string) {
		paletteState.updateEntry(entry.entryId, { name: value });
	}

	function updateColor(entry: PaletteEntry, color: string) {
		paletteState.updateEntry(entry.entryId, { color });
	}

	function updateSemitones(entry: PaletteEntry, value: string) {
		const n = parseInt(value, 10);
		if (!isNaN(n)) {
			paletteState.updateEntry(entry.entryId, { basePitch: { kind: 'semitone', semitones: n } });
		}
	}

	function updateCents(entry: PaletteEntry, value: string) {
		const n = parseFloat(value);
		if (!isNaN(n)) {
			paletteState.updateEntry(entry.entryId, { basePitch: { kind: 'cents', cents: n } });
		}
	}

	function updateMille(entry: PaletteEntry, value: string) {
		const n = parseFloat(value);
		if (!isNaN(n)) {
			paletteState.updateEntry(entry.entryId, { basePitch: { kind: 'mille', mille: n } });
		}
	}

	function updatePitchKind(_entry: PaletteEntry, kind: 'cents' | 'mille') {
		// Switching cents <-> milles is destructive: converts ALL entries and clears grid
		const currentKind = paletteState.entries[0]?.basePitch.kind;
		if (currentKind === kind) return;

		pendingAction = () => {
			for (const e of paletteState.entries) {
				if (kind === 'cents') {
					paletteState.updateEntry(e.entryId, { basePitch: { kind: 'cents', cents: 0 } });
				} else {
					paletteState.updateEntry(e.entryId, { basePitch: { kind: 'mille', mille: 0 } });
				}
			}
			onDestructiveChange?.();
		};
		confirmOpen = true;
	}
</script>

{#if open}
	<div class="overlay" onclick={onClose} role="presentation">
		<div class="dialog" onclick={(e) => e.stopPropagation()} role="dialog">
			<div class="dialog-header">
				<h2>Edit Palette</h2>
				<button class="close-x" onclick={onClose}>✕</button>
			</div>

			<!-- Pitch system toggle -->
			<div class="mode-row">
				<span class="section-label">System:</span>
				{#each ['relative', 'absolute'] as system (system)}
					<button
						class="mode-btn"
						class:active={paletteState.pitchSystem === system}
						onclick={() => requestTransition(system as PitchSystem, system === paletteState.pitchSystem ? paletteState.mode : 'chromatic')}
					>
						{system[0].toUpperCase() + system.slice(1)}
					</button>
				{/each}
			</div>

			<!-- Mode buttons -->
			<div class="mode-row">
				<span class="section-label">Mode:</span>
				{#each (paletteState.pitchSystem === 'absolute' ? ['chromatic', 'diatonic'] : ['chromatic', 'diatonic', 'microtonal']) as mode (mode)}
					<button
						class="mode-btn"
						class:active={paletteState.mode === mode}
						onclick={() => setMode(mode as PaletteMode)}
					>
						{mode[0].toUpperCase() + mode.slice(1)}
					</button>
				{/each}
			</div>

			<!-- Key selector (absolute diatonic only) -->
			{#if paletteState.pitchSystem === 'absolute' && paletteState.mode === 'diatonic'}
				<div class="key-selector">
					<span class="section-label">Key:</span>
					<div class="key-grid">
						<div class="key-row sharps">
							<span class="key-spacer"></span>
							{#each ['C#', 'D#'] as k (k)}
								<button
									class="key-btn accidental"
									class:active={paletteState.diatonicKey === k}
									onclick={() => paletteState.setDiatonicKey(k)}
								>{k}</button>
							{/each}
							<span class="key-spacer"></span>
							{#each ['F#', 'G#', 'A#'] as k (k)}
								<button
									class="key-btn accidental"
									class:active={paletteState.diatonicKey === k}
									onclick={() => paletteState.setDiatonicKey(k)}
								>{k}</button>
							{/each}
							<span class="key-spacer"></span>
						</div>
						<div class="key-row naturals">
							{#each ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as k (k)}
								<button
									class="key-btn natural"
									class:active={paletteState.diatonicKey === k}
									onclick={() => paletteState.setDiatonicKey(k)}
								>{k}</button>
							{/each}
						</div>
						<div class="key-row flats">
							<span class="key-spacer"></span>
							{#each ['Db', 'Eb'] as k (k)}
								<button
									class="key-btn accidental"
									class:active={paletteState.diatonicKey === k}
									onclick={() => paletteState.setDiatonicKey(k)}
								>{k}</button>
							{/each}
							<span class="key-spacer"></span>
							{#each ['Gb', 'Ab', 'Bb'] as k (k)}
								<button
									class="key-btn accidental"
									class:active={paletteState.diatonicKey === k}
									onclick={() => paletteState.setDiatonicKey(k)}
								>{k}</button>
							{/each}
							<span class="key-spacer"></span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Entry list -->
			<div class="entries-list">
				{#each sortedEntries as entry (entry.entryId)}
					<div class="entry-block">
						<div class="entry-row">
							<button class="expand-btn" onclick={() => toggleExpand(entry.entryId)}>
								{expandedId === entry.entryId ? '▼' : '▶'}
							</button>
							<span class="entry-swatch" style="background: {entry.color}"></span>
							<span class="entry-name">{entry.name}</span>
							<div class="entry-actions">
								<button
									class="icon-btn"
									onclick={() => paletteState.moveEntryUp(entry.entryId)}
									title="Move up"
								>↑</button>
								<button
									class="icon-btn"
									onclick={() => paletteState.moveEntryDown(entry.entryId)}
									title="Move down"
								>↓</button>
								<button
									class="icon-btn delete-btn"
									onclick={() => {
										paletteState.removeEntry(entry.entryId);
										if (expandedId === entry.entryId) expandedId = null;
									}}
									title="Remove"
								>✕</button>
							</div>
						</div>

						{#if expandedId === entry.entryId}
							<div class="entry-detail">
								<!-- Name -->
								<label class="field-row">
									<span class="field-label">Name</span>
									<input
										class="text-input"
										type="text"
										value={entry.name}
										oninput={(e) => updateName(entry, (e.target as HTMLInputElement).value)}
									/>
								</label>

								<!-- Color swatches -->
								<div class="field-row">
									<span class="field-label">Color</span>
									<div class="color-swatches">
										{#each NOTE_COLORS as color (color)}
											<button
												class="swatch-btn"
												class:selected={entry.color === color}
												style="background: {color}"
												onclick={() => updateColor(entry, color)}
											></button>
										{/each}
									</div>
								</div>

								<!-- Pitch -->
								<div class="field-row">
									<span class="field-label">Pitch</span>
									{#if entry.basePitch.kind === 'semitone'}
										<input
											class="number-input"
											type="number"
											value={entry.basePitch.semitones}
											oninput={(e) => updateSemitones(entry, (e.target as HTMLInputElement).value)}
										/>
										<span class="unit-label">semitones above ref</span>
									{:else if entry.basePitch.kind === 'cents'}
										<input
											class="number-input"
											type="number"
											step="0.01"
											value={entry.basePitch.cents}
											oninput={(e) => updateCents(entry, (e.target as HTMLInputElement).value)}
										/>
										<span class="unit-label">¢</span>
										{#if paletteState.mode === 'microtonal'}
											<select
												class="kind-select"
												value={entry.basePitch.kind}
												onchange={(e) => updatePitchKind(entry, (e.target as HTMLSelectElement).value as 'cents' | 'mille')}
											>
												<option value="cents">¢ cents</option>
												<option value="mille">‰ mille</option>
											</select>
										{/if}
									{:else if entry.basePitch.kind === 'mille'}
										<input
											class="number-input"
											type="number"
											step="0.01"
											value={entry.basePitch.mille}
											oninput={(e) => updateMille(entry, (e.target as HTMLInputElement).value)}
										/>
										<span class="unit-label">‰</span>
										{#if paletteState.mode === 'microtonal'}
											<select
												class="kind-select"
												value={entry.basePitch.kind}
												onchange={(e) => updatePitchKind(entry, (e.target as HTMLSelectElement).value as 'cents' | 'mille')}
											>
												<option value="cents">¢ cents</option>
												<option value="mille">‰ mille</option>
											</select>
										{/if}
									{/if}
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<button class="add-btn" onclick={addEntry}>+ Add Entry</button>
		</div>
	</div>

	<ConfirmDialog
		open={confirmOpen}
		message="This will clear all notes from the grid. Continue?"
		confirmLabel="Clear & Switch"
		onConfirm={handleConfirm}
		onCancel={handleCancelConfirm}
	/>
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
		width: 420px;
		max-height: 85vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.dialog-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-size: 18px;
	}

	.close-x {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 16px;
		cursor: pointer;
		padding: 4px 8px;
	}

	.mode-row {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.section-label {
		font-size: 12px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.mode-btn {
		padding: 4px 10px;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: var(--bg);
		color: var(--text);
		cursor: pointer;
		font-size: 13px;
	}

	.mode-btn.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.unit-label {
		font-size: 12px;
		color: var(--text-muted);
	}

	.key-selector {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.key-grid {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin-top: 4px;
	}

	.key-row {
		display: flex;
		gap: 2px;
		justify-content: center;
	}

	.key-spacer {
		width: 20px;
		flex-shrink: 0;
	}

	.key-btn {
		padding: 4px 6px;
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		min-width: 32px;
		text-align: center;
	}

	.key-btn.natural {
		background: var(--bg-surface);
		color: var(--text);
	}

	.key-btn.accidental {
		background: var(--bg);
		color: var(--text-muted);
	}

	.key-btn.active {
		background: var(--accent);
		border-color: var(--accent);
		color: white;
	}

	.entries-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		border: 1px solid var(--border);
		border-radius: 8px;
		overflow: hidden;
	}

	.entry-block {
		border-bottom: 1px solid var(--border);
	}

	.entry-block:last-child {
		border-bottom: none;
	}

	.entry-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
	}

	.expand-btn {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 12px;
		padding: 0 4px;
	}

	.entry-swatch {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.entry-name {
		flex: 1;
		font-size: 13px;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.entry-actions {
		display: flex;
		gap: 2px;
	}

	.icon-btn {
		background: none;
		border: 1px solid var(--border);
		border-radius: 4px;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 12px;
		padding: 2px 6px;
	}

	.icon-btn:hover {
		color: var(--text);
		border-color: var(--text-muted);
	}

	.delete-btn:hover {
		color: #e74c3c;
		border-color: #e74c3c;
	}

	.entry-detail {
		padding: 10px 12px 12px;
		background: var(--bg);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.field-row {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.field-label {
		font-size: 12px;
		color: var(--text-muted);
		width: 44px;
		flex-shrink: 0;
	}

	.text-input {
		flex: 1;
		padding: 4px 7px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-surface);
		color: var(--text);
		font-size: 13px;
	}

	.number-input {
		width: 70px;
		padding: 4px 7px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-surface);
		color: var(--text);
		font-size: 13px;
	}

	.color-swatches {
		display: flex;
		gap: 5px;
		flex-wrap: wrap;
	}

	.swatch-btn {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid transparent;
		cursor: pointer;
		padding: 0;
	}

	.swatch-btn.selected {
		border-color: white;
		outline: 2px solid var(--accent);
	}

	.kind-select {
		padding: 3px 5px;
		border: 1px solid var(--border);
		border-radius: 5px;
		background: var(--bg-surface);
		color: var(--text);
		font-size: 12px;
	}

	.add-btn {
		width: 100%;
		padding: 8px;
		border: 1px dashed var(--border);
		border-radius: 6px;
		background: none;
		color: var(--text-muted);
		cursor: pointer;
		font-size: 13px;
	}

	.add-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}
</style>
